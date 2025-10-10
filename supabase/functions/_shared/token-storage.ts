/**
 * Token Storage and Metadata Management
 * Handles persistent storage of OAuth tokens and user metadata
 */

export interface UserTokenMetadata {
  google_access_token?: string;
  google_refresh_token?: string;
  google_token_expires_at?: string;
  google_token_scope?: string;
  google_calendar_connected?: boolean;
  last_token_refresh?: string;
  token_refresh_count?: number;
}

export interface TokenStorageResult {
  success: boolean;
  error?: string;
}

export class TokenStorage {
  /**
   * Stores Google OAuth tokens in user metadata
   */
  static async storeTokens(
    supabase: any,
    userId: string,
    accessToken: string,
    refreshToken?: string,
    expiresIn?: number,
    scope?: string
  ): Promise<TokenStorageResult> {
    try {
      const expiresAt = expiresIn 
        ? new Date(Date.now() + (expiresIn * 1000)).toISOString()
        : undefined;

      const metadata: UserTokenMetadata = {
        google_access_token: accessToken,
        google_refresh_token: refreshToken,
        google_token_expires_at: expiresAt,
        google_token_scope: scope,
        google_calendar_connected: true,
        last_token_refresh: new Date().toISOString(),
      };

      // Update user metadata
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        user_metadata: metadata,
      });

      if (error) {
        throw error;
      }

      return { success: true };
    } catch (error: any) {
      console.error('Token storage error:', error);
      return {
        success: false,
        error: error.message || 'Failed to store tokens',
      };
    }
  }

  /**
   * Retrieves Google OAuth tokens from user metadata
   */
  static async getStoredTokens(
    supabase: any,
    userId: string
  ): Promise<UserTokenMetadata | null> {
    try {
      const { data: user, error } = await supabase.auth.admin.getUserById(userId);
      
      if (error || !user) {
        throw new Error('User not found');
      }

      return user.user_metadata as UserTokenMetadata;
    } catch (error: any) {
      console.error('Token retrieval error:', error);
      return null;
    }
  }

  /**
   * Updates token refresh count and timestamp
   */
  static async updateRefreshMetadata(
    supabase: any,
    userId: string
  ): Promise<TokenStorageResult> {
    try {
      const currentMetadata = await this.getStoredTokens(supabase, userId);
      const refreshCount = (currentMetadata?.token_refresh_count || 0) + 1;

      const updatedMetadata: Partial<UserTokenMetadata> = {
        ...currentMetadata,
        last_token_refresh: new Date().toISOString(),
        token_refresh_count: refreshCount,
      };

      const { error } = await supabase.auth.admin.updateUserById(userId, {
        user_metadata: updatedMetadata,
      });

      if (error) {
        throw error;
      }

      return { success: true };
    } catch (error: any) {
      console.error('Refresh metadata update error:', error);
      return {
        success: false,
        error: error.message || 'Failed to update refresh metadata',
      };
    }
  }

  /**
   * Checks if stored token is expired
   */
  static isTokenExpired(metadata: UserTokenMetadata): boolean {
    if (!metadata.google_token_expires_at) {
      return true; // Assume expired if no expiry info
    }

    const expiresAt = new Date(metadata.google_token_expires_at);
    const now = new Date();
    
    // Add 5-minute buffer to prevent edge cases
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    return expiresAt.getTime() - bufferTime <= now.getTime();
  }

  /**
   * Clears stored Google tokens (for logout/disconnect)
   */
  static async clearTokens(
    supabase: any,
    userId: string
  ): Promise<TokenStorageResult> {
    try {
      const clearedMetadata: Partial<UserTokenMetadata> = {
        google_access_token: undefined,
        google_refresh_token: undefined,
        google_token_expires_at: undefined,
        google_token_scope: undefined,
        google_calendar_connected: false,
      };

      const { error } = await supabase.auth.admin.updateUserById(userId, {
        user_metadata: clearedMetadata,
      });

      if (error) {
        throw error;
      }

      return { success: true };
    } catch (error: any) {
      console.error('Token clearing error:', error);
      return {
        success: false,
        error: error.message || 'Failed to clear tokens',
      };
    }
  }

  /**
   * Gets comprehensive token status
   */
  static async getTokenStatus(
    supabase: any,
    userId: string
  ): Promise<{
    hasTokens: boolean;
    isExpired: boolean;
    expiresAt?: Date;
    refreshCount: number;
    lastRefresh?: Date;
    scope?: string;
  }> {
    const metadata = await this.getStoredTokens(supabase, userId);
    
    if (!metadata) {
      return {
        hasTokens: false,
        isExpired: true,
        refreshCount: 0,
      };
    }

    const isExpired = this.isTokenExpired(metadata);
    const expiresAt = metadata.google_token_expires_at 
      ? new Date(metadata.google_token_expires_at)
      : undefined;
    const lastRefresh = metadata.last_token_refresh
      ? new Date(metadata.last_token_refresh)
      : undefined;

    return {
      hasTokens: !!metadata.google_access_token,
      isExpired,
      expiresAt,
      refreshCount: metadata.token_refresh_count || 0,
      lastRefresh,
      scope: metadata.google_token_scope,
    };
  }
}

/**
 * Alternative storage using a dedicated tokens table
 * Use this if user metadata approach has limitations
 */
export class DatabaseTokenStorage {
  /**
   * Creates the oauth_tokens table if it doesn't exist
   */
  static async createTokensTable(supabase: any): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS oauth_tokens (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        provider VARCHAR(50) NOT NULL,
        access_token TEXT,
        refresh_token TEXT,
        expires_at TIMESTAMP WITH TIME ZONE,
        scope TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        refresh_count INTEGER DEFAULT 0,
        UNIQUE(user_id, provider)
      );

      -- Enable RLS
      ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;

      -- Create RLS policies
      CREATE POLICY "Users can manage their own tokens" ON oauth_tokens
        FOR ALL USING (auth.uid() = user_id);

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_provider 
        ON oauth_tokens(user_id, provider);
      CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires_at 
        ON oauth_tokens(expires_at);
    `;

    await supabase.rpc('exec_sql', { sql: createTableSQL });
  }

  /**
   * Stores tokens in dedicated table
   */
  static async storeTokens(
    supabase: any,
    userId: string,
    provider: string,
    accessToken: string,
    refreshToken?: string,
    expiresIn?: number,
    scope?: string
  ): Promise<TokenStorageResult> {
    try {
      const expiresAt = expiresIn 
        ? new Date(Date.now() + (expiresIn * 1000)).toISOString()
        : null;

      const { error } = await supabase
        .from('oauth_tokens')
        .upsert({
          user_id: userId,
          provider,
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt,
          scope,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        throw error;
      }

      return { success: true };
    } catch (error: any) {
      console.error('Database token storage error:', error);
      return {
        success: false,
        error: error.message || 'Failed to store tokens in database',
      };
    }
  }

  /**
   * Retrieves tokens from dedicated table
   */
  static async getTokens(
    supabase: any,
    userId: string,
    provider: string
  ): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('oauth_tokens')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', provider)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found is ok
        throw error;
      }

      return data;
    } catch (error: any) {
      console.error('Database token retrieval error:', error);
      return null;
    }
  }

  /**
   * Updates refresh count
   */
  static async incrementRefreshCount(
    supabase: any,
    userId: string,
    provider: string
  ): Promise<void> {
    await supabase
      .from('oauth_tokens')
      .update({
        refresh_count: supabase.rpc('increment_refresh_count'),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('provider', provider);
  }
}
