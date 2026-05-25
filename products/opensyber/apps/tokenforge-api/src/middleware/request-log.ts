import { createMiddleware } from 'hono/factory';
import type { Env, Variables } from '../types.js';

/**
 * Structured request logging middleware.
 * Logs every request with tenant, path, status, latency to KV for persistence.
 * Format compatible with Cloudflare Logpush and any log aggregator.
 */
export const requestLog = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  const ip = c.req.header('cf-connecting-ip') ?? '';
  const country = c.req.header('cf-ipcountry') ?? '';

  await next();

  const latency = Date.now() - start;
  const status = c.res.status;
  const tenantId = c.get('tenantId') ?? 'anonymous';

  const entry = {
    ts: new Date().toISOString(),
    method,
    path,
    status,
    latency,
    tenantId,
    ip,
    country,
  };

  // Structured console log (shows in wrangler tail + Cloudflare dashboard)
  console.log(JSON.stringify(entry));

  // Persist to KV for analytics (fire-and-forget, 7-day TTL)
  const key = `log:${Date.now()}:${crypto.randomUUID().slice(0, 8)}`;
  c.executionCtx.waitUntil(
    c.env.CACHE.put(key, JSON.stringify(entry), { expirationTtl: 604800 }),
  );
});
