import { createMiddleware } from 'hono/factory';
import type { Env, Variables } from '../types.js';

interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

const TIERS = {
  public: { maxRequests: 60, windowSeconds: 60 },
  authenticated: { maxRequests: 300, windowSeconds: 60 },
  agent: { maxRequests: 600, windowSeconds: 60 },
  ai: { maxRequests: 20, windowSeconds: 60 },
  embedding: { maxRequests: 10, windowSeconds: 60 },
  'instance-events': { maxRequests: 60, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitConfig>;

function getClientKey(c: { req: { header: (name: string) => string | undefined } }): string {
  return (
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

type Tier = keyof typeof TIERS;

export function rateLimitMiddleware(tier: Tier = 'public') {
  const config: RateLimitConfig = TIERS[tier] ?? TIERS.public;

  return createMiddleware<{ Bindings: Env; Variables: Variables }>(
    async (c, next) => {
      const clientIp = getClientKey(c);
      const userId = tier === 'authenticated' ? c.get('userId') : undefined;
      const instanceId = tier === 'agent' || tier === 'instance-events'
        ? c.req.header('X-Instance-Id')
        : undefined;

      const identifier = instanceId ?? userId ?? clientIp;
      const kvKey = `ratelimit:${tier}:${identifier}`;

      const cached = await c.env.CACHE.get(kvKey);
      const now = Date.now();

      let windowStart: number;
      let count: number;

      if (cached) {
        const data = JSON.parse(cached) as { start: number; count: number };
        const elapsed = (now - data.start) / 1000;

        if (elapsed >= config.windowSeconds) {
          windowStart = now;
          count = 1;
        } else {
          windowStart = data.start;
          count = data.count + 1;
        }
      } else {
        windowStart = now;
        count = 1;
      }

      // Store updated counter in the background — the response doesn't
      // need to wait for KV propagation. The next request may see a
      // counter that's off-by-one, but on a 60-second window that's
      // acceptable and in exchange we drop ~800ms from the p95 of every
      // rate-limited endpoint. Measured on probe: the await path pushed
      // /api/instances/:id/events from ~339ms p50 to 1155ms p95 because
      // KV writes serialise behind edge-to-eventual-store propagation.
      //
      // Hono's `c.executionCtx` is a GETTER that throws when the context
      // was created without a CF execution context (i.e. in-process test
      // runs via `app.request()`). That's why we wrap the access in a
      // try/catch instead of a truthy check — reading the property is
      // what throws, so there is no short-circuit.
      const putPromise = c.env.CACHE.put(
        kvKey,
        JSON.stringify({ start: windowStart, count }),
        { expirationTtl: config.windowSeconds + 10 },
      );
      try {
        c.executionCtx.waitUntil(putPromise);
      } catch {
        // Test environment or any runtime without an executionCtx —
        // fire-and-forget. Swallow rejections so Node doesn't emit
        // unhandled-promise warnings.
        void putPromise.catch(() => {});
      }

      // Set rate limit headers
      const remaining = Math.max(0, config.maxRequests - count);
      const resetAt = Math.ceil(windowStart / 1000) + config.windowSeconds;
      c.header('X-RateLimit-Limit', String(config.maxRequests));
      c.header('X-RateLimit-Remaining', String(remaining));
      c.header('X-RateLimit-Reset', String(resetAt));

      if (count > config.maxRequests) {
        const retryAfter = resetAt - Math.ceil(now / 1000);
        c.header('Retry-After', String(Math.max(1, retryAfter)));
        return c.json(
          {
            error: 'Too many requests',
            message: `Rate limit exceeded. Try again in ${Math.max(1, retryAfter)} seconds.`,
          },
          429,
        );
      }

      await next();
    },
  );
}
