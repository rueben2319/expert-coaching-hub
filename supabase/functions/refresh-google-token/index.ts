// @ts-ignore: Deno imports work at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno imports work at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { OAuthTokenManager } from "../_shared/oauth-token-manager.ts";
import { DatabaseTokenStorage, TokenStorage } from "../_shared/token-storage.ts";

// Deno global type declaration for IDE
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const refreshLocks = new Map<string, Promise<Response>>();

const randomRequestId = (): string =>
  `${Date.now()}-${crypto.randomUUID()}`;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    // Get auth header first to forward it to the client
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create client with forwarded Authorization header
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Invalid authentication token');
    }

    const refreshRequestId = req.headers.get('x-refresh-request-id') || randomRequestId();
    const lockKey = `${user.id}:google`;

    if (refreshLocks.has(lockKey)) {
      return await refreshLocks.get(lockKey)!;
    }

    const refreshPromise = (async (): Promise<Response> => {
      // Get encrypted tokens from database-backed storage
      const storedTokens = await DatabaseTokenStorage.getTokenRecord(supabase, user.id, 'google');

      if (!storedTokens?.refresh_token) {
        throw new Error('No valid Google OAuth refresh token found. Please sign in with Google again.');
      }

      if (storedTokens.last_refresh_request_id === refreshRequestId) {
        return new Response(
          JSON.stringify({
            success: true,
            replayProtected: true,
            message: 'Refresh request already processed',
            request_id: refreshRequestId,
            timestamp: new Date().toISOString(),
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }

      const refreshToken = storedTokens.refresh_token;

      // Refresh the access token
      const refreshed = await OAuthTokenManager.refreshAccessTokenDetailed(refreshToken);
      const newAccessToken = refreshed.accessToken;
      const effectiveRefreshToken = refreshed.refreshToken || refreshToken;
      const refreshTokenRotated = !!refreshed.refreshToken && refreshed.refreshToken !== refreshToken;

      // Get token info for the new token
      let tokenInfo;
      try {
        tokenInfo = await OAuthTokenManager.getTokenInfo(newAccessToken);
      } catch (infoError) {
        console.warn('Could not get token info:', infoError);
        tokenInfo = { exp: Math.floor(Date.now() / 1000) + 3600 }; // Default 1 hour
      }

      const expiresIn = refreshed.expiresIn ?? (tokenInfo.exp ? (tokenInfo.exp - Math.floor(Date.now() / 1000)) : 3600);
      const refreshTokenFingerprint = await DatabaseTokenStorage.buildTokenFingerprint(effectiveRefreshToken);

      const storeResult = await TokenStorage.storeTokens(
        supabase,
        user.id,
        newAccessToken,
        effectiveRefreshToken,
        expiresIn,
        refreshed.scope ?? tokenInfo.scope,
        'database',
        'google'
      );

      if (!storeResult.success) {
        console.error('Token storage failed:', storeResult.error);
        throw new Error('Failed to store refreshed Google tokens.');
      }

      await DatabaseTokenStorage.incrementRefreshCount(supabase, user.id, 'google');
      await DatabaseTokenStorage.markRefreshReplay(supabase, user.id, 'google', refreshRequestId);

      const refreshMetaResult = await TokenStorage.updateRefreshMetadata(supabase, user.id);
      if (!refreshMetaResult.success) {
        console.error('Refresh metadata update failed:', refreshMetaResult.error);
        throw new Error('Failed to update token refresh metadata.');
      }

      // CRITICAL: Update the user's session with the new provider token
      try {
        await supabase.auth.admin.updateUserById(user.id, {
          app_metadata: {
            provider_token: newAccessToken,
            provider_refresh_token: effectiveRefreshToken,
            refresh_request_id: refreshRequestId,
            refresh_token_rotated_at: refreshTokenRotated ? new Date().toISOString() : null,
            refresh_token_fingerprint: refreshTokenFingerprint,
          }
        });
        console.log('Updated session provider tokens for user:', user.id);
      } catch (sessionUpdateError) {
        console.error('Failed to update session provider tokens:', sessionUpdateError);
      }

      try {
        await supabase.from('meeting_analytics').insert({
          user_id: user.id,
          event_type: 'token_refreshed',
          event_data: {
            timestamp: new Date().toISOString(),
            token_expires_in: expiresIn,
            has_scope: !!tokenInfo.scope,
            refresh_source: 'manual_refresh_endpoint',
            refresh_request_id: refreshRequestId,
            refresh_token_rotated: refreshTokenRotated,
            refresh_token_fingerprint: refreshTokenFingerprint,
          },
        });
      } catch (analyticsError) {
        console.error('Analytics logging error:', analyticsError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Token refreshed successfully',
          expires_in: expiresIn,
          expires_at: new Date(Date.now() + (expiresIn * 1000)).toISOString(),
          scope: tokenInfo.scope,
          request_id: refreshRequestId,
          refresh_token_rotated: refreshTokenRotated,
          timestamp: new Date().toISOString(),
          session_updated: true,
          action_required: 'refresh_session',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    })();

    refreshLocks.set(lockKey, refreshPromise);
    try {
      return await refreshPromise;
    } finally {
      refreshLocks.delete(lockKey);
    }

  } catch (error: any) {
    console.error('Token refresh error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to refresh token',
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
