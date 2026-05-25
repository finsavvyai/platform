import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockEnv, createMockDb } from '../test/helpers.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as Record<string, unknown>).__mockDb),
}));
vi.mock('hono/logger', () => ({
  logger: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../middleware/tenant-auth.js', () => ({
  tenantAuth: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set('tenantId', 't1');
    c.set('tenantPlan', 'pro');
    await next();
  },
}));
vi.mock('../middleware/usage-limit.js', () => ({ usageLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); } }));
vi.mock('../middleware/rate-limit.js', () => ({
  publicRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  apiRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  rateLimit: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../middleware/guard.js', () => ({
  guardMiddleware: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));

const { mockGetJwks, mockExchangeSso } = vi.hoisted(() => ({
  mockGetJwks: vi.fn(),
  mockExchangeSso: vi.fn(),
}));
vi.mock('../services/workforce/jwks-cache.js', () => ({ getJwks: mockGetJwks }));
vi.mock('../services/workforce/sso-exchange.js', () => ({ exchangeSso: mockExchangeSso }));

import worker from '../index.js';

const APP_ID = 'tf-wf-app-1';

async function postExchange(
  appId: string,
  body: unknown,
  env: Env,
): Promise<Response> {
  return worker.fetch(
    new Request(`http://localhost/v1/workforce/sso/${appId}/exchange`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer tf_test' },
      body: JSON.stringify(body),
    }),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

const validApp = (over: Record<string, unknown> = {}) => ({
  id: APP_ID,
  tenantId: 't1',
  issuer: 'https://acme.okta.com/oauth2/default',
  audience: 'tf-app-1',
  jwksUri: 'https://acme.okta.com/oauth2/default/v1/keys',
  enabled: true,
  ...over,
});

const ID_TOKEN = 'eyJhbGciOiJSUzI1NiJ9.payload.signature';

describe('POST /v1/workforce/sso/:appId/exchange', () => {
  let env: Env;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
    mockGetJwks.mockResolvedValue({ keys: [{ kid: 'kid-1', kty: 'RSA' }] });
    mockExchangeSso.mockResolvedValue({
      ok: true,
      subjectId: 'tf-sub-1',
      externalSubject: 'okta-user-1',
      email: 'alice@acme.com',
      challenge: 'register-challenge-32bytes-base64url',
      challengeExpiresAt: '2026-05-03T01:00:00.000Z',
    });
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('returns 400 invalid_payload when idToken missing', async () => {
    const r = await postExchange(APP_ID, {}, env);
    expect(r.status).toBe(400);
    expect((await r.json() as { error: string }).error).toBe('invalid_payload');
  });

  it('returns 400 invalid_payload when idToken too short (<20 chars)', async () => {
    const r = await postExchange(APP_ID, { idToken: 'short' }, env);
    expect(r.status).toBe(400);
    expect((await r.json() as { error: string }).error).toBe('invalid_payload');
  });

  it('returns 404 workforce_app_not_found when DB has no matching app', async () => {
    db._setSelectResult([]);
    const r = await postExchange('tf-wf-missing', { idToken: ID_TOKEN }, env);
    expect(r.status).toBe(404);
    expect((await r.json() as { error: string }).error).toBe('workforce_app_not_found');
  });

  it('returns 503 jwks_unavailable when getJwks returns null', async () => {
    db._setSelectResult([validApp()]);
    mockGetJwks.mockResolvedValueOnce(null);
    const r = await postExchange(APP_ID, { idToken: ID_TOKEN }, env);
    expect(r.status).toBe(503);
    expect((await r.json() as { error: string }).error).toBe('jwks_unavailable');
  });

  it('returns 401 with exchangeSso reason when token verification fails', async () => {
    db._setSelectResult([validApp()]);
    mockExchangeSso.mockResolvedValueOnce({ ok: false, reason: 'iss_mismatch' });
    const r = await postExchange(APP_ID, { idToken: ID_TOKEN }, env);
    expect(r.status).toBe(401);
    expect((await r.json() as { error: string }).error).toBe('iss_mismatch');
  });

  it('returns 200 with subjectId/email/challenge on happy path', async () => {
    db._setSelectResult([validApp()]);
    const r = await postExchange(APP_ID, { idToken: ID_TOKEN }, env);
    expect(r.status).toBe(200);
    const j = (await r.json()) as {
      data: {
        subjectId: string;
        externalSubject: string;
        email: string;
        challenge: string;
        challengeExpiresAt: string;
        registerUrl: string;
      };
    };
    expect(j.data.subjectId).toBe('tf-sub-1');
    expect(j.data.externalSubject).toBe('okta-user-1');
    expect(j.data.email).toBe('alice@acme.com');
    expect(j.data.challenge).toBe('register-challenge-32bytes-base64url');
    expect(j.data.registerUrl).toBe('/v1/dbsc/register');
    expect(mockExchangeSso).toHaveBeenCalledTimes(1);
    const args = mockExchangeSso.mock.calls[0]![2] as Record<string, unknown>;
    expect(args.tenantId).toBe('t1');
    expect(args.workforceAppId).toBe(APP_ID);
    expect(args.idToken).toBe(ID_TOKEN);
  });

  it('Sprint 36 line 54: JWKS-cache → OIDC-verifier wire-up — getJwks called with app.jwksUri, result threaded into exchangeSso.jwks arg', async () => {
    // The end-to-end e2e wiring pin: route fetches JWKS from cache,
    // passes the exact result to exchangeSso (which calls verifyOidcIdToken
    // internally). Locks the chain so a future refactor can't accidentally
    // pass a stale/global JWKS or skip the cache lookup.
    db._setSelectResult([validApp()]);
    const jwksFromCache = { keys: [{ kid: 'kid-1', kty: 'RSA' as const }] };
    mockGetJwks.mockResolvedValueOnce(jwksFromCache);
    await postExchange(APP_ID, { idToken: ID_TOKEN }, env);
    expect(mockGetJwks).toHaveBeenCalledTimes(1);
    expect(mockGetJwks.mock.calls[0]![1]).toBe('https://acme.okta.com/oauth2/default/v1/keys');
    const ssoArgs = mockExchangeSso.mock.calls[0]![2] as Record<string, unknown>;
    expect(ssoArgs.jwks).toBe(jwksFromCache);
  });

  it('passes tenantId scope so cross-tenant app lookup is blocked', async () => {
    // The route reads tenantId from c.get('tenantId') (always 't1' here) and
    // queries with both id + tenantId. If the app exists for a different
    // tenant, the DB-level WHERE filters it out → 404 path runs.
    db._setSelectResult([]);
    const r = await postExchange(APP_ID, { idToken: ID_TOKEN }, env);
    expect(r.status).toBe(404);
  });
});
