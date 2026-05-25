/**
 * Rate Limiting Module
 *
 * Token Bucket Algorithm implementation for request rate limiting
 * Week 2 Day 2 Implementation
 */

export interface RateLimitConfig {
  tokensPerMinute: number;     // Tokens added per minute
  bucketSize: number;           // Maximum tokens in bucket
  burstSize: number;            // Max tokens consumed in single burst
  costPerRequest: number;       // Tokens consumed per request
}

export interface RateLimitState {
  tokens: number;               // Current available tokens
  lastRefill: number;           // Timestamp of last refill
  requestCount: number;         // Total requests in current window
  lastReset: number;            // Timestamp of last reset
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;          // Seconds until next token available
  limit: number;
}

export enum PlanType {
  FREE = 'free',
  STARTUP = 'startup',
  ENTERPRISE = 'enterprise',
}

/**
 * Rate Limit Plans
 * Different limits per subscription tier
 */
export const RATE_LIMIT_PLANS: Record<PlanType, RateLimitConfig> = {
  [PlanType.FREE]: {
    tokensPerMinute: 10,        // 10 requests/minute
    bucketSize: 20,              // Allow burst of 20
    burstSize: 5,                // Max 5 requests in quick succession
    costPerRequest: 1,
  },
  [PlanType.STARTUP]: {
    tokensPerMinute: 100,        // 100 requests/minute
    bucketSize: 200,             // Allow burst of 200
    burstSize: 50,               // Max 50 requests in quick succession
    costPerRequest: 1,
  },
  [PlanType.ENTERPRISE]: {
    tokensPerMinute: 1000,       // 1000 requests/minute
    bucketSize: 2000,            // Allow burst of 2000
    burstSize: 500,              // Max 500 requests in quick succession
    costPerRequest: 1,
  },
};

/**
 * Token Bucket Rate Limiter
 */
export class TokenBucketRateLimiter {
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if request is allowed and consume tokens
   */
  checkLimit(state: RateLimitState, now: number = Date.now()): RateLimitResult {
    // Refill tokens based on time elapsed
    const refilled = this.refillTokens(state, now);

    // Check if enough tokens available
    const cost = this.config.costPerRequest;
    const allowed = refilled.tokens >= cost;

    if (allowed) {
      // Consume tokens
      refilled.tokens -= cost;
      refilled.requestCount += 1;
    }

    // Calculate reset time (when bucket will be full again)
    const tokensToFull = this.config.bucketSize - refilled.tokens;
    const secondsToFull = (tokensToFull / this.config.tokensPerMinute) * 60;
    const resetAt = Math.ceil(now + secondsToFull * 1000);

    // Calculate retry after (when next token available)
    const retryAfter = allowed ? undefined : Math.ceil(60 / this.config.tokensPerMinute);

    return {
      allowed,
      remaining: Math.floor(refilled.tokens),
      resetAt,
      retryAfter,
      limit: this.config.tokensPerMinute,
    };
  }

  /**
   * Refill tokens based on time elapsed
   */
  private refillTokens(state: RateLimitState, now: number): RateLimitState {
    const timeSinceLastRefill = now - state.lastRefill;
    const secondsElapsed = timeSinceLastRefill / 1000;
    const minutesElapsed = secondsElapsed / 60;

    // Calculate tokens to add
    const tokensToAdd = minutesElapsed * this.config.tokensPerMinute;
    const newTokens = Math.min(
      state.tokens + tokensToAdd,
      this.config.bucketSize
    );

    return {
      tokens: newTokens,
      lastRefill: now,
      requestCount: state.requestCount,
      lastReset: state.lastReset,
    };
  }

  /**
   * Initialize new rate limit state
   */
  static initState(now: number = Date.now()): RateLimitState {
    return {
      tokens: 0,  // Start with 0 tokens, will refill immediately
      lastRefill: now,
      requestCount: 0,
      lastReset: now,
    };
  }

  /**
   * Reset state (for testing or manual reset)
   */
  static resetState(config: RateLimitConfig, now: number = Date.now()): RateLimitState {
    return {
      tokens: config.bucketSize,
      lastRefill: now,
      requestCount: 0,
      lastReset: now,
    };
  }
}

/**
 * Rate Limit Storage Interface
 * Abstracts KV storage operations
 */
export interface RateLimitStorage {
  get(key: string): Promise<RateLimitState | null>;
  set(key: string, state: RateLimitState, ttl?: number): Promise<void>;
}

/**
 * KV-based Rate Limit Storage
 */
export class KVRateLimitStorage implements RateLimitStorage {
  constructor(private kv: KVNamespace) {}

  async get(key: string): Promise<RateLimitState | null> {
    const value = await this.kv.get(`ratelimit:${key}`, 'json');
    return value as RateLimitState | null;
  }

  async set(key: string, state: RateLimitState, ttl: number = 3600): Promise<void> {
    await this.kv.put(
      `ratelimit:${key}`,
      JSON.stringify(state),
      { expirationTtl: ttl }
    );
  }
}

/**
 * Get rate limit key for user/API key
 */
export function getRateLimitKey(userId: string, apiKeyId: string): string {
  return `${userId}:${apiKeyId}`;
}

/**
 * Get plan type from user data
 */
export function getPlanType(userData: { plan?: string }): PlanType {
  const plan = userData?.plan?.toLowerCase() || 'free';

  if (plan === 'enterprise') return PlanType.ENTERPRISE;
  if (plan === 'startup') return PlanType.STARTUP;
  return PlanType.FREE;
}

/**
 * Format rate limit headers for HTTP response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': Math.max(0, result.remaining).toString(),
    'X-RateLimit-Reset': Math.floor(result.resetAt / 1000).toString(),
  };

  if (result.retryAfter !== undefined) {
    headers['Retry-After'] = result.retryAfter.toString();
  }

  return headers;
}

/**
 * Create rate limit exceeded response
 */
export function rateLimitExceededResponse(result: RateLimitResult): Response {
  const resetDate = new Date(result.resetAt).toISOString();

  return new Response(JSON.stringify({
    error: {
      code: 'rate_limit_exceeded',
      message: 'Rate limit exceeded. Please try again later.',
      details: {
        limit: result.limit,
        remaining: 0,
        resetAt: resetDate,
        retryAfter: result.retryAfter,
      },
    },
  }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      ...getRateLimitHeaders(result),
    },
  });
}

/**
 * High-level rate limiting check
 *
 * Usage:
 * ```typescript
 * const result = await checkRateLimit(storage, userId, apiKeyId, planType);
 * if (!result.allowed) {
 *   return rateLimitExceededResponse(result);
 * }
 * ```
 */
export async function checkRateLimit(
  storage: RateLimitStorage,
  userId: string,
  apiKeyId: string,
  planType: PlanType = PlanType.FREE
): Promise<RateLimitResult> {
  const config = RATE_LIMIT_PLANS[planType];
  const limiter = new TokenBucketRateLimiter(config);
  const key = getRateLimitKey(userId, apiKeyId);

  // Get current state
  let state = await storage.get(key);
  if (!state) {
    // Initialize new state with full bucket
    state = TokenBucketRateLimiter.resetState(config);
  }

  // Check rate limit
  const result = limiter.checkLimit(state);

  // Save updated state
  await storage.set(key, {
    tokens: result.remaining,
    lastRefill: Date.now(),
    requestCount: state.requestCount + (result.allowed ? 1 : 0),
    lastReset: state.lastReset,
  });

  return result;
}
