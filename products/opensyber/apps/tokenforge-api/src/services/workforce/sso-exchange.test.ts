import { describe, it, expect, vi, beforeEach } from 'vitest';
import { webcrypto } from 'node:crypto';
import { exchangeSso, type ExchangeInput } from './sso-exchange.js';
import type {
  ChallengeRecord,
  ChallengeStore,
  JwksKey,
} from '@opensyber/tokenforge/server/internal';

const subtle = (webcrypto as unknown as Crypto).subtle;

function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return Buffer.from(bin, 'binary').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function buildIdToken(
  payload: Record<string, unknown>,
  kid = 'kid-1',
): Promise<{ jwt: string; jwks: { keys: JwksKey[] } }> {
  const pair = await subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const jwk = await subtle.exportKey('jwk', pair.publicKey);
  const headerB64 = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid }));
  const payloadB64 = b64url(JSON.stringify(payload));
  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sigBuf = new Uint8Array(await subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, signingInput));
  const jwt = `${headerB64}.${payloadB64}.${b64url(sigBuf)}`;
  const jwks: { keys: JwksKey[] } = {
    keys: [{
      kid,
      kty: 'RSA',
      alg: 'RS256',
      n: jwk.n,
      e: jwk.e,
    }],
  };
  return { jwt, jwks };
}

function makeStore(): ChallengeStore {
  const records: ChallengeRecord[] = [];
  return {
    put: vi.fn(async (r: ChallengeRecord) => { records.push(r); }),
    takeIfFresh: vi.fn(async () => null),
  };
}

const fixedNow = '2026-05-01T12:00:00.000Z';
const claims = (overrides: Record<string, unknown> = {}) => ({
  iss: 'https://acme.okta.com/oauth2/default',
  sub: 'okta-user-1',
  aud: 'tf-app-1',
  email: 'alice@acme.com',
  name: 'Alice Example',
  iat: Math.floor(Date.now() / 1000) - 30,
  exp: Math.floor(Date.now() / 1000) + 600,
  ...overrides,
});

interface MockDbState {
  workforceApps: Array<Record<string, unknown>>;
  subjects: Array<Record<string, unknown>>;
  inserts: Array<Record<string, unknown>>;
  updates: Array<Record<string, unknown>>;
}

function makeDb(state: MockDbState): unknown {
  let selectCalls = 0;
  const select = (): unknown => {
    const callIndex = selectCalls++;
    const chain: Record<string, unknown> = {};
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.limit = vi.fn(() => Promise.resolve(
      callIndex === 0 ? state.workforceApps : state.subjects,
    ));
    return chain;
  };
  return {
    select: vi.fn(select),
    insert: vi.fn(() => ({
      values: vi.fn(async (v: Record<string, unknown>) => { state.inserts.push(v); }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((v: Record<string, unknown>) => ({
        where: vi.fn(async () => { state.updates.push(v); }),
      })),
    })),
  };
}

const validApp = (overrides: Record<string, unknown> = {}) => ({
  id: 'wf-1',
  tenantId: 't1',
  issuer: 'https://acme.okta.com/oauth2/default',
  audience: 'tf-app-1',
  enabled: true,
  ...overrides,
});

async function run(state: MockDbState, appId: string, payload?: Record<string, unknown>) {
  const { jwt, jwks } = await buildIdToken(claims(payload));
  return exchangeSso(
    makeDb(state) as never,
    makeStore(),
    { tenantId: 't1', workforceAppId: appId, idToken: jwt, jwks } satisfies ExchangeInput,
  );
}

describe('exchangeSso', () => {
  let state: MockDbState;
  beforeEach(() => {
    state = { workforceApps: [], subjects: [], inserts: [], updates: [] };
  });

  it('rejects when workforce app does not exist', async () => {
    const result = await run(state, 'wf-missing');
    expect(result).toMatchObject({ ok: false, reason: 'workforce_app_not_found' });
  });

  it('rejects when ID token issuer mismatches workforce app issuer', async () => {
    state.workforceApps = [validApp({ issuer: 'https://different.example.com' })];
    expect(await run(state, 'wf-1')).toMatchObject({ ok: false, reason: 'iss_mismatch' });
  });

  it('rejects disabled workforce app', async () => {
    state.workforceApps = [validApp({ enabled: false })];
    expect(await run(state, 'wf-1')).toMatchObject({ ok: false, reason: 'workforce_app_disabled' });
  });

  it('aud_mismatch when ID token audience differs from app.audience', async () => {
    state.workforceApps = [validApp({ audience: 'tf-other' })];
    expect(await run(state, 'wf-1')).toMatchObject({ ok: false, reason: 'aud_mismatch' });
  });

  it('email=null when ID token has no string email claim', async () => {
    state.workforceApps = [validApp()];
    expect(await run(state, 'wf-1', { email: null })).toMatchObject({ ok: true, email: null });
  });

  it('extractMetadata captures groups + preferred_username + locale together', async () => {
    state.workforceApps = [validApp()];
    await run(state, 'wf-1', { groups: ['eng'], preferred_username: 'alice', locale: 'en-US' });
    expect(JSON.parse(state.inserts[0]?.metadata as string))
      .toEqual({ groups: ['eng'], preferred_username: 'alice', locale: 'en-US' });
  });

  it('extractMetadata returns null when no recognized claims present', async () => {
    state.workforceApps = [validApp()];
    await run(state, 'wf-1');
    expect(state.inserts[0]?.metadata).toBeNull();
  });

  it('existing subject update sets email + metadata, not just lastSeenAt', async () => {
    state.workforceApps = [validApp()];
    state.subjects = [{ id: 'sub-1', workforceAppId: 'wf-1', externalSubject: 'okta-user-1' }];
    await run(state, 'wf-1', { groups: ['eng'] });
    expect(state.updates[0]).toMatchObject({ email: 'alice@acme.com', metadata: expect.stringContaining('eng') });
  });

  it('upserts subject + issues challenge on valid token (new subject)', async () => {
    state.workforceApps = [validApp()];
    const result = await run(state, 'wf-1', { groups: ['eng', 'admin'] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.externalSubject).toBe('okta-user-1');
      expect(result.email).toBe('alice@acme.com');
      expect(result.challenge.length).toBeGreaterThan(20);
      expect(state.inserts.length).toBe(1);
      expect(state.inserts[0]?.metadata).toContain('eng');
    }
  });

  it('updates lastSeenAt on existing subject', async () => {
    state.workforceApps = [validApp()];
    state.subjects = [{
      id: 'tf-sub-existing',
      workforceAppId: 'wf-1',
      externalSubject: 'okta-user-1',
    }];
    const result = await run(state, 'wf-1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.subjectId).toBe('tf-sub-existing');
    expect(state.inserts.length).toBe(0);
    expect(state.updates.length).toBe(1);
    expect(state.updates[0]?.lastSeenAt).toBeDefined();
  });
});
