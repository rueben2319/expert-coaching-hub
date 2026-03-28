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
  'Access-Control-Allow-Methods': 'OPTIONS, GET',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'GET') {
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

    // Start from encrypted database token status as source of truth
    const dbStatus = await TokenStorage.getTokenStatus(supabase, user.id, 'database', 'google');

    let tokenStatus = {
      hasTokens: dbStatus.hasTokens,
      isExpired: dbStatus.isExpired,
      expiresAt: dbStatus.expiresAt ?? null as Date | null,
      refreshCount: dbStatus.refreshCount,
      lastRefresh: dbStatus.lastRefresh ?? null as Date | null,
      scope: dbStatus.scope ?? null as string | null,
      isValid: dbStatus.hasTokens && !dbStatus.isExpired,
      expiresInMinutes: dbStatus.expiresAt
        ? Math.max(Math.floor((dbStatus.expiresAt.getTime() - Date.now()) / 60000), 0)
        : 0,
    };

    // If session has provider token, validate and backfill encrypted storage when needed.
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (!sessionError && sessionData?.session?.provider_token) {
      const { accessToken, refreshToken } = OAuthTokenManager.extractTokensFromSession(sessionData);

      if (accessToken) {
        try {
          const validationResult = await OAuthTokenManager.validateAndRefreshToken(
            accessToken,
            refreshToken
          );

          if (!validationResult.isValid) {
            throw new Error(validationResult.error || 'Google token validation failed');
          }

          const tokenInfo = await OAuthTokenManager.getTokenInfo(validationResult.token).catch(() => null);
          const expiresInSeconds = tokenInfo?.exp
            ? Math.max(tokenInfo.exp - Math.floor(Date.now() / 1000), 0)
            : undefined;

          // Persist latest token state to encrypted database storage.
          const storeResult = await TokenStorage.storeTokens(
            supabase,
            user.id,
            validationResult.token,
            refreshToken,
            expiresInSeconds,
            tokenInfo?.scope,
            'database',
            'google'
          );

          if (!storeResult.success) {
            console.error('Token storage failed:', storeResult.error);
          }

          if (validationResult.refreshed) {
            await TokenStorage.updateRefreshMetadata(supabase, user.id);
            await DatabaseTokenStorage.incrementRefreshCount(supabase, user.id, 'google');
          }

          const refreshedStatus = await TokenStorage.getTokenStatus(supabase, user.id, 'database', 'google');
          tokenStatus = {
            hasTokens: refreshedStatus.hasTokens,
            isExpired: refreshedStatus.isExpired,
            expiresAt: refreshedStatus.expiresAt ?? null,
            refreshCount: refreshedStatus.refreshCount,
            lastRefresh: refreshedStatus.lastRefresh ?? null,
            scope: refreshedStatus.scope ?? null,
            isValid: validationResult.isValid && !refreshedStatus.isExpired,
            expiresInMinutes: refreshedStatus.expiresAt
              ? Math.max(Math.floor((refreshedStatus.expiresAt.getTime() - Date.now()) / 60000), 0)
              : 0,
          };
        } catch (tokenError) {
          console.error('Token validation error:', tokenError);
          tokenStatus.isValid = false;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        tokenStatus,
        user_id: user.id,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Get token status error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to get token status',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
