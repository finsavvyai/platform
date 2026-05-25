/**
 * Phase 8 e2e proof: native DBSC ingress.
 *
 * Issues a `register` challenge through the in-memory store, builds a
 * spec-style JWS that carries its own pubkey + the challenge, posts
 * it to `/v1/sessions/dbsc-register`, asserts a session row was bound
 * with `binding_class: 'native_dbsc'`.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { webcrypto } from 'node:crypto';
import { Hono } from 'hono';
import { issueChallenge } from '@tokenforge/protocol';
import { KvChallengeStore } from '../lib/kv-challenge-store.js';
import { InMemoryDb } from '../lib/db-mem.js';
import { InMemoryKv } from '../lib/kv-mem.js';
import { apiKey } from '../middleware/api-key.js';
import { handleDbscRegister } from '../routes/sessions.dbsc-register.js';
import { createTestApp } from './fixtures.js';
import type { App as AppRow } from '@tokenforge/db';

const subtle = (webcrypto as unknown as Crypto).subtle;
const REGISTRATION_URL = 'http://api.test/v1/sessions/dbsc-register';
const REFRESH_URL = 'http://api.test/v1/sessions/refresh';

let db: InMemoryDb;
let kv: InMemoryKv;
let app: Hono;
let liveKey: string;
let appRow: AppRow;

function buildApp() {
  const a = new Hono();
  const store = new KvChallengeStore(kv as unknown as KVNamespace);
  a.use('/v1/sessions/*', apiKey({ db: () => db }));
  a.post('/v1/sessions/dbsc-register', async (c) =>
    handleDbscRegister(c, {
      db, challengeStore: store, registrationUrl: REGISTRATION_URL, refreshUrl: REFRESH_URL,
    }),
  );
  return a;
}

beforeEach(async () => {
  db = new InMemoryDb();
  kv = new InMemoryKv();
  const t = await createTestApp();
  appRow = t.app;
  liveKey = t.liveKey;
  db.apps.set(appRow.id, appRow);
  app = buildApp();
});

async function buildDbscJwt(jti: string, aud: string): Promise<{
  jws: string; pubJwk: JsonWebKey;
}> {
  const pair = (await subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'],
  )) as CryptoKeyPair;
  const jwk = (await subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey;
  const pubJwk: JsonWebKey = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
  const header = { alg: 'ES256', typ: 'jwt', jwk: pubJwk };
  const payload = { aud, jti };
  const headerB64 = b64u(JSON.stringify(header));
  const payloadB64 = b64u(JSON.stringify(payload));
  const sig = await subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey,
    new TextEncoder().encode(`${headerB64}.${payloadB64}`),
  );
  const sigB64 = bytesToB64u(new Uint8Array(sig));
  return { jws: `${headerB64}.${payloadB64}.${sigB64}`, pubJwk };
}

function b64u(s: string): string {
  return bytesToB64u(new TextEncoder().encode(s));
}
function bytesToB64u(b: Uint8Array): string {
  return Buffer.from(b).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('DBSC native registration', () => {
  it('binds a session with binding_class=native_dbsc and returns W3C-shape JSON', async () => {
    const store = new KvChallengeStore(kv as unknown as KVNamespace);
    const issued = await issueChallenge(store, {
      tenantId: appRow.tenantId, purpose: 'register',
    });
    const { jws } = await buildDbscJwt(issued.challenge, REGISTRATION_URL);
    const r = await app.request(`${REGISTRATION_URL}?app_id=${appRow.id}&subject=u_native`, {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, 'Content-Type': 'application/jwt' },
      body: jws,
    });
    expect(r.status).toBe(200);
    const j = (await r.json()) as Record<string, unknown>;
    expect(j.session_identifier).toMatch(/^tf_sess_/);
    expect(j.refresh_url).toBe(REFRESH_URL);
    expect((j.scope as { origin: string }).origin).toBe(appRow.origin);
    const setCookie = r.headers.getSetCookie();
    expect(setCookie.some((c) => c.startsWith('tf_bound='))).toBe(true);
    const sessions = [...db.sessions.values()];
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.bindingClass).toBe('native_dbsc');
  });

  it('rejects when Content-Type is not application/jwt', async () => {
    const r = await app.request(`${REGISTRATION_URL}?app_id=${appRow.id}&subject=u`, {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(r.status).toBe(415);
  });

  it('rejects when the challenge is unknown / expired', async () => {
    const { jws } = await buildDbscJwt('forged-nonce', REGISTRATION_URL);
    const r = await app.request(`${REGISTRATION_URL}?app_id=${appRow.id}&subject=u`, {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, 'Content-Type': 'application/jwt' },
      body: jws,
    });
    expect(r.status).toBe(401);
  });

  it('rejects audience mismatch', async () => {
    const store = new KvChallengeStore(kv as unknown as KVNamespace);
    const issued = await issueChallenge(store, {
      tenantId: appRow.tenantId, purpose: 'register',
    });
    const { jws } = await buildDbscJwt(issued.challenge, 'https://wrong.example');
    const r = await app.request(`${REGISTRATION_URL}?app_id=${appRow.id}&subject=u`, {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, 'Content-Type': 'application/jwt' },
      body: jws,
    });
    expect(r.status).toBe(401);
  });

  it('rejects app_id mismatch', async () => {
    const store = new KvChallengeStore(kv as unknown as KVNamespace);
    const issued = await issueChallenge(store, {
      tenantId: appRow.tenantId, purpose: 'register',
    });
    const { jws } = await buildDbscJwt(issued.challenge, REGISTRATION_URL);
    const r = await app.request(`${REGISTRATION_URL}?app_id=app_wrong&subject=u`, {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, 'Content-Type': 'application/jwt' },
      body: jws,
    });
    expect(r.status).toBe(403);
  });

  it('rejects empty body', async () => {
    const r = await app.request(`${REGISTRATION_URL}?app_id=${appRow.id}&subject=u`, {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, 'Content-Type': 'application/jwt' },
      body: '',
    });
    expect(r.status).toBe(400);
  });

  it('rejects when query params are missing', async () => {
    const store = new KvChallengeStore(kv as unknown as KVNamespace);
    const issued = await issueChallenge(store, {
      tenantId: appRow.tenantId, purpose: 'register',
    });
    const { jws } = await buildDbscJwt(issued.challenge, REGISTRATION_URL);
    const r = await app.request(REGISTRATION_URL, {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, 'Content-Type': 'application/jwt' },
      body: jws,
    });
    expect(r.status).toBe(400);
  });
});
