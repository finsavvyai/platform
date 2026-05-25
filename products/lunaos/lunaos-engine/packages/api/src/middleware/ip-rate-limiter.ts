/**
 * IP Rate Limiter — rate limiting for unauthenticated endpoints
 *
 * Protects auth endpoints (login, signup) from brute-force attacks.
 * Uses in-memory counters since these endpoints have no user context.
 *
 * Limits: 10 attempts per IP per 5 minutes
 */

import { createMiddleware } from 'hono/factory';
import type { Env } from '../worker';

export const IP_LIMIT = 10;
export const IP_WINDOW_SECONDS = 300; // 5 minutes

const ipCounters = new Map<string, { count: number; resetAt: number }>();
let lastIpCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 60_000;

/** Remove expired IP counter entries */
export function cleanupIpCounters(): void {
    const now = Date.now();
    for (const [key, entry] of ipCounters) {
        if (now >= entry.resetAt) {
            ipCounters.delete(key);
        }
    }
    lastIpCleanup = now;
}

/** Extract client IP from request headers */
function getClientIp(c: { req: { header: (name: string) => string | undefined } }): string {
    return (
        c.req.header('cf-connecting-ip') ||
        c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
        c.req.header('x-real-ip') ||
        'unknown'
    );
}

/**
 * Check and increment IP counter.
 * @returns true if the IP is over the limit
 */
function checkIpCounter(ip: string): boolean {
    const now = Date.now();
    if (now - lastIpCleanup > CLEANUP_INTERVAL_MS) {
        cleanupIpCounters();
    }

    const windowEnd = now + IP_WINDOW_SECONDS * 1000;
    const entry = ipCounters.get(ip);

    if (!entry || now >= entry.resetAt) {
        ipCounters.set(ip, { count: 1, resetAt: windowEnd });
        return false;
    }

    entry.count += 1;
    return entry.count > IP_LIMIT;
}

/**
 * IP-based rate limiter for unauthenticated endpoints.
 * Place BEFORE route handlers on /auth/login, /auth/signup, etc.
 */
export const ipRateLimit = createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const ip = getClientIp(c);
    const blocked = checkIpCounter(ip);

    if (blocked) {
        c.header('Retry-After', String(IP_WINDOW_SECONDS));
        c.header('X-RateLimit-Limit', String(IP_LIMIT));
        c.header('X-RateLimit-Remaining', '0');

        return c.json({
            error: 'Too many attempts. Please try again later.',
            retryAfter: IP_WINDOW_SECONDS,
        }, 429);
    }

    await next();
});
