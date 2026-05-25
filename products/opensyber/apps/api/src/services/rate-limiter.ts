/**
 * Token-bucket rate limiter backed by Cloudflare KV.
 * Supports per-integration rate limits with configurable refill rates.
 */

export interface RateLimitConfig {
  /** Maximum tokens in the bucket */
  maxTokens: number;
  /** Number of tokens to add per refill interval */
  refillRate: number;
  /** Milliseconds between refills */
  refillIntervalMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

interface BucketState {
  tokens: number;
  lastRefill: number;
}

const KV_TTL_SECONDS = 3600; // 1 hour TTL for bucket state

/**
 * Check whether a request is allowed under the token bucket rate limit.
 * Reads and writes bucket state from KV.
 */
export async function checkRateLimit(
  kv: { get(key: string): Promise<string | null>; put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> },
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const kvKey = `rl:${key}`;
  const now = Date.now();

  let bucket: BucketState = { tokens: config.maxTokens, lastRefill: now };

  const stored = await kv.get(kvKey);
  if (stored) {
    try {
      bucket = JSON.parse(stored) as BucketState;
    } catch {
      bucket = { tokens: config.maxTokens, lastRefill: now };
    }
  }

  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefill;
  const refillCycles = Math.floor(elapsed / config.refillIntervalMs);
  if (refillCycles > 0) {
    bucket.tokens = Math.min(
      config.maxTokens,
      bucket.tokens + refillCycles * config.refillRate,
    );
    bucket.lastRefill += refillCycles * config.refillIntervalMs;
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    await kv.put(kvKey, JSON.stringify(bucket), {
      expirationTtl: KV_TTL_SECONDS,
    });
    return { allowed: true, remaining: bucket.tokens };
  }

  // Calculate when next token will be available
  const msUntilRefill = config.refillIntervalMs - (now - bucket.lastRefill);

  await kv.put(kvKey, JSON.stringify(bucket), {
    expirationTtl: KV_TTL_SECONDS,
  });

  return {
    allowed: false,
    remaining: 0,
    retryAfterMs: msUntilRefill,
  };
}

/**
 * Pre-configured rate limits for common integrations.
 */
export const INTEGRATION_RATE_LIMITS: Record<string, RateLimitConfig> = {
  github: {
    maxTokens: 5000,
    refillRate: 5000,
    refillIntervalMs: 3_600_000, // 5000/hour
  },
  gitlab: {
    maxTokens: 3600,
    refillRate: 3600,
    refillIntervalMs: 3_600_000, // 3600/hour
  },
  aws: {
    maxTokens: 10,
    refillRate: 10,
    refillIntervalMs: 1_000, // 10/second
  },
  slack: {
    maxTokens: 60,
    refillRate: 60,
    refillIntervalMs: 60_000, // 60/minute
  },
  default: {
    maxTokens: 1000,
    refillRate: 1000,
    refillIntervalMs: 3_600_000, // 1000/hour
  },
};

/**
 * Get the rate limit config for a given integration source.
 */
export function getRateLimitConfig(source: string): RateLimitConfig {
  return INTEGRATION_RATE_LIMITS[source] ?? INTEGRATION_RATE_LIMITS['default']!;
}
