// Hono CF Worker entry. POST /scan { serverUrl } → DriftAlert[].

import { Hono } from 'hono';
import { scanServer } from './scan.js';

interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
}

const app = new Hono<{ Bindings: Env }>();

app.get('/health', (c) => c.json({ ok: true, service: 'mcp-drift-watcher', env: c.env.ENVIRONMENT }));

app.post('/scan', async (c) => {
  const body = await c.req.json().catch(() => null) as { serverUrl?: unknown } | null;
  const serverUrl = body?.serverUrl;
  if (typeof serverUrl !== 'string' || !/^https?:\/\//.test(serverUrl)) {
    return c.json({ error: 'serverUrl must be an http(s) URL' }, 400);
  }
  try {
    const alerts = await scanServer(c.env.DB, serverUrl);
    return c.json({ serverUrl, alerts });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return c.json({ error: message }, 502);
  }
});

export default app;
