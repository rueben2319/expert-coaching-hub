// @ts-ignore: Deno imports work at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno imports work at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { OAuthTokenManager } from "../_shared/oauth-token-manager.ts";
import { TokenStorage } from "../_shared/token-storage.ts";

// Deno global type declaration for IDE
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Invalid authentication token');
    }

    // Get user's session to access provider tokens
    const { data: session, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.session?.provider_refresh_token) {
      throw new Error('No valid Google OAuth session found. Please sign in with Google again.');
    }

    const { accessToken, refreshToken } = OAuthTokenManager.extractTokensFromSession(session);
    
    if (!refreshToken) {
      throw new Error('No refresh token available. Please sign in with Google again.');
    }

    // Refresh the access token
    const newAccessToken = await OAuthTokenManager.refreshAccessToken(refreshToken);

    // Get token info for the new token
    let tokenInfo;
    try {
      tokenInfo = await OAuthTokenManager.getTokenInfo(newAccessToken);
    } catch (infoError) {
      console.warn('Could not get token info:', infoError);
      tokenInfo = { exp: Math.floor(Date.now() / 1000) + 3600 }; // Default 1 hour
    }

    // Store the new token in user metadata
    const expiresIn = tokenInfo.exp ? (tokenInfo.exp - Math.floor(Date.now() / 1000)) : 3600;
    
    await TokenStorage.storeTokens(
      supabase,
      user.id,
      newAccessToken,
      refreshToken,
      expiresIn,
      tokenInfo.scope
    );

    // Update refresh metadata
    await TokenStorage.updateRefreshMetadata(supabase, user.id);

    // Log analytics event
    try {
      await supabase.from('meeting_analytics').insert({
        user_id: user.id,
        event_type: 'token_refreshed',
        event_data: {
          timestamp: new Date().toISOString(),
          token_expires_in: expiresIn,
          has_scope: !!tokenInfo.scope,
          refresh_source: 'manual_refresh_endpoint',
        },
      });
    } catch (analyticsError) {
      console.error('Analytics logging error:', analyticsError);
      // Don't fail the request if analytics fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Token refreshed successfully',
        expires_in: expiresIn,
        expires_at: new Date(Date.now() + (expiresIn * 1000)).toISOString(),
        scope: tokenInfo.scope,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

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
