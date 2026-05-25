/**
 * Phase 7 e2e proof: register a webhook → trigger a refresh that
 * detects geo_drift → verify the receiver gets a signed POST.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { KvChallengeStore } from '../lib/kv-challenge-store.js';
import { InMemoryDb } from '../lib/db-mem.js';
import { InMemoryKv } from '../lib/kv-mem.js';
import { apiKey } from '../middleware/api-key.js';
import { handleRegister } from '../routes/sessions.register.js';
import { handleRefresh } from '../routes/sessions.refresh.js';
import {
  handleCreateWebhook,
  handleListWebhooks,
  handleTestWebhook,
} from '../routes/webhooks.js';
import { InMemoryWebhookStore } from '../services/webhooks/store.js';
import { WebhookSink } from '../services/webhooks/sink.js';
import { verifyWebhook } from '../services/webhooks/dispatcher.js';
import { createTestApp, generateBrowserKey, signDpop } from './fixtures.js';
import type { App as AppRow } from '@tokenforge/db';

let db: InMemoryDb;
let kv: InMemoryKv;
let webhookStore: InMemoryWebhookStore;
let receiverFetch: ReturnType<typeof vi.fn>;
let app: Hono;
let liveKey: string;
let appRow: AppRow;

function buildApp() {
  const a = new Hono();
  const store = new KvChallengeStore(kv as unknown as KVNamespace);
  const sink = new WebhookSink({
    store: webhookStore,
    fetchImpl: receiverFetch as unknown as typeof globalThis.fetch,
  });
  a.use('/v1/sessions/*', apiKey({ db: () => db }));
  a.use('/v1/webhooks', apiKey({ db: () => db }));
  a.use('/v1/webhooks/*', apiKey({ db: () => db }));
  a.post('/v1/sessions/register', async (c) =>
    handleRegister(c, {
      db, challengeStore: store, refreshUrl: 'https://api.test/v1/sessions/refresh',
    }),
  );
  a.post('/v1/sessions/refresh', async (c) =>
    handleRefresh(c, { db, challengeStore: store, webhooks: sink }),
  );
  a.get('/v1/webhooks', async (c) => handleListWebhooks(c, { store: webhookStore }));
  a.post('/v1/webhooks', async (c) => handleCreateWebhook(c, { store: webhookStore }));
  a.post('/v1/webhooks/:id/test', async (c) =>
    handleTestWebhook(c, {
      store: webhookStore,
      fetchImpl: receiverFetch as unknown as typeof globalThis.fetch,
    }),
  );
  a.delete('/v1/webhooks/:id', async (c) =>
    (await import('../routes/webhooks.js')).handleDeleteWebhook(c, { store: webhookStore }),
  );
  return a;
}

beforeEach(async () => {
  db = new InMemoryDb();
  kv = new InMemoryKv();
  webhookStore = new InMemoryWebhookStore();
  receiverFetch = vi.fn(async () => new Response('ok'));
  const t = await createTestApp();
  appRow = t.app;
  liveKey = t.liveKey;
  db.apps.set(appRow.id, appRow);
  app = buildApp();
});

describe('webhook CRUD', () => {
  it('rejects http URLs', async () => {
    const r = await app.request('/v1/webhooks', {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'http://hook.test', events: ['risk_signal'] }),
    });
    expect(r.status).toBe(400);
  });

  it('creates a webhook + reveals the secret once', async () => {
    const r = await app.request('/v1/webhooks', {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://hook.test', events: ['risk_signal'] }),
    });
    expect(r.status).toBe(200);
    const j = (await r.json()) as { id: string; secret: string };
    expect(j.id.startsWith('whk_')).toBe(true);
    expect(j.secret.startsWith('whsec_')).toBe(true);

    const list = await app.request('/v1/webhooks', {
      headers: { 'X-TokenForge-Key': liveKey },
    });
    const lj = (await list.json()) as { webhooks: { id: string }[] };
    expect(lj.webhooks).toHaveLength(1);
    // Secret should NOT appear on list
    expect(JSON.stringify(lj)).not.toContain('whsec_');
  });

  it('rejects invalid event names', async () => {
    const r = await app.request('/v1/webhooks', {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://hook.test', events: ['totally_made_up'] }),
    });
    expect(r.status).toBe(400);
  });

  it('test fire calls the receiver with HMAC headers', async () => {
    const create = await app.request('/v1/webhooks', {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://hook.test', events: ['risk_signal'] }),
    });
    const j = (await create.json()) as { id: string };
    const r = await app.request(`/v1/webhooks/${j.id}/test`, {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey },
    });
    expect(r.status).toBe(200);
    expect(receiverFetch).toHaveBeenCalledTimes(1);
    const callArgs = receiverFetch.mock.calls[0]!;
    const init = callArgs[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['X-TokenForge-Signature']).toBeTruthy();
    expect(headers['X-TokenForge-Event']).toBe('test');
  });
});

describe('webhook delete + 404', () => {
  it('returns 404 for an unknown id on delete', async () => {
    const r = await app.request('/v1/webhooks/whk_missing', {
      method: 'DELETE',
      headers: { 'X-TokenForge-Key': liveKey },
    });
    expect(r.status).toBe(404);
  });

  it('returns 404 on test for an unknown id', async () => {
    const r = await app.request('/v1/webhooks/whk_missing/test', {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey },
    });
    expect(r.status).toBe(404);
  });

  it('deletes a webhook and lists empty after', async () => {
    const create = await app.request('/v1/webhooks', {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://hook.test', events: ['risk_signal'] }),
    });
    const j = (await create.json()) as { id: string };
    const del = await app.request(`/v1/webhooks/${j.id}`, {
      method: 'DELETE',
      headers: { 'X-TokenForge-Key': liveKey },
    });
    expect(del.status).toBe(200);
    const list = await app.request('/v1/webhooks', {
      headers: { 'X-TokenForge-Key': liveKey },
    });
    const lj = (await list.json()) as { webhooks: unknown[] };
    expect(lj.webhooks).toHaveLength(0);
  });

  it('rejects cross-app webhook access', async () => {
    const create = await app.request('/v1/webhooks', {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://hook.test', events: ['risk_signal'] }),
    });
    const j = (await create.json()) as { id: string };
    // Forge a webhook owned by a different app and verify access checks.
    const stolen = await webhookStore.insert({
      appId: 'app_other',
      url: 'https://other.hook',
      events: ['risk_signal'],
    });
    void j;
    const r = await app.request(`/v1/webhooks/${stolen.id}`, {
      method: 'DELETE',
      headers: { 'X-TokenForge-Key': liveKey },
    });
    expect(r.status).toBe(403);
  });
});

describe('refresh fan-out to webhook on geo_drift', () => {
  it('emits risk_signal webhook with verifiable HMAC when geo changes', async () => {
    // 1. Register a webhook subscribed to risk_signal
    const create = await app.request('/v1/webhooks', {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://hook.test', events: ['risk_signal'] }),
    });
    const w = (await create.json()) as { id: string; secret: string };

    // 2. Bind a session — the *first* request comes from "US"
    const { publicJwk, privateKey } = await generateBrowserKey();
    const reg = await app.request('/v1/sessions/register', {
      method: 'POST',
      headers: {
        'X-TokenForge-Key': liveKey,
        'Content-Type': 'application/json',
        'CF-IPCountry': 'US',
      },
      body: JSON.stringify({
        app_id: appRow.id,
        subject: 'u_geo',
        public_key_jwk: publicJwk,
        binding_class: 'webcrypto',
        client_ip: '203.0.113.7',
      }),
    });
    const j = (await reg.json()) as { session_id: string; challenge: string };
    // Stamp the session geoFirst to US so the refresh comparison has a baseline
    const sess = db.sessions.get(j.session_id)!;
    Object.assign(sess, { geoFirst: 'US' });

    // 3. Refresh from a different country → geo_drift signal
    const dpop = await signDpop(privateKey, { sub: j.session_id, nonce: j.challenge });
    const refresh = await app.request('/v1/sessions/refresh', {
      method: 'POST',
      headers: {
        'X-TokenForge-Key': liveKey,
        DPoP: dpop,
        'CF-IPCountry': 'CN',
      },
    });
    expect(refresh.status).toBe(200);
    const refreshJson = (await refresh.json()) as { signals: string[]; action: string };
    expect(refreshJson.signals).toContain('geo_drift');
    expect(refreshJson.action).toBe('allow');

    // 4. Webhook receiver got a signed call
    expect(receiverFetch).toHaveBeenCalledTimes(1);
    const init = receiverFetch.mock.calls[0]![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    const body = String(init.body);
    const ts = headers['X-TokenForge-Timestamp']!;
    const sig = headers['X-TokenForge-Signature']!;
    const ok = await verifyWebhook(w.secret, body, ts, sig);
    expect(ok).toBe(true);
    const parsed = JSON.parse(body) as { event: string; signals: string[] };
    expect(parsed.event).toBe('risk_signal');
    expect(parsed.signals).toContain('geo_drift');
  });
});
