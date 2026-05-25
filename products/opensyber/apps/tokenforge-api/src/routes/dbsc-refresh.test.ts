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

const { mockConsume, mockVerifyJws, mockHashCookie, mockIssueCookie } = vi.hoisted(() => ({
  mockConsume: vi.fn(),
  mockVerifyJws: vi.fn(),
  mockHashCookie: vi.fn(),
  mockIssueCookie: vi.fn(),
}));
vi.mock('@opensyber/tokenforge/server/internal', async (orig) => {
  const actual = await (orig as () => Promise<Record<string, unknown>>)();
  return {
    ...actual,
    consumeChallenge: mockConsume,
    verifyCompactJws: mockVerifyJws,
    hashBoundCookie: mockHashCookie,
    issueBoundCookie: mockIssueCookie,
    setBoundCookieHeader: () => '__Secure-tf-bound=new-cookie; Path=/; Secure; HttpOnly',
    BOUND_COOKIE_NAME: '__Secure-tf-bound',
  };
});

vi.mock('../services/dbsc/refresh-actions.js', () => ({
  computeRefreshAction: vi.fn(async () => ({ action: 'allow', signals: [] })),
  fireActionWebhooks: vi.fn(),
}));

import worker from '../index.js';

const SESSION_ID = 'tf-dbsc-session-1';
const CHALLENGE = 'challenge-12345678';
const COOKIE_HASH = 'cookie-hash-match';

async function postRefresh(
  body: unknown,
  env: Env,
  headers: Record<string, string> = {},
): Promise<Response> {
  return worker.fetch(
    new Request('http://localhost/v1/dbsc/refresh', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer tf_test',
        'Sec-Session-Response': 'eyJhbGc.payload.signature',
        cookie: `__Secure-tf-bound=raw-cookie-value`,
        ...headers,
      },
      body: JSON.stringify(body),
    }),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

const okSession = (over: Record<string, unknown> = {}) => ({
  id: SESSION_ID,
  tenantId: 't1',
  deviceId: 'dev_1',
  publicKey: 'jwk-stub',
  boundCookieHash: COOKIE_HASH,
  boundCookieIssuedAt: '2026-05-01T00:00:00.000Z',
  boundCookieExpiresAt: '2026-05-03T01:00:00.000Z',
  attestation: JSON.stringify({ country: 'US', asn: '1', ua: 'TestAgent' }),
  revoked: 0,
  ...over,
});

describe('POST /v1/dbsc/refresh', () => {
  let env: Env;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockConsume.mockResolvedValue({ ok: true });
    mockVerifyJws.mockResolvedValue({
      ok: true,
      claims: { sub: SESSION_ID, nonce: CHALLENGE },
    });
    mockHashCookie.mockResolvedValue(COOKIE_HASH);
    mockIssueCookie.mockResolvedValue({
      hash: 'new-hash', issuedAt: 'now', expiresAt: 'later', maxAgeSeconds: 300,
    });
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('returns 400 missing_session_response when Sec-Session-Response header absent', async () => {
    const r = await worker.fetch(
      new Request('http://localhost/v1/dbsc/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer tf_test' },
        body: JSON.stringify({ sessionId: SESSION_ID, challenge: CHALLENGE }),
      }),
      env,
      { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
    );
    expect(r.status).toBe(400);
    expect((await r.json() as { error: string }).error).toBe('missing_session_response');
  });

  it('returns 404 session_not_found when DB has no row', async () => {
    db._setSelectResult([]);
    const r = await postRefresh({ sessionId: SESSION_ID, challenge: CHALLENGE }, env);
    expect(r.status).toBe(404);
    expect((await r.json() as { error: string }).error).toBe('session_not_found');
  });

  it('returns 401 session_revoked when session.revoked truthy', async () => {
    db._setSelectResult([okSession({ revoked: 1 })]);
    const r = await postRefresh({ sessionId: SESSION_ID, challenge: CHALLENGE }, env);
    expect(r.status).toBe(401);
    expect((await r.json() as { error: string }).error).toBe('session_revoked');
  });

  it('returns 401 bound_cookie_missing when no cookie sent', async () => {
    db._setSelectResult([okSession()]);
    const r = await worker.fetch(
      new Request('http://localhost/v1/dbsc/refresh', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer tf_test',
          'Sec-Session-Response': 'jws-stub',
        },
        body: JSON.stringify({ sessionId: SESSION_ID, challenge: CHALLENGE }),
      }),
      env,
      { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
    );
    expect((await r.json() as { error: string }).error).toBe('bound_cookie_missing');
  });

  it('returns 401 bound_cookie_mismatch when hash differs from session', async () => {
    db._setSelectResult([okSession()]);
    mockHashCookie.mockResolvedValueOnce('different-hash');
    const r = await postRefresh({ sessionId: SESSION_ID, challenge: CHALLENGE }, env);
    expect(r.status).toBe(401);
    expect((await r.json() as { error: string }).error).toBe('bound_cookie_mismatch');
  });

  it('returns 400 with consumeChallenge reason when challenge already used', async () => {
    db._setSelectResult([okSession()]);
    mockConsume.mockResolvedValueOnce({ ok: false, reason: 'already_consumed' });
    const r = await postRefresh({ sessionId: SESSION_ID, challenge: CHALLENGE }, env);
    expect(r.status).toBe(400);
    expect((await r.json() as { error: string }).error).toBe('already_consumed');
  });

  it('returns 401 jws_subject_mismatch when JWS sub differs from sessionId', async () => {
    db._setSelectResult([okSession()]);
    mockVerifyJws.mockResolvedValueOnce({
      ok: true,
      claims: { sub: 'different-session', nonce: CHALLENGE },
    });
    const r = await postRefresh({ sessionId: SESSION_ID, challenge: CHALLENGE }, env);
    expect((await r.json() as { error: string }).error).toBe('jws_subject_mismatch');
  });

  it('returns 200 with action+sessionId and rotates cookie on happy path', async () => {
    db._setSelectResult([okSession()]);
    const r = await postRefresh({ sessionId: SESSION_ID, challenge: CHALLENGE }, env);
    expect(r.status).toBe(200);
    const j = (await r.json()) as { data: { action: string; sessionId: string; maxAgeSeconds: number } };
    expect(j.data.action).toBe('allow');
    expect(j.data.sessionId).toBe(SESSION_ID);
    expect(j.data.maxAgeSeconds).toBe(300);
    expect(r.headers.get('Set-Cookie')).toContain('__Secure-tf-bound=new-cookie');
    expect(r.headers.get('Sec-TF-Channel-Bound')).toBe('0');
  });
});
