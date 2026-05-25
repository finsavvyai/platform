import { createMiddleware } from 'hono/factory';
import type { Env, Variables } from '../types.js';
import type { ApiKeyContext } from './api-key-auth.js';

const WINDOW_SECONDS = 60;

/**
 * Rate limiter for the ingestion API.
 * Uses per-API-key rate limits stored in apiKeys table.
 * Counter stored in CACHE KV with sliding window.
 */
export const ingestRateLimitMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables & ApiKeyContext;
}>(async (c, next) => {
  const keyId = c.get('apiKeyId');
  const maxRequests = c.get('apiKeyRateLimit');
  const kvKey = `ratelimit:apikey:${keyId}`;

  const cached = await c.env.CACHE.get(kvKey);
  const now = Date.now();

  let windowStart: number;
  let count: number;

  if (cached) {
    const data = JSON.parse(cached) as { start: number; count: number };
    const elapsed = (now - data.start) / 1000;

    if (elapsed >= WINDOW_SECONDS) {
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

  // Fire the KV write in the background so the response doesn't wait
  // for propagation. Same reasoning as middleware/rate-limit.ts: KV
  // writes serialise behind edge-to-eventual-store latency, which
  // dominated the p95 of every rate-limited endpoint. waitUntil keeps
  // the counter accurate for future requests without blocking this one.
  // c.executionCtx is a getter that THROWS in test environments
  // (app.request bypasses the CF runtime), so wrap in try/catch.
  const putPromise = c.env.CACHE.put(
    kvKey,
    JSON.stringify({ start: windowStart, count }),
    { expirationTtl: WINDOW_SECONDS + 10 },
  );
  try {
    c.executionCtx.waitUntil(putPromise);
  } catch {
    void putPromise.catch(() => {});
  }

  const remaining = Math.max(0, maxRequests - count);
  const resetAt = Math.ceil(windowStart / 1000) + WINDOW_SECONDS;

  c.header('X-RateLimit-Limit', String(maxRequests));
  c.header('X-RateLimit-Remaining', String(remaining));
  c.header('X-RateLimit-Reset', String(resetAt));

  if (count > maxRequests) {
    const retryAfter = resetAt - Math.ceil(now / 1000);
    c.header('Retry-After', String(Math.max(1, retryAfter)));
    return c.json(
      {
        error: 'Too many requests',
        message: `Rate limit exceeded (${maxRequests}/min). Retry in ${Math.max(1, retryAfter)}s.`,
      },
      429,
    );
  }

  await next();
});
