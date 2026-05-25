/**
 * Minimal mock of the TokenForge API surface for cross-browser e2e tests.
 *
 * Only implements the endpoints the browser SDK actually calls:
 *   POST /api/tf/bind          — store device public key, return deviceId
 *   POST /api/tf/bind/webauthn — same, for the WebAuthn fallback path
 *   POST /api/edge/verify      — accept any signed request (in-memory replay check)
 *
 * Plus the static fixture page at GET / that loads the built SDK
 * from /dist/ and exposes window.tf for the test driver.
 */

import { Hono } from 'hono';
import { serveStatic } from 'hono/serve-static';
import { serve } from '@hono/node-server';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(__dirname, '..', '..');

const app = new Hono();

interface BoundDevice {
  deviceId: string;
  publicKey: unknown;
  sessionId: string;
}
const boundDevices = new Map<string, BoundDevice>();
const seenNonces = new Set<string>();

app.post('/api/tf/bind', async (c) => {
  const body = await c.req.json().catch(() => ({})) as Partial<BoundDevice>;
  if (!body.publicKey || !body.sessionId) {
    return c.json({ error: 'invalid_payload' }, 400);
  }
  const deviceId = `dev_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  boundDevices.set(deviceId, {
    deviceId, publicKey: body.publicKey, sessionId: body.sessionId,
  });
  return c.json({
    deviceId,
    expiresAt: new Date(Date.now() + 86400_000).toISOString(),
    trustScore: 100,
  });
});

app.post('/api/tf/bind/webauthn', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!body) return c.json({ error: 'invalid_payload' }, 400);
  const deviceId = `dev_wa_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  return c.json({ deviceId, expiresAt: new Date(Date.now() + 86400_000).toISOString() });
});

app.post('/api/edge/verify', async (c) => {
  const body = await c.req.json().catch(() => ({})) as {
    headers?: { signature?: string | null; nonce?: string | null; timestamp?: string | null; deviceId?: string | null };
  };
  const nonce = body.headers?.nonce;
  if (nonce) {
    if (seenNonces.has(nonce)) return c.json({ data: { status: 'block', reason: 'nonce_replay' } });
    seenNonces.add(nonce);
  }
  return c.json({ data: { status: 'allow', trustScore: 95, deviceId: body.headers?.deviceId, bound: true } });
});

// Serve dist/ as static so the fixture page can `import` the built ESM
app.use('/dist/*', serveStatic({
  root: '.',
  rewriteRequestPath: (p) => p.replace(/^\/dist/, '/dist'),
  getContent: async (path) => {
    const full = join(PKG_ROOT, path);
    if (!existsSync(full)) return null;
    const buf = readFileSync(full);
    // .js needs JS mime, .map needs JSON-ish
    return new Response(buf, {
      headers: { 'Content-Type': path.endsWith('.js') ? 'application/javascript' : 'application/json' },
    });
  },
}));

app.get('/', (c) => {
  const html = readFileSync(join(__dirname, 'test-page.html'), 'utf-8');
  return c.html(html);
});

const port = 4173;
serve({ fetch: app.fetch, port });
console.log(`[mock-tf-server] listening on http://localhost:${port}`);
