import { supabase } from "@/integrations/supabase/client";

export interface TokenInfo {
  hasSession: boolean;
  hasProviderToken: boolean;
  hasRefreshToken: boolean;
  tokenPreview?: string;
  refreshTokenPreview?: string;
  userEmail?: string;
  googleIdentity?: boolean;
  tokenExpiry?: Date;
  scopes?: string[];
}

export class TokenDebugger {
  static async getTokenInfo(): Promise<TokenInfo> {
    try {
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        return { hasSession: false, hasProviderToken: false, hasRefreshToken: false };
      }

      if (!session) {
        return { hasSession: false, hasProviderToken: false, hasRefreshToken: false };
      }

      // Get user info
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      const tokenInfo: TokenInfo = {
        hasSession: true,
        hasProviderToken: !!session.provider_token,
        hasRefreshToken: !!session.provider_refresh_token,
        userEmail: user?.email,
        googleIdentity: user?.identities?.some(identity => identity.provider === 'google'),
      };

      // Add token previews (first 20 chars for security)
      if (session.provider_token) {
        tokenInfo.tokenPreview = session.provider_token.substring(0, 20) + '...';
        
        // Try to decode token expiry (if it's a JWT)
        try {
          const tokenParts = session.provider_token.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            if (payload.exp) {
              tokenInfo.tokenExpiry = new Date(payload.exp * 1000);
            }
            if (payload.scope) {
              tokenInfo.scopes = payload.scope.split(' ');
            }
          }
        } catch (e) {
          // Not a JWT, that's fine for Google access tokens
        }
      }

      if (session.provider_refresh_token) {
        tokenInfo.refreshTokenPreview = session.provider_refresh_token.substring(0, 20) + '...';
      }

      return tokenInfo;
    } catch (error) {
      console.error('Error getting token info:', error);
      return { hasSession: false, hasProviderToken: false, hasRefreshToken: false };
    }
  }

  static async logTokenStatus(): Promise<void> {
    const tokenInfo = await this.getTokenInfo();
    
    console.group('🔐 Google Calendar Token Status');
    console.log('📋 Session Status:', tokenInfo.hasSession ? '✅ Active' : '❌ No Session');
    console.log('🎫 Provider Token:', tokenInfo.hasProviderToken ? '✅ Available' : '❌ Missing');
    console.log('🔄 Refresh Token:', tokenInfo.hasRefreshToken ? '✅ Available' : '❌ Missing');
    console.log('👤 User Email:', tokenInfo.userEmail || 'N/A');
    console.log('🔗 Google Identity:', tokenInfo.googleIdentity ? '✅ Linked' : '❌ Not Linked');
    
    if (tokenInfo.tokenPreview) {
      console.log('🎫 Token Preview:', tokenInfo.tokenPreview);
    }
    
    if (tokenInfo.refreshTokenPreview) {
      console.log('🔄 Refresh Token Preview:', tokenInfo.refreshTokenPreview);
    }
    
    if (tokenInfo.tokenExpiry) {
      const isExpired = tokenInfo.tokenExpiry < new Date();
      console.log('⏰ Token Expiry:', tokenInfo.tokenExpiry.toISOString(), isExpired ? '❌ EXPIRED' : '✅ Valid');
    }
    
    if (tokenInfo.scopes) {
      console.log('🔐 Token Scopes:', tokenInfo.scopes);
    }
    
    console.groupEnd();
  }

  static async testCalendarAccess(): Promise<boolean> {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.provider_token) {
        console.error('❌ No provider token available');
        return false;
      }

      // Test a simple Calendar API call with the actual token
      const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: {
          'Authorization': `Bearer ${session.provider_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        console.log('✅ Calendar API access successful');
        return true;
      } else {
        const errorText = await response.text();
        console.error('❌ Calendar API access failed:', response.status, response.statusText, errorText);
        return false;
      }
    } catch (error) {
      console.error('❌ Calendar API test failed:', error);
      return false;
    }
  }
}

// Helper function to add to window for debugging
export const addTokenDebugToWindow = () => {
  if (typeof window !== 'undefined') {
    (window as any).tokenDebug = {
      getInfo: TokenDebugger.getTokenInfo,
      logStatus: TokenDebugger.logTokenStatus,
      testAccess: TokenDebugger.testCalendarAccess,
    };
    console.log('🔧 Token debug tools added to window.tokenDebug');
  }
};
