/**
 * Token Storage and Metadata Management
 * Handles persistent storage of OAuth tokens and user metadata.
 */

// @ts-ignore: Deno imports work at runtime
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

// Deno global type declaration for IDE support when used in Edge Functions
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

type TokenStorageStrategy = "metadata" | "database";
const DEFAULT_PROVIDER = "google";

interface TokenStatusSummary {
  hasTokens: boolean;
  isExpired: boolean;
  expiresAt?: Date;
  refreshCount: number;
  lastRefresh?: Date;
  scope?: string;
}

interface TokenRecord {
  id?: string;
  user_id: string;
  provider: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  scope: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  refresh_count?: number | null;
  last_refresh_request_id?: string | null;
  refresh_token_rotated_at?: string | null;
  refresh_token_fingerprint?: string | null;
}

interface DbTokenRow {
  id?: string;
  user_id: string;
  provider: string;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  expires_at: string | null;
  scope: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  refresh_count?: number | null;
  last_refresh_request_id?: string | null;
  refresh_token_rotated_at?: string | null;
  refresh_token_fingerprint?: string | null;
}

export interface TokenRotationMetadata {
  refreshRequestId?: string;
  refreshTokenRotatedAt?: string;
  refreshTokenFingerprint?: string;
}

const resolveStrategy = (explicit?: TokenStorageStrategy): TokenStorageStrategy => {
  if (explicit) return explicit;
  try {
    const fromEnv = typeof Deno !== "undefined" ? Deno.env.get("TOKEN_STORAGE_STRATEGY") : undefined;
    if (!fromEnv) {
      return "database";
    }
    return fromEnv.toLowerCase() === "metadata" ? "metadata" : "database";
  } catch {
    return "database";
  }
};

export interface UserTokenMetadata {
  google_calendar_connected?: boolean;
  google_token_expires_at?: string;
  last_token_refresh?: string;
  token_refresh_count?: number;
}

export interface TokenStorageResult {
  success: boolean;
  error?: string;
}

export class TokenStorage {
  /**
   * Stores Google OAuth tokens.
   * Defaults to encrypted database-backed storage.
   */
  static async storeTokens(
    supabase: SupabaseClient,
    userId: string,
    accessToken: string,
    refreshToken?: string,
    expiresIn?: number,
    scope?: string,
    strategy?: TokenStorageStrategy,
    provider: string = DEFAULT_PROVIDER
  ): Promise<TokenStorageResult> {
    const resolved = resolveStrategy(strategy);

    if (resolved === "database") {
      const dbResult = await DatabaseTokenStorage.storeTokens(
        supabase,
        userId,
        provider,
        accessToken,
        refreshToken,
        expiresIn,
        scope
      );

      if (!dbResult.success) {
        return dbResult;
      }

      return this.updateConnectionMetadata(supabase, userId, expiresIn);
    }

    // Metadata fallback mode intentionally does NOT store raw tokens.
    return this.updateConnectionMetadata(supabase, userId, expiresIn);
  }

  /**
   * Retrieves user token-related metadata only (no raw token values).
   */
  static async getStoredTokens(
    supabase: SupabaseClient,
    userId: string
  ): Promise<UserTokenMetadata | null> {
    try {
      const { data: user, error } = await supabase.auth.admin.getUserById(userId);

      if (error || !user || !user.user) {
        throw new Error('User not found');
      }

      return (user.user as any).user_metadata as UserTokenMetadata;
    } catch (error: any) {
      console.error('Token metadata retrieval error:', error);
      return null;
    }
  }

  /**
   * Updates token refresh count and timestamp in metadata.
   */
  static async updateRefreshMetadata(
    supabase: SupabaseClient,
    userId: string
  ): Promise<TokenStorageResult> {
    try {
      const currentMetadata = await this.getStoredTokens(supabase, userId);
      const refreshCount = (currentMetadata?.token_refresh_count || 0) + 1;

      const updatedMetadata: Partial<UserTokenMetadata> = {
        ...(currentMetadata ?? {}),
        google_calendar_connected: true,
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
   * Checks if stored token metadata indicates expiry.
   */
  static isTokenExpired(metadata: UserTokenMetadata): boolean {
    if (!metadata.google_token_expires_at) {
      return true; // Assume expired if no expiry info
    }

    const expiresAt = new Date(metadata.google_token_expires_at);
    const now = new Date();

    // Add 5-minute buffer to prevent edge cases
    const bufferTime = 5 * 60 * 1000;

    return expiresAt.getTime() - bufferTime <= now.getTime();
  }

  /**
   * Clears stored Google token references.
   */
  static async clearTokens(
    supabase: SupabaseClient,
    userId: string,
    strategy?: TokenStorageStrategy,
    provider: string = DEFAULT_PROVIDER
  ): Promise<TokenStorageResult> {
    const resolved = resolveStrategy(strategy);

    try {
      if (resolved === "database") {
        await DatabaseTokenStorage.deleteTokenRecord(supabase, userId, provider);
      }

      const clearedMetadata: Partial<UserTokenMetadata> = {
        google_calendar_connected: false,
        google_token_expires_at: undefined,
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
   * Gets comprehensive token status.
   */
  static async getTokenStatus(
    supabase: SupabaseClient,
    userId: string,
    strategy?: TokenStorageStrategy,
    provider: string = DEFAULT_PROVIDER
  ): Promise<TokenStatusSummary> {
    const resolved = resolveStrategy(strategy);
    if (resolved === "database") {
      return DatabaseTokenStorage.getTokenStatusFromDB(supabase, userId, provider);
    }
    return this.getTokenStatusFromMetadata(supabase, userId);
  }

  private static async updateConnectionMetadata(
    supabase: SupabaseClient,
    userId: string,
    expiresIn?: number
  ): Promise<TokenStorageResult> {
    try {
      const currentMetadata = await this.getStoredTokens(supabase, userId);
      const updatedMetadata: Partial<UserTokenMetadata> = {
        ...(currentMetadata ?? {}),
        google_calendar_connected: true,
        google_token_expires_at: expiresIn
          ? new Date(Date.now() + (expiresIn * 1000)).toISOString()
          : currentMetadata?.google_token_expires_at,
        last_token_refresh: new Date().toISOString(),
      };

      const { error } = await supabase.auth.admin.updateUserById(userId, {
        user_metadata: updatedMetadata,
      });

      if (error) {
        throw error;
      }

      return { success: true };
    } catch (error: any) {
      console.error('Metadata update error:', error);
      return {
        success: false,
        error: error.message || 'Failed to update token metadata',
      };
    }
  }

  private static async getTokenStatusFromMetadata(
    supabase: SupabaseClient,
    userId: string
  ): Promise<TokenStatusSummary> {
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
      hasTokens: !!metadata.google_calendar_connected,
      isExpired,
      expiresAt,
      refreshCount: metadata.token_refresh_count || 0,
      lastRefresh,
    };
  }
}

/**
 * Database-backed token storage.
 * Tokens are encrypted before being written to the database.
 */
export class DatabaseTokenStorage {
  private static cachedKeyPromise: Promise<CryptoKey> | null = null;

  private static async getEncryptionKey(): Promise<CryptoKey> {
    if (!this.cachedKeyPromise) {
      this.cachedKeyPromise = (async () => {
        const rawSecret = Deno.env.get('TOKEN_STORAGE_ENCRYPTION_KEY');
        if (!rawSecret) {
          throw new Error('TOKEN_STORAGE_ENCRYPTION_KEY is not configured');
        }

        const keyMaterial = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(rawSecret)
        );

        return crypto.subtle.importKey(
          'raw',
          keyMaterial,
          { name: 'AES-GCM' },
          false,
          ['encrypt', 'decrypt']
        );
      })();
    }

    return this.cachedKeyPromise;
  }

  private static bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private static base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  private static async encrypt(plainText: string): Promise<string> {
    const key = await this.getEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(plainText)
    );

    return `${this.bytesToBase64(iv)}:${this.bytesToBase64(new Uint8Array(encrypted))}`;
  }

  private static async decrypt(cipherText: string): Promise<string> {
    const key = await this.getEncryptionKey();
    const [ivB64, payloadB64] = cipherText.split(':');

    if (!ivB64 || !payloadB64) {
      throw new Error('Invalid encrypted token format');
    }

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: this.base64ToBytes(ivB64) },
      key,
      this.base64ToBytes(payloadB64)
    );

    return new TextDecoder().decode(decrypted);
  }

  /**
   * Stores tokens in dedicated table.
   */
  static async storeTokens(
    supabase: SupabaseClient,
    userId: string,
    provider: string,
    accessToken: string,
    refreshToken?: string,
    expiresIn?: number,
    scope?: string,
    rotationMetadata?: TokenRotationMetadata
  ): Promise<TokenStorageResult> {
    try {
      const expiresAt = expiresIn
        ? new Date(Date.now() + (expiresIn * 1000)).toISOString()
        : null;

      const encryptedAccessToken = await this.encrypt(accessToken);
      const encryptedRefreshToken = refreshToken ? await this.encrypt(refreshToken) : null;

      const { error } = await (supabase.from('oauth_tokens') as any)
        .upsert({
          user_id: userId,
          provider,
          access_token_encrypted: encryptedAccessToken,
          refresh_token_encrypted: encryptedRefreshToken,
          expires_at: expiresAt,
          scope,
          last_refresh_request_id: rotationMetadata?.refreshRequestId ?? null,
          refresh_token_rotated_at: rotationMetadata?.refreshTokenRotatedAt ?? null,
          refresh_token_fingerprint: rotationMetadata?.refreshTokenFingerprint ?? null,
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
   * Retrieves decrypted tokens from dedicated table.
   */
  static async getTokenRecord(
    supabase: SupabaseClient,
    userId: string,
    provider: string
  ): Promise<TokenRecord | null> {
    try {
      const { data, error } = await (supabase.from('oauth_tokens') as any)
        .select('*')
        .eq('user_id', userId)
        .eq('provider', provider)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      const row = (data as DbTokenRow) ?? null;
      if (!row) {
        return null;
      }

      return {
        id: row.id,
        user_id: row.user_id,
        provider: row.provider,
        access_token: row.access_token_encrypted ? await this.decrypt(row.access_token_encrypted) : null,
        refresh_token: row.refresh_token_encrypted ? await this.decrypt(row.refresh_token_encrypted) : null,
        expires_at: row.expires_at,
        scope: row.scope,
        created_at: row.created_at,
        updated_at: row.updated_at,
        refresh_count: row.refresh_count,
        last_refresh_request_id: row.last_refresh_request_id,
        refresh_token_rotated_at: row.refresh_token_rotated_at,
        refresh_token_fingerprint: row.refresh_token_fingerprint,
      };
    } catch (error: any) {
      console.error('Database token retrieval error:', error);
      return null;
    }
  }

  /**
   * Gets comprehensive token status using database-backed storage.
   */
  static async getTokenStatusFromDB(
    supabase: SupabaseClient,
    userId: string,
    provider: string = DEFAULT_PROVIDER
  ): Promise<TokenStatusSummary> {
    const { data, error } = await (supabase.from('oauth_tokens') as any)
      .select('expires_at, updated_at, refresh_count, scope, access_token_encrypted')
      .eq('user_id', userId)
      .eq('provider', provider)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Database token status retrieval error:', error);
    }

    if (!data || !data.access_token_encrypted) {
      return {
        hasTokens: false,
        isExpired: true,
        refreshCount: 0,
      };
    }

    const expiresAt = data.expires_at ? new Date(data.expires_at) : undefined;
    const now = new Date();
    const isExpired = expiresAt ? expiresAt.getTime() <= now.getTime() : true;
    const lastRefresh = data.updated_at ? new Date(data.updated_at) : undefined;

    return {
      hasTokens: true,
      isExpired,
      expiresAt,
      refreshCount: data.refresh_count ?? 0,
      lastRefresh,
      scope: data.scope ?? undefined,
    };
  }

  /**
   * Updates refresh count for database-backed storage.
   */
  static async incrementRefreshCount(
    supabase: SupabaseClient,
    userId: string,
    provider: string
  ): Promise<void> {
    const { data } = await (supabase.from('oauth_tokens') as any)
      .select('refresh_count')
      .eq('user_id', userId)
      .eq('provider', provider)
      .single();

    const newCount = (data?.refresh_count ?? 0) + 1;

    await (supabase.from('oauth_tokens') as any)
      .update({
        refresh_count: newCount,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('provider', provider);
  }

  static async markRefreshReplay(
    supabase: SupabaseClient,
    userId: string,
    provider: string,
    requestId: string
  ): Promise<void> {
    await (supabase.from('oauth_tokens') as any)
      .update({
        last_refresh_request_id: requestId,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('provider', provider);
  }

  static async buildTokenFingerprint(secret: string): Promise<string> {
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(secret)
    );
    const bytes = new Uint8Array(digest);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  static async deleteTokenRecord(
    supabase: SupabaseClient,
    userId: string,
    provider: string
  ): Promise<void> {
    await (supabase.from('oauth_tokens') as any)
      .delete()
      .eq('user_id', userId)
      .eq('provider', provider);
  }
}
