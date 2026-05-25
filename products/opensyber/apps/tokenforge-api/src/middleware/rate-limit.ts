import { createMiddleware } from 'hono/factory';
import type { Env, Variables } from '../types.js';

interface RateLimitConfig {
  /** Max requests per window */
  limit: number;
  /** Window in seconds */
  window: number;
  /** Key prefix for KV */
  prefix: string;
  /** Use IP (public), tenantId (authenticated), or tenant-or-ip (fallback) */
  keySource: 'ip' | 'tenant' | 'tenant-or-ip';
}

/**
 * Rate limit middleware using Cloudflare KV.
 * Tracks request counts per IP or tenant within a sliding window.
 * Returns 429 with standard RateLimit-* headers when exceeded.
 */
export function rateLimit(config: RateLimitConfig) {
  return createMiddleware<{ Bindings: Env; Variables: Variables }>(
    async (c, next) => {
      const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown';
      let key: string;
      if (config.keySource === 'ip') {
        key = ip;
      } else if (config.keySource === 'tenant-or-ip') {
        key = c.get('tenantId') ?? ip;
      } else {
        key = c.get('tenantId') ?? 'unknown';
      }

      const bucket = Math.floor(Date.now() / (config.window * 1000));
      const kvKey = `rl:${config.prefix}:${key}:${bucket}`;

      const current = parseInt(await c.env.CACHE.get(kvKey) ?? '0', 10);

      if (current >= config.limit) {
        c.header('RateLimit-Limit', String(config.limit));
        c.header('RateLimit-Remaining', '0');
        c.header('RateLimit-Reset', String((bucket + 1) * config.window));
        c.header('Retry-After', String(config.window));
        return c.json(
          { error: 'rate_limit_exceeded', message: 'Too many requests' },
          429,
        );
      }

      // Increment (fire-and-forget)
      c.executionCtx.waitUntil(
        c.env.CACHE.put(kvKey, String(current + 1), {
          expirationTtl: config.window * 2,
        }),
      );

      const remaining = Math.max(0, config.limit - current - 1);
      c.header('RateLimit-Limit', String(config.limit));
      c.header('RateLimit-Remaining', String(remaining));
      c.header('RateLimit-Reset', String((bucket + 1) * config.window));

      await next();
    },
  );
}

/** 60 req/min per IP — for public endpoints */
export const publicRateLimit = rateLimit({
  limit: 60,
  window: 60,
  prefix: 'pub',
  keySource: 'ip',
});

/** 10 req/min per IP — for auth endpoints (brute-force protection) */
export const authRateLimit = rateLimit({
  limit: 10,
  window: 60,
  prefix: 'auth',
  keySource: 'ip',
});

/** 600 req/min per tenant (falls back to IP for unauthenticated) */
export const apiRateLimit = rateLimit({
  limit: 600,
  window: 60,
  prefix: 'api',
  keySource: 'tenant-or-ip',
});
