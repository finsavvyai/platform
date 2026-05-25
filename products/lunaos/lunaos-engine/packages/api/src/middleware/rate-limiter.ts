/**
 * Rate Limiter — per-user rate limiting using KV with in-memory fallback
 *
 * Stated limits (user-facing):
 * - Free: 60 requests/minute
 * - Pro:  600 requests/minute
 * - Team: 6000 requests/minute
 *
 * KV limits set to 70% of stated to mitigate TOCTOU race (C4).
 * In-memory fallback on KV failure to fail closed (C3).
 */

import { createMiddleware } from 'hono/factory';
import type { Env } from '../worker';

/** User-facing (stated) rate limits */
export const STATED_LIMITS: Record<string, number> = {
    free: 60,
    pro: 600,
    team: 6000,
};

/** KV limits set to 70% of stated to account for TOCTOU race */
export const KV_LIMITS: Record<string, number> = {
    free: 42,
    pro: 420,
    team: 4200,
};

export const WINDOW_SECONDS = 60;

/** In-memory fallback counters for when KV is unavailable (C3 fix) */
const memoryCounters = new Map<string, { count: number; resetAt: number }>();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 30_000;

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

/** Check and increment in-memory counter. Returns true if over limit. */
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

function setRateLimitHeaders(
    c: { header: (name: string, value: string) => void },
    statedLimit: number,
    remaining: number,
    minuteBucket: number,
): void {
    c.header('X-RateLimit-Limit', String(statedLimit));
    c.header('X-RateLimit-Remaining', String(Math.max(0, remaining)));
    c.header('X-RateLimit-Reset', String((minuteBucket + 1) * WINDOW_SECONDS));
}

/**
 * Rate limiting middleware — place AFTER auth middleware
 */
export const rateLimit = createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const userId = c.get('userId');
    const tier = c.get('userTier');
    const statedLimit = STATED_LIMITS[tier] || STATED_LIMITS.free;
    const kvLimit = KV_LIMITS[tier] || KV_LIMITS.free;

    const minuteBucket = Math.floor(Date.now() / (WINDOW_SECONDS * 1000));
    const kvKey = `rate:${userId}:${minuteBucket}`;

    try {
        const current = await c.env.KV.get(kvKey);
        const count = current ? parseInt(current, 10) : 0;

        if (count >= kvLimit) {
            setRateLimitHeaders(c, statedLimit, 0, minuteBucket);
            c.header('Retry-After', String(WINDOW_SECONDS - Math.floor((Date.now() / 1000) % WINDOW_SECONDS)));

            return c.json({
                error: 'Rate limit exceeded',
                limit: statedLimit,
                retryAfter: WINDOW_SECONDS - Math.floor((Date.now() / 1000) % WINDOW_SECONDS),
                tier,
                upgradeUrl: tier === 'free' ? 'https://agents.lunaos.ai/pricing' : undefined,
            }, 429);
        }

        await c.env.KV.put(kvKey, String(count + 1), {
            expirationTtl: WINDOW_SECONDS * 2,
        });

        const approxRemaining = statedLimit - Math.round(count * (statedLimit / kvLimit)) - 1;
        setRateLimitHeaders(c, statedLimit, approxRemaining, minuteBucket);

    } catch {
        // C3 fix: fail CLOSED using in-memory fallback instead of fail-open
        console.error('Rate limiter KV error — using in-memory fallback');
        const memKey = `rate:${userId}`;
        const { blocked } = checkMemoryCounter(memKey, statedLimit);

        if (blocked) {
            setRateLimitHeaders(c, statedLimit, 0, minuteBucket);
            c.header('Retry-After', String(WINDOW_SECONDS));
            return c.json({
                error: 'Rate limit exceeded',
                limit: statedLimit,
                retryAfter: WINDOW_SECONDS,
                tier,
            }, 429);
        }
    }

    await next();
});
