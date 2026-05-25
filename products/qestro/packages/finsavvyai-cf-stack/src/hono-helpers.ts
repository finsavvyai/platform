/**
 * @finsavvyai/cf-stack — Hono middleware helpers for Cloudflare Workers
 */

import type { Context, MiddlewareHandler } from 'hono';

/** Standard request ID injection */
export function requestId(): MiddlewareHandler {
  return async (c, next) => {
    const id = c.req.header('x-request-id') || crypto.randomUUID();
    c.set('requestId', id);
    c.header('X-Request-Id', id);
    await next();
  };
}

/** CORS middleware with FinsavvyAI defaults */
export function cors(origins: string[] = []): MiddlewareHandler {
  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
  ];
  const allowed = new Set([...defaultOrigins, ...origins]);

  return async (c, next) => {
    const origin = c.req.header('Origin') || '';
    if (allowed.has(origin) || allowed.has('*')) {
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
      c.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Request-Id');
      c.header('Access-Control-Allow-Credentials', 'true');
      c.header('Access-Control-Max-Age', '86400');
    }
    if (c.req.method === 'OPTIONS') {
      return c.text('', 204);
    }
    await next();
  };
}

/** Request timing middleware */
export function timing(): MiddlewareHandler {
  return async (c, next) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;
    c.header('X-Response-Time', `${duration}ms`);
  };
}

/** Rate limiting via KV */
export function rateLimit(
  options: {
    windowMs?: number;
    max?: number;
    keyFn?: (c: Context) => string;
  } = {},
): MiddlewareHandler {
  const { windowMs = 60000, max = 100, keyFn } = options;
  const windowCounts = new Map<string, { count: number; resetAt: number }>();

  return async (c, next) => {
    const key = keyFn ? keyFn(c) : (c.req.header('cf-connecting-ip') || 'unknown');
    const now = Date.now();
    const entry = windowCounts.get(key);

    if (!entry || now > entry.resetAt) {
      windowCounts.set(key, { count: 1, resetAt: now + windowMs });
    } else if (entry.count >= max) {
      c.header('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return c.json({ error: 'Rate limit exceeded' }, 429);
    } else {
      entry.count++;
    }
    await next();
  };
}

/** Health check endpoint */
export function healthCheck(checks: Record<string, () => Promise<boolean>> = {}) {
  return async (c: Context) => {
    const results: Record<string, string> = {};
    let healthy = true;

    for (const [name, check] of Object.entries(checks)) {
      try {
        const ok = await check();
        results[name] = ok ? 'healthy' : 'unhealthy';
        if (!ok) healthy = false;
      } catch {
        results[name] = 'unhealthy';
        healthy = false;
      }
    }

    return c.json({
      status: healthy ? 'healthy' : 'degraded',
      checks: results,
      timestamp: new Date().toISOString(),
    }, healthy ? 200 : 503);
  };
}
