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

    // Get user's session to access provider tokens
    const { data: session, error: sessionError } = await supabase.auth.getSession();
    
    let tokenStatus = {
      hasTokens: false,
      isExpired: true,
      expiresAt: null as Date | null,
      refreshCount: 0,
      lastRefresh: null as Date | null,
      scope: null as string | null,
      isValid: false,
      expiresInMinutes: 0,
    };

    if (!sessionError && session?.session?.provider_token) {
      const { accessToken, refreshToken } = OAuthTokenManager.extractTokensFromSession(session);
      
      if (accessToken) {
        try {
          let currentAccessToken = accessToken;
          let tokenInfo: any | null = null;

          try {
            tokenInfo = await OAuthTokenManager.getTokenInfo(currentAccessToken);
          } catch (infoError) {
            console.warn('Could not fetch token info:', infoError);
          }

          const validationResult = await OAuthTokenManager.validateAndRefreshToken(
            currentAccessToken,
            refreshToken
          );

          if (!validationResult.isValid) {
            throw new Error(validationResult.error || 'Google token validation failed');
          }

          currentAccessToken = validationResult.token;

          if (validationResult.refreshed) {
            try {
              tokenInfo = await OAuthTokenManager.getTokenInfo(currentAccessToken);
            } catch (refetchError) {
              console.warn('Could not fetch refreshed token info:', refetchError);
              tokenInfo = null;
            }

            const expiresInSeconds = tokenInfo?.exp
              ? Math.max(tokenInfo.exp - Math.floor(Date.now() / 1000), 0)
              : undefined;

            const storeResult = await TokenStorage.storeTokens(
              supabase,
              user.id,
              currentAccessToken,
              refreshToken,
              expiresInSeconds,
              tokenInfo?.scope
            );

            if (!storeResult.success) {
              console.error('Token storage failed:', storeResult.error);
              throw new Error('Failed to persist refreshed Google token');
            }

            const refreshMetaResult = await TokenStorage.updateRefreshMetadata(supabase, user.id);
            if (!refreshMetaResult.success) {
              console.error('Refresh metadata update failed:', refreshMetaResult.error);
              throw new Error('Failed to update token metadata');
            }
          }

          const expiryInfo = tokenInfo
            ? OAuthTokenManager.calculateTokenExpiry(tokenInfo)
            : null;

          tokenStatus = {
            hasTokens: true,
            isExpired: expiryInfo ? expiryInfo.isExpired : true,
            expiresAt: expiryInfo ? expiryInfo.expiresAt : null,
            refreshCount: 0,
            lastRefresh: null,
            scope: tokenInfo?.scope,
            isValid: validationResult.isValid,
            expiresInMinutes: expiryInfo ? expiryInfo.expiresInMinutes : 0,
          };

          // Try to get additional metadata from user profile
          try {
            const { data: profile } = await supabase.auth.admin.getUserById(user.id);
            if (profile?.user?.user_metadata) {
              const metadata = profile.user.user_metadata;
              tokenStatus.refreshCount = metadata.token_refresh_count || 0;
              tokenStatus.lastRefresh = metadata.last_token_refresh 
                ? new Date(metadata.last_token_refresh) 
                : null;
            }
          } catch (metadataError) {
            console.warn('Could not fetch user metadata:', metadataError);
          }

        } catch (tokenError) {
          console.error('Token validation error:', tokenError);
          tokenStatus.hasTokens = true;
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
