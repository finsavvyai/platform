/**
 * Action-branch tests for POST /v1/dbsc/refresh.
 * Lives in a sibling file so dbsc-refresh.test.ts stays focused on the
 * pre-action gate (header/cookie/challenge/JWS subject) while these
 * pin the risk-engine action paths (block / revoke_session / step_up)
 * and the remaining JWS verify failures.
 */

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
    c.set('tenantId', 't1'); c.set('tenantPlan', 'pro'); await next();
  },
}));
vi.mock('../middleware/usage-limit.js', () => ({ usageLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); } }));
vi.mock('../middleware/rate-limit.js', () => ({
  publicRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  apiRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  rateLimit: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../middleware/guard.js', () => ({ guardMiddleware: () => async (_c: unknown, next: () => Promise<void>) => { await next(); } }));

const { mockConsume, mockVerifyJws, mockHashCookie, mockIssueCookie } = vi.hoisted(() => ({
  mockConsume: vi.fn(), mockVerifyJws: vi.fn(), mockHashCookie: vi.fn(), mockIssueCookie: vi.fn(),
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

const { mockComputeAction, mockFireWebhooks } = vi.hoisted(() => ({
  mockComputeAction: vi.fn(), mockFireWebhooks: vi.fn(),
}));
vi.mock('../services/dbsc/refresh-actions.js', () => ({
  computeRefreshAction: mockComputeAction,
  fireActionWebhooks: mockFireWebhooks,
}));

import worker from '../index.js';

const SESSION_ID = 'sess_1';
const CHALLENGE = 'challenge-12345678';
const COOKIE_HASH = 'h-match';

const okSession = (over: Record<string, unknown> = {}) => ({
  id: SESSION_ID, tenantId: 't1', deviceId: 'dev_1', publicKey: 'jwk-stub',
  boundCookieHash: COOKIE_HASH, boundCookieIssuedAt: '2026-05-01T00:00:00.000Z',
  boundCookieExpiresAt: '2026-05-03T01:00:00.000Z',
  attestation: JSON.stringify({ country: 'US', asn: '1', ua: 'TestAgent' }),
  revoked: 0, ...over,
});

async function post(body: unknown, env: Env): Promise<Response> {
  return worker.fetch(
    new Request('http://localhost/v1/dbsc/refresh', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer tf_test',
        'Sec-Session-Response': 'eyJ.payload.sig',
        cookie: '__Secure-tf-bound=raw',
      },
      body: JSON.stringify(body),
    }),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

describe('POST /v1/dbsc/refresh — action branches', () => {
  let env: Env;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
    db._setSelectResult([okSession()]);
    mockConsume.mockResolvedValue({ ok: true });
    mockVerifyJws.mockResolvedValue({ ok: true, claims: { sub: SESSION_ID, nonce: CHALLENGE } });
    mockHashCookie.mockResolvedValue(COOKIE_HASH);
    mockIssueCookie.mockResolvedValue({ hash: 'new-h', issuedAt: 'now', expiresAt: 'later', maxAgeSeconds: 300 });
    mockComputeAction.mockResolvedValue({ action: 'allow', signals: [] });
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('400 invalid_payload when challenge is shorter than 8 chars', async () => {
    const r = await post({ sessionId: SESSION_ID, challenge: 'short' }, env);
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toBe('invalid_payload');
  });

  it('401 jws_nonce_mismatch when JWS nonce claim != request challenge', async () => {
    mockVerifyJws.mockResolvedValueOnce({ ok: true, claims: { sub: SESSION_ID, nonce: 'other-nonce' } });
    const r = await post({ sessionId: SESSION_ID, challenge: CHALLENGE }, env);
    expect(r.status).toBe(401);
    expect(((await r.json()) as { error: string }).error).toBe('jws_nonce_mismatch');
  });

  it('401 forwards verifyCompactJws.reason verbatim when verify ok=false', async () => {
    mockVerifyJws.mockResolvedValueOnce({ ok: false, reason: 'jws_expired' });
    const r = await post({ sessionId: SESSION_ID, challenge: CHALLENGE }, env);
    expect(r.status).toBe(401);
    expect(((await r.json()) as { error: string }).error).toBe('jws_expired');
  });

  it('action=block → 401 + sets revokedReason=risk_block on the session row', async () => {
    mockComputeAction.mockResolvedValueOnce({ action: 'block', signals: ['geo_jump'] });
    const r = await post({ sessionId: SESSION_ID, challenge: CHALLENGE }, env);
    expect(r.status).toBe(401);
    const body = (await r.json()) as { data: { action: string; signals: string[] } };
    expect(body.data.action).toBe('block');
    expect(body.data.signals).toEqual(['geo_jump']);
    expect(db._updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ revoked: true, revokedReason: 'risk_block' }),
    );
  });

  it('action=revoke_session → 401 + sets revokedReason=policy_revoke', async () => {
    mockComputeAction.mockResolvedValueOnce({ action: 'revoke_session', signals: [] });
    const r = await post({ sessionId: SESSION_ID, challenge: CHALLENGE }, env);
    expect(r.status).toBe(401);
    expect(db._updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ revoked: true, revokedReason: 'policy_revoke' }),
    );
  });

  it('action=step_up → 200 + does NOT rotate the bound cookie', async () => {
    mockComputeAction.mockResolvedValueOnce({ action: 'step_up', signals: ['ua_drift'] });
    const r = await post({ sessionId: SESSION_ID, challenge: CHALLENGE }, env);
    expect(r.status).toBe(200);
    const body = (await r.json()) as { data: { action: string } };
    expect(body.data.action).toBe('step_up');
    expect(r.headers.get('Set-Cookie')).toBeNull();
    expect(mockIssueCookie).not.toHaveBeenCalled();
  });

  it('cookie header present but no TF cookie → 401 bound_cookie_missing (readCookie loop fallthrough, line 162)', async () => {
    const r = await worker.fetch(
      new Request('http://localhost/v1/dbsc/refresh', {
        method: 'POST',
        headers: {
          'content-type': 'application/json', authorization: 'Bearer tf_test',
          'Sec-Session-Response': 'eyJ.payload.sig',
          cookie: 'sessionid=abc; csrftoken=xyz', // no __Secure-tf-bound entry
        },
        body: JSON.stringify({ sessionId: SESSION_ID, challenge: CHALLENGE }),
      }),
      env,
      { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
    );
    expect(r.status).toBe(401);
    expect(((await r.json()) as { error: string }).error).toBe('bound_cookie_missing');
  });
});
