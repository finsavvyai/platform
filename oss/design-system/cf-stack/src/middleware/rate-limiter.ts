import type { Context, Next } from 'hono';
import type { KVNamespace } from '../bindings';

export interface RateLimiterConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix?: string;
  keyFn?: (c: Context) => string;
}

export function createRateLimiter(config: RateLimiterConfig) {
  const {
    maxRequests,
    windowMs,
    keyPrefix = 'rl',
    keyFn = defaultKeyFn,
  } = config;

  return async (c: Context, next: Next) => {
    const kv = c.env?.['KV_NAMESPACE'] as KVNamespace | undefined;
    if (!kv) {
      return next();
    }

    const identifier = keyFn(c);
    const key = `${keyPrefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    const stored = await kv.get(key);
    const requests = stored ? JSON.parse(stored) : [];

    const recentRequests = requests.filter(
      (t: number) => t > windowStart,
    );

    if (recentRequests.length >= maxRequests) {
      c.status(429);
      return c.json({ error: 'Rate limit exceeded' });
    }

    recentRequests.push(now);
    const ttl = Math.ceil(windowMs / 1000);
    await kv.put(key, JSON.stringify(recentRequests), {
      expirationTtl: ttl,
    });

    return next();
  };
}

function defaultKeyFn(c: Context): string {
  const ip =
    c.req.header('x-forwarded-for') ||
    c.req.header('cf-connecting-ip') ||
    'unknown';
  return ip;
}
