/**
 * Phase 9 e2e: workforce OIDC flow.
 *
 * Customer-side OIDC dance has finished — they hand TokenForge the
 * resulting `id_token` plus the browser-side public key. We mock the
 * IdP's discovery + JWKS endpoints, mint a real RSA-signed id_token,
 * and assert the binding lands as `binding_class: 'webcrypto'` under
 * the IdP's `sub` claim.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { Hono } from 'hono';
import { KvChallengeStore } from '../lib/kv-challenge-store.js';
import { InMemoryDb } from '../lib/db-mem.js';
import { InMemoryKv } from '../lib/kv-mem.js';
import { apiKey } from '../middleware/api-key.js';
import { handleOidcCallback } from '../routes/sso.oidc.js';
import { createTestApp } from './fixtures.js';
import type { App as AppRow } from '@tokenforge/db';

const subtle = (webcrypto as unknown as Crypto).subtle;

const ISSUER = 'https://idp.test';
const AUDIENCE = 'tf-app-aud';

let db: InMemoryDb;
let kv: InMemoryKv;
let app: Hono;
let liveKey: string;
let appRow: AppRow;
let mockFetch: ReturnType<typeof vi.fn>;
let idpJwk: JsonWebKey;
let idpPair: CryptoKeyPair;

function buildApp() {
  const a = new Hono();
  const store = new KvChallengeStore(kv as unknown as KVNamespace);
  a.use('/v1/sso/*', apiKey({ db: () => db }));
  a.post('/v1/sso/:appId/callback', async (c) =>
    handleOidcCallback(c, {
      db, challengeStore: store,
      refreshUrl: 'https://api.test/v1/sessions/refresh',
      fetchImpl: mockFetch as unknown as typeof globalThis.fetch,
    }),
  );
  return a;
}

async function makeIdpKey() {
  const pair = (await subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['sign', 'verify'],
  )) as CryptoKeyPair;
  const jwk = (await subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey & { kid?: string };
  jwk.kid = 'idp-key-1';
  return { pair, jwk: jwk as JsonWebKey };
}

async function mintIdToken(claims: Record<string, unknown>): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT', kid: 'idp-key-1' };
  const headerB64 = b64u(JSON.stringify(header));
  const payloadB64 = b64u(JSON.stringify(claims));
  const sig = await subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    idpPair.privateKey,
    new TextEncoder().encode(`${headerB64}.${payloadB64}`),
  );
  return `${headerB64}.${payloadB64}.${bytesToB64u(new Uint8Array(sig))}`;
}

function b64u(s: string): string {
  return bytesToB64u(new TextEncoder().encode(s));
}
function bytesToB64u(b: Uint8Array): string {
  return Buffer.from(b).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(async () => {
  db = new InMemoryDb();
  kv = new InMemoryKv();
  ({ pair: idpPair, jwk: idpJwk } = await makeIdpKey());
  const t = await createTestApp();
  liveKey = t.liveKey;
  appRow = {
    ...t.app,
    mode: 'workforce',
    idpType: 'oidc',
    idpConfig: { issuer: ISSUER, audience: AUDIENCE } as unknown as null,
  } as AppRow;
  db.apps.set(appRow.id, appRow);

  mockFetch = vi.fn(async (url: string | URL | Request) => {
    const u = String(url);
    if (u === `${ISSUER}/.well-known/openid-configuration`) {
      return jsonResponse({
        issuer: ISSUER,
        authorization_endpoint: `${ISSUER}/auth`,
        token_endpoint: `${ISSUER}/token`,
        jwks_uri: `${ISSUER}/jwks`,
      });
    }
    if (u === `${ISSUER}/jwks`) return jsonResponse({ keys: [idpJwk] });
    return new Response('not_found', { status: 404 });
  });
  app = buildApp();
});

async function browserPubJwk(): Promise<JsonWebKey> {
  const pair = (await subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'],
  )) as CryptoKeyPair;
  const jwk = (await subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey;
  return { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
}

describe('workforce OIDC SSO callback', () => {
  it('binds a session under the IdP sub claim and returns cookies', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await mintIdToken({
      iss: ISSUER, sub: 'okta_user_42', aud: AUDIENCE,
      exp: now + 600, iat: now,
      email: 'alice@workforce.example',
    });
    const r = await app.request(`/v1/sso/${appRow.id}/callback`, {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_token: token,
        public_key_jwk: await browserPubJwk(),
        binding_class: 'webcrypto',
      }),
    });
    expect(r.status).toBe(200);
    const j = (await r.json()) as { session_id: string; subject_email: string };
    expect(j.session_id).toMatch(/^tf_sess_/);
    expect(j.subject_email).toBe('alice@workforce.example');
    const session = [...db.sessions.values()][0]!;
    expect(session.bindingClass).toBe('webcrypto');
    const subj = [...db.subjects.values()].find((s) => s.externalSubject === 'okta_user_42');
    expect(subj).toBeTruthy();
  });

  it('rejects when app is in customer mode', async () => {
    appRow.mode = 'customer';
    const r = await app.request(`/v1/sso/${appRow.id}/callback`, {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: 'x.y.z', public_key_jwk: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' } }),
    });
    expect(r.status).toBe(400);
  });

  it('rejects when idp_config is missing', async () => {
    appRow.idpConfig = null;
    const r = await app.request(`/v1/sso/${appRow.id}/callback`, {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: 'x.y.z', public_key_jwk: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' } }),
    });
    expect(r.status).toBe(400);
  });

  it('rejects an id_token signed by an unknown key', async () => {
    const otherIdp = await makeIdpKey();
    const headerB64 = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'unknown-kid' }));
    const now = Math.floor(Date.now() / 1000);
    const payloadB64 = b64u(JSON.stringify({
      iss: ISSUER, sub: 'forged', aud: AUDIENCE, exp: now + 600, iat: now,
    }));
    const sig = await subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' },
      otherIdp.pair.privateKey,
      new TextEncoder().encode(`${headerB64}.${payloadB64}`),
    );
    const forged = `${headerB64}.${payloadB64}.${bytesToB64u(new Uint8Array(sig))}`;
    const r = await app.request(`/v1/sso/${appRow.id}/callback`, {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_token: forged,
        public_key_jwk: await browserPubJwk(),
      }),
    });
    expect(r.status).toBe(401);
    expect(db.audit.find((e) => e.type === 'oidc_failed')).toBeTruthy();
  });

  it('rejects a malformed body', async () => {
    const r = await app.request(`/v1/sso/${appRow.id}/callback`, {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(r.status).toBe(400);
  });

  it('returns 502 when the IdP discovery doc 5xxs', async () => {
    mockFetch.mockImplementation(async () => new Response('boom', { status: 503 }));
    const r = await app.request(`/v1/sso/${appRow.id}/callback`, {
      method: 'POST',
      headers: { 'X-TokenForge-Key': liveKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_token: 'aaaa.bbbb.cccc',
        public_key_jwk: await browserPubJwk(),
      }),
    });
    expect(r.status).toBe(502);
  });
});
