/**
 * Centralized OAuth Token Management for Google APIs
 * Handles token refresh, validation, and storage across all Edge Functions
 */

// Deno global type declaration for IDE
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

export interface TokenInfo {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
  scope?: string;
}

export interface TokenValidationResult {
  isValid: boolean;
  token: string;
  refreshed: boolean;
  error?: string;
}

export class OAuthTokenManager {
  private static readonly GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
  private static readonly GOOGLE_TOKENINFO_ENDPOINT = 'https://oauth2.googleapis.com/tokeninfo';
  
  /**
   * Validates and refreshes Google OAuth token if needed
   */
  static async validateAndRefreshToken(
    accessToken: string,
    refreshToken?: string
  ): Promise<TokenValidationResult> {
    try {
      // First, try to validate the current token
      const isValid = await this.validateToken(accessToken);
      
      if (isValid) {
        return {
          isValid: true,
          token: accessToken,
          refreshed: false,
        };
      }

      // Token is invalid/expired, try to refresh
      if (!refreshToken) {
        return {
          isValid: false,
          token: accessToken,
          refreshed: false,
          error: 'Token expired and no refresh token available',
        };
      }

      const newToken = await this.refreshAccessToken(refreshToken);
      return {
        isValid: true,
        token: newToken,
        refreshed: true,
      };

    } catch (error: any) {
      return {
        isValid: false,
        token: accessToken,
        refreshed: false,
        error: error.message || 'Token validation failed',
      };
    }
  }

  /**
   * Validates a Google OAuth token
   */
  private static async validateToken(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.GOOGLE_TOKENINFO_ENDPOINT}?access_token=${accessToken}`
      );
      
      if (!response.ok) {
        return false;
      }

      const tokenInfo = await response.json();
      
      // Check if token has required scopes for calendar access
      const requiredScopes = [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
      ];
      
      const tokenScopes = tokenInfo.scope?.split(' ') || [];
      const hasRequiredScopes = requiredScopes.some(scope => 
        tokenScopes.some(tokenScope => tokenScope.includes('calendar'))
      );

      return hasRequiredScopes && tokenInfo.exp > Math.floor(Date.now() / 1000);
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }

  /**
   * Refreshes Google OAuth access token using refresh token
   */
  static async refreshAccessToken(refreshToken: string): Promise<string> {
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    
    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured');
    }

    const response = await fetch(this.GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Token refresh failed: ${errorData.error_description || response.statusText}`);
    }

    const tokenData: TokenInfo = await response.json();
    
    if (!tokenData.access_token) {
      throw new Error('No access token in refresh response');
    }

    return tokenData.access_token;
  }

  /**
   * Makes authenticated Google API request with automatic token refresh
   */
  static async makeAuthenticatedRequest(
    url: string,
    options: RequestInit,
    accessToken: string,
    refreshToken?: string,
    retryCount = 0
  ): Promise<Response> {
    const maxRetries = 1;
    
    // Add authorization header
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${accessToken}`,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // If unauthorized and we have a refresh token, try to refresh and retry
    if (response.status === 401 && refreshToken && retryCount < maxRetries) {
      try {
        const newAccessToken = await this.refreshAccessToken(refreshToken);
        
        // Retry with new token
        return this.makeAuthenticatedRequest(
          url, 
          options, 
          newAccessToken, 
          refreshToken, 
          retryCount + 1
        );
      } catch (refreshError) {
        console.error('Token refresh failed during API request:', refreshError);
        // Return original response if refresh fails
        return response;
      }
    }

    return response;
  }

  /**
   * Extracts tokens from Supabase session
   */
  static extractTokensFromSession(session: any): {
    accessToken?: string;
    refreshToken?: string;
  } {
    return {
      accessToken: session?.session?.provider_token,
      refreshToken: session?.session?.provider_refresh_token,
    };
  }

  /**
   * Checks if user has valid Google OAuth session
   */
  static validateSession(session: any): boolean {
    const { accessToken } = this.extractTokensFromSession(session);
    return !!accessToken;
  }

  /**
   * Gets token expiry information
   */
  static async getTokenInfo(accessToken: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.GOOGLE_TOKENINFO_ENDPOINT}?access_token=${accessToken}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to get token info');
      }

      return await response.json();
    } catch (error) {
      console.error('Get token info error:', error);
      throw error;
    }
  }

  /**
   * Calculates token expiry time
   */
  static calculateTokenExpiry(tokenInfo: any): {
    expiresAt: Date;
    isExpired: boolean;
    expiresInMinutes: number;
  } {
    const expiresAt = new Date(tokenInfo.exp * 1000);
    const now = new Date();
    const isExpired = expiresAt <= now;
    const expiresInMinutes = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60));

    return {
      expiresAt,
      isExpired,
      expiresInMinutes,
    };
  }
}

/**
 * Utility function for Edge Functions to get validated tokens
 */
export async function getValidatedGoogleToken(supabase: any): Promise<{
  accessToken: string;
  refreshToken?: string;
  wasRefreshed: boolean;
}> {
  // Get user session
  const { data: session, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !OAuthTokenManager.validateSession(session)) {
    throw new Error('No valid Google OAuth session found. Please sign in with Google again.');
  }

  const { accessToken, refreshToken } = OAuthTokenManager.extractTokensFromSession(session);
  
  if (!accessToken) {
    throw new Error('No access token found in session');
  }

  // Validate and refresh if needed
  const result = await OAuthTokenManager.validateAndRefreshToken(accessToken, refreshToken);
  
  if (!result.isValid) {
    throw new Error(result.error || 'Failed to validate or refresh token');
  }

  return {
    accessToken: result.token,
    refreshToken,
    wasRefreshed: result.refreshed,
  };
}
