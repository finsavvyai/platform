/**
 * Integration suite for register → refresh → revoke against the real
 * Hono routes, an in-memory DB, and an in-memory KV (no Miniflare).
 *
 * Proves the Phase 3 done line in CISCO-dua.md §11: end-to-end
 * round-trip works against an HTTP test client.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { KvChallengeStore } from '../lib/kv-challenge-store.js';
import { InMemoryDb } from '../lib/db-mem.js';
import { InMemoryKv } from '../lib/kv-mem.js';
import { apiKey } from '../middleware/api-key.js';
import { handleRegister } from '../routes/sessions.register.js';
import { handleRefresh } from '../routes/sessions.refresh.js';
import { handleRevoke, handleList } from '../routes/sessions.admin.js';
import { createTestApp, generateBrowserKey, signDpop } from './fixtures.js';
import type { App as AppRow } from '@tokenforge/db';

type AppEnv = { Variables: { app: AppRow }; Bindings: { DB: unknown; NONCES: unknown } };

function buildApp(db: InMemoryDb, kv: InMemoryKv) {
  const app = new Hono<AppEnv>();
  const store = new KvChallengeStore(kv as unknown as KVNamespace);
  app.use('/v1/sessions/*', apiKey({ db: () => db }));
  app.post('/v1/sessions/register', async (c) =>
    handleRegister(c, { db, challengeStore: store, refreshUrl: 'https://api.test/v1/sessions/refresh' }),
  );
  app.post('/v1/sessions/refresh', async (c) =>
    handleRefresh(c, { db, challengeStore: store }),
  );
  app.post('/v1/sessions/:id/revoke', async (c) => handleRevoke(c, { db }));
  app.get('/v1/sessions', async (c) => handleList(c, { db }));
  return app;
}

let db: InMemoryDb;
let kv: InMemoryKv;
let app: ReturnType<typeof buildApp>;
let liveKey: string;
let appRow: AppRow;

beforeEach(async () => {
  db = new InMemoryDb();
  kv = new InMemoryKv();
  app = buildApp(db, kv);
  const t = await createTestApp();
  appRow = t.app;
  liveKey = t.liveKey;
  db.apps.set(appRow.id, appRow);
});

describe('register → refresh round-trip', () => {
  it('rejects missing api key', async () => {
    const r = await app.request('/v1/sessions/register', { method: 'POST' });
    expect(r.status).toBe(401);
  });

  it('rejects malformed api key', async () => {
    const r = await app.request('/v1/sessions/register', {
      method: 'POST',
      headers: { 'X-TokenForge-Key': 'totally_invalid_key' },
    });
    expect(r.status).toBe(401);
  });

  it('rejects api key for unknown app id', async () => {
    const r = await app.request('/v1/sessions/register', {
      method: 'POST',
      headers: { 'X-TokenForge-Key': 'tfk_live_app_does_not_exist.something' },
    });
    expect(r.status).toBe(401);
  });

  it('rejects malformed body', async () => {
    const r = await app.request('/v1/sessions/register', {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(r.status).toBe(400);
  });

  it('binds a fresh session and issues short + long cookies', async () => {
    const { publicJwk } = await generateBrowserKey();
    const r = await app.request('/v1/sessions/register', {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: appRow.id,
        subject: 'user_42',
        public_key_jwk: publicJwk,
        binding_class: 'webcrypto',
        client_ip: '203.0.113.7',
        user_agent: 'TestUA/1.0',
      }),
    });
    expect(r.status).toBe(200);
    const json = (await r.json()) as Record<string, unknown>;
    expect(json.session_id).toMatch(/^tf_sess_/);
    expect((json.short_cookie as { name: string }).name).toBe('tf_bound');
    expect((json.long_cookie as { name: string }).name).toBe('tf_session');
    expect(typeof json.challenge).toBe('string');
    expect(db.audit.find((e) => e.type === 'register')).toBeTruthy();
  });

  it('refreshes with a signed DPoP and rotates the cookie', async () => {
    const { publicJwk, privateKey } = await generateBrowserKey();
    const reg = await app.request('/v1/sessions/register', {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: appRow.id,
        subject: 'u1',
        public_key_jwk: publicJwk,
        binding_class: 'webcrypto',
      }),
    });
    const regJson = (await reg.json()) as { session_id: string; challenge: string };
    const firstHash = db.sessions.get(regJson.session_id)?.boundCookieHash;
    const dpop = await signDpop(privateKey, { sub: regJson.session_id, nonce: regJson.challenge });
    const refresh = await app.request('/v1/sessions/refresh', {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, DPoP: dpop },
    });
    expect(refresh.status).toBe(200);
    const refJson = (await refresh.json()) as Record<string, unknown>;
    expect(refJson.action).toBe('allow');
    expect((refJson.short_cookie as { name: string }).name).toBe('tf_bound');
    const secondHash = db.sessions.get(regJson.session_id)?.boundCookieHash;
    expect(secondHash).not.toBe(firstHash);
    expect(db.audit.find((e) => e.type === 'refresh')).toBeTruthy();
  });

  it('rejects nonce replay', async () => {
    const { publicJwk, privateKey } = await generateBrowserKey();
    const reg = await app.request('/v1/sessions/register', {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: appRow.id,
        subject: 'u1',
        public_key_jwk: publicJwk,
        binding_class: 'webcrypto',
      }),
    });
    const j = (await reg.json()) as { session_id: string; challenge: string };
    const dpop = await signDpop(privateKey, { sub: j.session_id, nonce: j.challenge });
    const r1 = await app.request('/v1/sessions/refresh', {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, DPoP: dpop },
    });
    expect(r1.status).toBe(200);
    const r2 = await app.request('/v1/sessions/refresh', {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, DPoP: dpop },
    });
    expect(r2.status).toBe(401);
    expect(db.audit.find((e) => e.type === 'refresh_failed')).toBeTruthy();
  });

  it('rejects DPoP signed by a different key', async () => {
    const real = await generateBrowserKey();
    const evil = await generateBrowserKey();
    const reg = await app.request('/v1/sessions/register', {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: appRow.id,
        subject: 'u1',
        public_key_jwk: real.publicJwk,
        binding_class: 'webcrypto',
      }),
    });
    const j = (await reg.json()) as { session_id: string; challenge: string };
    const dpop = await signDpop(evil.privateKey, { sub: j.session_id, nonce: j.challenge });
    const r = await app.request('/v1/sessions/refresh', {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, DPoP: dpop },
    });
    expect(r.status).toBe(401);
  });

  it('refresh: missing DPoP returns 401', async () => {
    const r = await app.request('/v1/sessions/refresh', {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey },
    });
    expect(r.status).toBe(401);
  });

  it('refresh: malformed DPoP returns 400', async () => {
    const r = await app.request('/v1/sessions/refresh', {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, DPoP: 'garbage' },
    });
    expect(r.status).toBe(400);
  });

  it('refresh: unknown session returns 401', async () => {
    const { privateKey } = await generateBrowserKey();
    const dpop = await signDpop(privateKey, { sub: 'tf_sess_does_not_exist', nonce: 'AAAA' });
    const r = await app.request('/v1/sessions/refresh', {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, DPoP: dpop },
    });
    expect(r.status).toBe(401);
  });

  it('register: rejects app_id mismatch', async () => {
    const { publicJwk } = await generateBrowserKey();
    const r = await app.request('/v1/sessions/register', {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: 'app_different',
        subject: 'u',
        public_key_jwk: publicJwk,
        binding_class: 'webcrypto',
      }),
    });
    expect(r.status).toBe(403);
  });

  it('register: re-registers existing subject (touchSubject path)', async () => {
    const { publicJwk } = await generateBrowserKey();
    const body = {
      app_id: appRow.id,
      subject: 'recurring',
      public_key_jwk: publicJwk,
      binding_class: 'webcrypto' as const,
    };
    const r1 = await app.request('/v1/sessions/register', {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    expect(r1.status).toBe(200);
    const r2 = await app.request('/v1/sessions/register', {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    expect(r2.status).toBe(200);
    expect(db.subjects.size).toBe(1);
  });

  it('admin: revoke with no session id and unknown session', async () => {
    const r1 = await app.request('/v1/sessions/missing/revoke', {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey },
    });
    expect(r1.status).toBe(404);
  });

  it('admin: revoke twice returns 409', async () => {
    const { publicJwk } = await generateBrowserKey();
    const reg = await app.request('/v1/sessions/register', {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: appRow.id,
        subject: 'twice',
        public_key_jwk: publicJwk,
        binding_class: 'webcrypto',
      }),
    });
    const j = (await reg.json()) as { session_id: string };
    await app.request(`/v1/sessions/${j.session_id}/revoke`, {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey },
    });
    const r2 = await app.request(`/v1/sessions/${j.session_id}/revoke`, {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey },
    });
    expect(r2.status).toBe(409);
  });

  it('admin: list without subject param returns 400', async () => {
    const r = await app.request('/v1/sessions', {
      headers: { 'X-TokenForge-Key': liveKey },
    });
    expect(r.status).toBe(400);
  });

  it('admin: list for unknown subject returns empty array', async () => {
    const r = await app.request('/v1/sessions?subject=nobody', {
      headers: { 'X-TokenForge-Key': liveKey },
    });
    expect(r.status).toBe(200);
    const j = (await r.json()) as { sessions: unknown[] };
    expect(j.sessions).toEqual([]);
  });

  it('admin revoke + list reflect state', async () => {
    const { publicJwk } = await generateBrowserKey();
    const reg = await app.request('/v1/sessions/register', {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: appRow.id,
        subject: 'u_admin',
        public_key_jwk: publicJwk,
        binding_class: 'webcrypto',
      }),
    });
    const j = (await reg.json()) as { session_id: string };

    const list1 = await app.request('/v1/sessions?subject=u_admin', {
      headers: { 'X-TokenForge-Key': liveKey },
    });
    expect(list1.status).toBe(200);
    const lj1 = (await list1.json()) as { sessions: unknown[] };
    expect(lj1.sessions).toHaveLength(1);

    const rev = await app.request(`/v1/sessions/${j.session_id}/revoke`, {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'user_logout' }),
    });
    expect(rev.status).toBe(200);

    const list2 = await app.request('/v1/sessions?subject=u_admin', {
      headers: { 'X-TokenForge-Key': liveKey },
    });
    const lj2 = (await list2.json()) as { sessions: unknown[] };
    expect(lj2.sessions).toHaveLength(0);
    expect(db.audit.find((e) => e.type === 'revoke')).toBeTruthy();
  });
});
