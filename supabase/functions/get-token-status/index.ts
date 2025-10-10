// @ts-ignore: Deno imports work at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno imports work at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { OAuthTokenManager } from "../_shared/oauth-token-manager.ts";

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
          // Get detailed token information
          const tokenInfo = await OAuthTokenManager.getTokenInfo(accessToken);
          const expiryInfo = OAuthTokenManager.calculateTokenExpiry(tokenInfo);
          
          // Validate token
          const validationResult = await OAuthTokenManager.validateAndRefreshToken(
            accessToken, 
            refreshToken
          );

          tokenStatus = {
            hasTokens: true,
            isExpired: expiryInfo.isExpired,
            expiresAt: expiryInfo.expiresAt,
            refreshCount: 0, // Would need to get from metadata/database
            lastRefresh: null, // Would need to get from metadata/database
            scope: tokenInfo.scope,
            isValid: validationResult.isValid,
            expiresInMinutes: expiryInfo.expiresInMinutes,
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
          tokenStatus.hasTokens = true; // We have a token, but it might be invalid
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
