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

const MIN_REFRESH_INTERVAL_SECONDS = 60;
const REFRESH_THRESHOLD_MIN = 6;
const REFRESH_THRESHOLD_MAX = 12;

const stableHash = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
};

const jitteredThresholdMinutesForUser = (userId: string): number => {
  const spread = REFRESH_THRESHOLD_MAX - REFRESH_THRESHOLD_MIN;
  if (spread <= 0) return REFRESH_THRESHOLD_MIN;
  return REFRESH_THRESHOLD_MIN + (stableHash(userId) % (spread + 1));
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

    const thresholdMinutes = jitteredThresholdMinutesForUser(user.id);
    const nowMs = Date.now();
    const elapsedSinceLastRefreshSeconds = tokenStatus.lastRefresh
      ? Math.floor((nowMs - tokenStatus.lastRefresh.getTime()) / 1000)
      : Number.MAX_SAFE_INTEGER;
    const minIntervalSatisfied = elapsedSinceLastRefreshSeconds >= MIN_REFRESH_INTERVAL_SECONDS;
    const shouldRefresh = tokenStatus.hasTokens
      && tokenStatus.isValid
      && tokenStatus.expiresInMinutes <= thresholdMinutes
      && minIntervalSatisfied;

    return new Response(
      JSON.stringify({
        success: true,
        tokenStatus,
        refreshPolicy: {
          authority: 'backend',
          shouldRefreshNow: shouldRefresh,
          thresholdMinutes,
          minRefreshIntervalSeconds: MIN_REFRESH_INTERVAL_SECONDS,
          elapsedSinceLastRefreshSeconds,
        },
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
