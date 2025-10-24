/**
 * Token Synchronization Utilities
 * 
 * Provides mechanisms to synchronize OAuth tokens between backend and frontend,
 * ensuring that refreshed tokens are properly propagated to the user's session.
 */

import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

const SUPABASE_URL = "https://vbrxgaxjmpwusbbbzzgl.supabase.co";

export interface TokenSyncResult {
  success: boolean;
  tokenRefreshed: boolean;
  error?: string;
}

/**
 * Check if tokens need to be refreshed based on user metadata
 */
export async function checkTokenRefreshNeeded(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const metadata = user.user_metadata;
    if (!metadata) return false;

    // Check if token expires soon (within 10 minutes)
    if (metadata.google_token_expires_at) {
      const expiresAt = new Date(metadata.google_token_expires_at);
      const now = new Date();
      const tenMinutes = 10 * 60 * 1000;
      
      if (expiresAt.getTime() - now.getTime() < tenMinutes) {
        logger.log('Token expires soon, refresh recommended');
        return true;
      }
    }

    return false;
  } catch (error) {
    logger.error('Error checking token refresh need:', error);
    return false;
  }
}

/**
 * Synchronize tokens from backend to frontend session
 * This should be called after backend operations that may have refreshed tokens
 */
export async function syncTokens(): Promise<TokenSyncResult> {
  try {
    logger.log('Syncing tokens from backend...');

    // Get current session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return {
        success: false,
        tokenRefreshed: false,
        error: 'No active session',
      };
    }

    // Check token status from backend
    const statusResponse = await fetch(`${SUPABASE_URL}/functions/v1/get-token-status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!statusResponse.ok) {
      throw new Error(`Failed to get token status: ${statusResponse.status}`);
    }

    const statusData = await statusResponse.json();
    
    // If token was refreshed on backend, sync with frontend
    if (statusData.tokenStatus?.isValid && !statusData.tokenStatus?.isExpired) {
      // Refresh the Supabase session to get updated tokens
      const { error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        logger.error('Failed to refresh session during sync:', refreshError);
        return {
          success: false,
          tokenRefreshed: false,
          error: refreshError.message,
        };
      }

      logger.log('Tokens synchronized successfully');
      return {
        success: true,
        tokenRefreshed: true,
      };
    }

    return {
      success: true,
      tokenRefreshed: false,
    };
  } catch (error: any) {
    logger.error('Token sync error:', error);
    return {
      success: false,
      tokenRefreshed: false,
      error: error.message,
    };
  }
}

/**
 * Set up automatic token synchronization
 * Checks for token updates periodically and after certain events
 */
export function setupTokenSync(intervalMs: number = 60000): () => void {
  logger.log('Setting up automatic token synchronization');

  // Periodic check for token refresh needs (removed auth state listener to prevent duplicates)
  const intervalId = setInterval(async () => {
    const needsRefresh = await checkTokenRefreshNeeded();
    if (needsRefresh) {
      logger.log('Proactive token refresh triggered');
      await syncTokens();
    }
  }, intervalMs);

  // Return cleanup function
  return () => {
    logger.log('Cleaning up token synchronization');
    clearInterval(intervalId);
  };
}

/**
 * Notify token sync of auth state changes
 * Call this from auth state change handlers instead of setting up duplicate listeners
 */
export async function notifyAuthStateChange(event: string, session: any): Promise<void> {
  if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
    logger.log('Auth state changed, syncing tokens:', event);
    await syncTokens();
  }
}

/**
 * Force an immediate token refresh and sync
 */
export async function forceTokenRefresh(): Promise<TokenSyncResult> {
  try {
    logger.log('Forcing token refresh...');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return {
        success: false,
        tokenRefreshed: false,
        error: 'No active session',
      };
    }

    // Call backend to refresh token
    const response = await fetch(`${SUPABASE_URL}/functions/v1/refresh-google-token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Token refresh failed');
    }

    // Sync the refreshed token with frontend
    await syncTokens();

    logger.log('Token force refresh completed');
    return {
      success: true,
      tokenRefreshed: true,
    };
  } catch (error: any) {
    logger.error('Force token refresh error:', error);
    return {
      success: false,
      tokenRefreshed: false,
      error: error.message,
    };
  }
}
