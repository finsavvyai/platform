import { Context, Next } from 'hono';

// Simplified Rate Limiter for Hono using Cloudflare KV
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (c: Context) => string;
  errorMessage?: string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export const createRateLimiter = (config: RateLimitConfig) => {
  return async (c: Context, next: Next) => {
    const requestUrl = new URL(c.req.url);
    const hostHeader = c.req.header('host') || '';
    const clientIp = c.req.header('cf-connecting-ip');
    const frontendUrl = String(c.env?.FRONTEND_URL || '');
    const isLocalHost = requestUrl.hostname === '127.0.0.1' ||
      requestUrl.hostname === 'localhost' ||
      hostHeader.startsWith('127.0.0.1:') ||
      hostHeader.startsWith('localhost:');
    const isLocalFrontend = frontendUrl.includes('127.0.0.1') || frontendUrl.includes('localhost');

    if (isLocalHost || isLocalFrontend || !clientIp) {
      return next();
    }

    // If RATE_LIMIT_KV is not bound, skip rate limiting (fail open)
    const kv = c.env?.RATE_LIMIT_KV as any;
    if (!kv) {
      console.warn('RATE_LIMIT_KV not found in bindings. Skipping rate limiting.');
      return next();
    }

    const { windowMs, maxRequests, errorMessage } = config;
    const now = Date.now();

    // Default key generator by IP
    const key = config.keyGenerator ? config.keyGenerator(c) : `ip:${c.req.header('cf-connecting-ip') || 'unknown-ip'}`;
    const entryKey = `rate_limit:${key}`;

    try {
      const existing = await kv.get(entryKey, 'json') as RateLimitEntry | null;
      let entry: RateLimitEntry;

      if (existing && now <= existing.resetTime) {
        entry = { count: existing.count + 1, resetTime: existing.resetTime };
      } else {
        entry = { count: 1, resetTime: now + windowMs };
      }

      // KV expirationTtl expects seconds, minimum 60
      const ttlSeconds = Math.max(60, Math.ceil(windowMs / 1000));
      await kv.put(entryKey, JSON.stringify(entry), { expirationTtl: ttlSeconds });

      const remaining = Math.max(0, maxRequests - entry.count);

      // Add Headers
      c.header('X-RateLimit-Limit', maxRequests.toString());
      c.header('X-RateLimit-Remaining', remaining.toString());
      c.header('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000).toString());

      if (entry.count > maxRequests) {
        return c.json({
          success: false,
          error: 'Too Many Requests',
          message: errorMessage || 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((entry.resetTime - now) / 1000)
        }, 429);
      }
    } catch (e) {
      console.error('Rate limiting KV error:', e);
      // Fail open
    }

    await next();
  };
};

export const rateLimiters = {
  // 300 req / 15 min for general API (supports dashboard polling + E2E suites)
  api: () => createRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 300 }),
  // 60 req / 15 min for auth (4/min — blocks brute force, allows legitimate retries)
  auth: () => createRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 60, errorMessage: 'Too many login attempts.' }),
  // 30 req / hour for AI (cost guard)
  ai: () => createRateLimiter({ windowMs: 60 * 60 * 1000, maxRequests: 30, errorMessage: 'AI request limit reached.' })
};
