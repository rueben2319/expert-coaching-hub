/**
 * Redis-based Rate Limiting for Supabase Edge Functions
 * 
 * Provides distributed rate limiting using Redis to replace in-memory solutions
 * Supports fallback to in-memory rate limiting if Redis is unavailable
 * 
 * Environment Variables:
 * - REDIS_URL: Redis connection string (e.g., redis://default:password@host:port)
 * - REDIS_ENABLED: Set to "false" to disable Redis and use in-memory fallback
 */

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
  keyPrefix?: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  limit: number;
  window: number;
}

/**
 * Redis client using Deno's native fetch-based Redis connection
 */
class RedisClient {
  private url: string;
  private enabled: boolean;

  constructor() {
    this.url = Deno.env.get("REDIS_URL") || "";
    this.enabled = Deno.env.get("REDIS_ENABLED") !== "false" && this.url !== "";
  }

  /**
   * Execute Redis command using HTTP API (e.g., Upstash Redis)
   */
  private async executeCommand(command: string[], args: string[]): Promise<any> {
    if (!this.enabled) {
      throw new Error("Redis is disabled or not configured");
    }

    // For Upstash Redis HTTP API
    const response = await fetch(`${this.url}/${command}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      throw new Error(`Redis command failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Set value with expiration
   */
  async setex(key: string, seconds: number, value: string): Promise<void> {
    await this.executeCommand("set", [key, value, "EX", seconds.toString()]);
  }

  /**
   * Get value
   */
  async get(key: string): Promise<string | null> {
    const result = await this.executeCommand("get", [key]);
    return result.result;
  }

  /**
   * Increment value
   */
  async incr(key: string): Promise<number> {
    const result = await this.executeCommand("incr", [key]);
    return result.result;
  }

  /**
   * Set value with expiration if key doesn't exist
   */
  async setnx(key: string, value: string, seconds: number): Promise<boolean> {
    const result = await this.executeCommand("set", [key, value, "NX", "EX", seconds.toString()]);
    return result.result === "OK";
  }

  /**
   * Check if Redis is available
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.executeCommand("ping", []);
      return result.result === "PONG";
    } catch {
      return false;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

// Singleton Redis client
let redisClient: RedisClient | null = null;

function getRedisClient(): RedisClient {
  if (!redisClient) {
    redisClient = new RedisClient();
  }
  return redisClient;
}

/**
 * In-memory fallback rate limiter for when Redis is unavailable
 */
class InMemoryRateLimiter {
  private store: Map<string, { count: number; resetTime: number }>;

  constructor() {
    this.store = new Map();
  }

  async check(config: RateLimitConfig, identifier: string): Promise<RateLimitResult> {
    const key = `${config.keyPrefix || 'default'}:${identifier}`;
    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;

    let entry = this.store.get(key);

    if (!entry || now > entry.resetTime) {
      entry = {
        count: 1,
        resetTime: now + windowMs,
      };
      this.store.set(key, entry);
    } else {
      entry.count++;
    }

    const allowed = entry.count <= config.limit;
    const remaining = Math.max(0, config.limit - entry.count);

    return {
      allowed,
      remaining,
      resetTime: entry.resetTime,
      limit: config.limit,
      window: config.windowSeconds,
    };
  }

  clear(): void {
    this.store.clear();
  }
}

const inMemoryLimiter = new InMemoryRateLimiter();

/**
 * Check rate limit using Redis or fallback to in-memory
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redis = getRedisClient();

  // Try Redis first if enabled
  if (redis.isEnabled()) {
    try {
      const isHealthy = await redis.ping();
      if (isHealthy) {
        return await checkRedisRateLimit(redis, identifier, config);
      }
    } catch (error) {
      console.warn("Redis health check failed, falling back to in-memory:", error);
    }
  }

  // Fallback to in-memory rate limiting
  console.warn("Using in-memory rate limiting (Redis unavailable)");
  return await inMemoryLimiter.check(config, identifier);
}

/**
 * Redis-based rate limit check using sliding window algorithm
 */
async function checkRedisRateLimit(
  redis: RedisClient,
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `${config.keyPrefix || 'rate_limit'}:${identifier}`;
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const windowStart = now - windowMs;

  // Use Redis sorted set for sliding window algorithm
  try {
    // Remove entries outside the current window
    await redis.executeCommand("zremrangebyscore", [
      key,
      windowStart.toString(),
      now.toString(),
    ]);

    // Count current window entries
    const countResult = await redis.executeCommand("zcard", [key]);
    const currentCount = countResult.result || 0;

    const allowed = currentCount < config.limit;
    const remaining = Math.max(0, config.limit - currentCount - 1);

    if (allowed) {
      // Add current request to window
      await redis.executeCommand("zadd", [
        key,
        now.toString(),
        `${now}-${Math.random()}`,
      ]);
      // Set expiration for the key
      await redis.executeCommand("expire", [key, config.windowSeconds.toString()]);
    }

    return {
      allowed,
      remaining,
      resetTime: now + windowMs,
      limit: config.limit,
      window: config.windowSeconds,
    };
  } catch (error) {
    console.error("Redis rate limit check failed:", error);
    throw error;
  }
}

/**
 * Rate limit configuration presets for common use cases
 */
export const RATE_LIMIT_PRESETS = {
  // Authentication
  auth: { limit: 5, windowSeconds: 900, keyPrefix: 'auth' }, // 5 per 15 min
  
  // Payments
  creditPurchase: { limit: 10, windowSeconds: 3600, keyPrefix: 'credit_purchase' }, // 10 per hour
  withdrawal: { limit: 5, windowSeconds: 3600, keyPrefix: 'withdrawal' }, // 5 per hour
  
  // AI requests
  aiRouter: { limit: 50, windowSeconds: 1800, keyPrefix: 'ai' }, // 50 per 30 min
  
  // API calls
  general: { limit: 100, windowSeconds: 60, keyPrefix: 'general' }, // 100 per minute
  
  // Webhooks
  webhook: { limit: 20, windowSeconds: 60, keyPrefix: 'webhook' }, // 20 per minute
  
  // Google Calendar
  calendar: { limit: 10, windowSeconds: 60, keyPrefix: 'calendar' }, // 10 per minute
};

/**
 * Helper function to check rate limit with preset configuration
 */
export async function checkRateLimitPreset(
  identifier: string,
  preset: keyof typeof RATE_LIMIT_PRESETS
): Promise<RateLimitResult> {
  return checkRateLimit(identifier, RATE_LIMIT_PRESETS[preset]);
}

/**
 * Clear in-memory rate limiter (useful for testing)
 */
export function clearInMemoryRateLimiter(): void {
  inMemoryLimiter.clear();
}

/**
 * Get Redis health status
 */
export async function getRedisHealth(): Promise<{ enabled: boolean; healthy: boolean; error?: string }> {
  const redis = getRedisClient();
  
  if (!redis.isEnabled()) {
    return { enabled: false, healthy: false };
  }

  try {
    const healthy = await redis.ping();
    return { enabled: true, healthy };
  } catch (error) {
    return { 
      enabled: true, 
      healthy: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}