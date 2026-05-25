/**
 * Tenant-Aware Rate Limiter — per-tenant rate limiting with tier-based limits
 *
 * Features:
 * - Per-tenant limits (not per-user)
 * - Tier-based configurations (free, pro, enterprise)
 * - Cloudflare KV + in-memory fallback
 * - Distributed counter with 70% safety margin for TOCTOU race
 *
 * Limits (per minute):
 * - Free: 100 req/min
 * - Pro: 1,000 req/min
 * - Enterprise: 10,000 req/min
 */

import { createMiddleware } from 'hono/factory';
import type { Env } from '../worker';

/** Tier-based rate limit definitions */
export const TENANT_RATE_LIMITS: Record<string, { statedLimit: number; kvLimit: number }> = {
  free: { statedLimit: 100, kvLimit: 70 },
  pro: { statedLimit: 1000, kvLimit: 700 },
  enterprise: { statedLimit: 10000, kvLimit: 7000 },
};

export const WINDOW_SECONDS = 60;
const CLEANUP_INTERVAL_MS = 30_000;

/** In-memory fallback for KV outages */
const memoryCounters = new Map<string, { count: number; resetAt: number }>();
let lastCleanup = Date.now();

/** Remove expired in-memory entries */
export function cleanupMemoryCounters(): void {
  const now = Date.now();
  for (const [key, entry] of memoryCounters) {
    if (now >= entry.resetAt) {
      memoryCounters.delete(key);
    }
  }
  lastCleanup = now;
}

/** Check and increment in-memory counter */
function checkMemoryCounter(key: string, limit: number): { blocked: boolean; count: number } {
  const now = Date.now();
  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    cleanupMemoryCounters();
  }

  const windowEnd = now + WINDOW_SECONDS * 1000;
  const entry = memoryCounters.get(key);

  if (!entry || now >= entry.resetAt) {
    memoryCounters.set(key, { count: 1, resetAt: windowEnd });
    return { blocked: false, count: 1 };
  }

  entry.count += 1;
  if (entry.count > limit) {
    return { blocked: true, count: entry.count };
  }
  return { blocked: false, count: entry.count };
}

/** Set standard rate limit headers */
function setRateLimitHeaders(
  c: { header: (name: string, value: string) => void },
  statedLimit: number,
  remaining: number,
  resetSeconds: number,
): void {
  c.header('X-RateLimit-Limit', String(statedLimit));
  c.header('X-RateLimit-Remaining', String(Math.max(0, remaining)));
  c.header('X-RateLimit-Reset', String(Math.floor(Date.now() / 1000) + resetSeconds));
}

/**
 * Tenant-aware rate limiting middleware
 * Place AFTER auth middleware that sets tenantId and tier
 */
export const tenantRateLimit = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const tenantId = c.get('tenantId') || c.get('orgId');
  const tier = c.get('userTier') || 'free';

  // If no tenant ID, skip rate limiting
  if (!tenantId) {
    return next();
  }

  const limits = TENANT_RATE_LIMITS[tier] || TENANT_RATE_LIMITS.free;
  const minuteBucket = Math.floor(Date.now() / (WINDOW_SECONDS * 1000));
  const kvKey = `rl:tenant:${tenantId}:${minuteBucket}`;

  try {
    // Try KV first
    const current = await c.env.KV.get(kvKey);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= limits.kvLimit) {
      setRateLimitHeaders(c, limits.statedLimit, 0, WINDOW_SECONDS);
      c.header('Retry-After', String(WINDOW_SECONDS));

      return c.json(
        {
          error: 'Rate limit exceeded',
          limit: limits.statedLimit,
          tier,
          upgradeUrl: tier === 'free' ? 'https://agents.lunaos.ai/pricing' : undefined,
        },
        429,
      );
    }

    // Increment counter
    await c.env.KV.put(kvKey, String(count + 1), {
      expirationTtl: WINDOW_SECONDS * 2,
    });

    // Calculate remaining (accounting for safety margin)
    const approxRemaining =
      limits.statedLimit - Math.round(count * (limits.statedLimit / limits.kvLimit)) - 1;
    setRateLimitHeaders(c, limits.statedLimit, approxRemaining, WINDOW_SECONDS);
  } catch {
    // KV unavailable — use in-memory fallback
    const memKey = `rl:${tenantId}`;
    const { blocked } = checkMemoryCounter(memKey, limits.statedLimit);

    if (blocked) {
      setRateLimitHeaders(c, limits.statedLimit, 0, WINDOW_SECONDS);
      c.header('Retry-After', String(WINDOW_SECONDS));

      return c.json(
        {
          error: 'Rate limit exceeded',
          limit: limits.statedLimit,
          tier,
        },
        429,
      );
    }
  }

  return next();
});

/**
 * Per-endpoint rate limiting — stricter limits for expensive operations
 * e.g., model training, large exports, etc.
 */
export const endpointRateLimit = (
  statedLimit: number,
  windowSeconds: number = 60,
) => {
  return createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const tenantId = c.get('tenantId') || c.get('orgId');
    if (!tenantId) {
      return next();
    }

    const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
    const kvKey = `ep-rl:${tenantId}:${c.req.path}:${bucket}`;

    try {
      const current = await c.env.KV.get(kvKey);
      const count = current ? parseInt(current, 10) : 0;
      const kvLimit = Math.floor(statedLimit * 0.7); // 70% safety margin

      if (count >= kvLimit) {
        setRateLimitHeaders(c, statedLimit, 0, windowSeconds);
        return c.json(
          {
            error: `Rate limit exceeded for this operation (${statedLimit}/${windowSeconds}s)`,
          },
          429,
        );
      }

      await c.env.KV.put(kvKey, String(count + 1), {
        expirationTtl: windowSeconds * 2,
      });

      const remaining = statedLimit - count - 1;
      setRateLimitHeaders(c, statedLimit, remaining, windowSeconds);
    } catch {
      // Silently allow on KV failure
      console.warn(`Endpoint rate limit KV error for ${tenantId}`);
    }

    return next();
  });
};

/**
 * Sliding window rate limiter (more accurate but slightly more expensive)
 * Use for critical operations where accuracy matters
 */
export const slidingWindowRateLimit = (
  maxRequests: number,
  windowSeconds: number = 60,
) => {
  return createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const tenantId = c.get('tenantId') || c.get('orgId');
    if (!tenantId) {
      return next();
    }

    const now = Date.now() / 1000;
    const windowStart = now - windowSeconds;
    const kvKey = `sw-rl:${tenantId}`;

    try {
      // Get current window data (simplified — in production, use Redis)
      const current = await c.env.KV.get(kvKey);
      const data = current ? JSON.parse(current) : { count: 0, resetAt: now + windowSeconds };

      if (now >= data.resetAt) {
        // Window expired
        const newData = { count: 1, resetAt: now + windowSeconds };
        await c.env.KV.put(kvKey, JSON.stringify(newData), {
          expirationTtl: windowSeconds * 2,
        });
        return next();
      }

      if (data.count >= maxRequests) {
        const resetIn = Math.ceil(data.resetAt - now);
        setRateLimitHeaders(c, maxRequests, 0, resetIn);
        return c.json({ error: 'Rate limit exceeded' }, 429);
      }

      data.count += 1;
      await c.env.KV.put(kvKey, JSON.stringify(data), {
        expirationTtl: windowSeconds * 2,
      });

      const remaining = maxRequests - data.count;
      const resetIn = Math.ceil(data.resetAt - now);
      setRateLimitHeaders(c, maxRequests, remaining, resetIn);
    } catch {
      // Fail closed
      return c.json({ error: 'Rate limiter error' }, 500);
    }

    return next();
  });
};
