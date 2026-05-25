import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockEnv, createMockDb } from '../test/helpers.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({ createDb: vi.fn(() => (globalThis as Record<string, unknown>).__mockDb) }));
vi.mock('hono/logger', () => ({ logger: () => async (_c: unknown, next: () => Promise<void>) => { await next(); } }));
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

const { mockVerifyAction } = vi.hoisted(() => ({ mockVerifyAction: vi.fn() }));
vi.mock('@opensyber/tokenforge/server/internal', async (orig) => {
  const actual = await (orig as () => Promise<Record<string, unknown>>)();
  return { ...actual, verifyAction: mockVerifyAction };
});

import worker from '../index.js';

const VALID_HEX = '0123456789abcdef'.repeat(4); // 64 chars

async function postVerify(body: unknown, env: Env, headers: Record<string, string> = {}): Promise<Response> {
  return worker.fetch(
    new Request('http://localhost/v1/actions/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer tf_test', ...headers },
      body: JSON.stringify(body),
    }),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

const okSession = (over: Record<string, unknown> = {}) => ({
  id: 'tf-dbsc-1', tenantId: 't1', deviceId: 'dev_1',
  publicKey: '{"kty":"EC","crv":"P-256"}', alg: 'ES256', origin: 'https://app.example.com',
  boundCookieHash: 'h', boundCookieIssuedAt: new Date().toISOString(),
  boundCookieExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
  attestation: null, revoked: false, ...over,
});

const validBody = (over: Record<string, unknown> = {}) => ({
  jws: 'header.payload.signature-this-is-long-enough-to-pass-min-40',
  sessionId: 'tf-dbsc-1', expectedAction: 'checkout', ...over,
});

describe('POST /v1/actions/verify', () => {
  let env: Env;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
  });

  it('Sprint 37 line 113: bound cookie present + JWS missing → 401 jws_required', async () => {
    // Bound cookie = session lookup succeeds (not revoked, not expired).
    // JWS absent → 401 (not 400) per Sprint 37 spec: 401 communicates
    // "you're recognized but not authenticated by a fresh signature",
    // 400 would falsely imply a malformed request.
    db._setSelectResult([okSession()]);
    const r = await postVerify({ sessionId: 'tf-dbsc-1', expectedAction: 'checkout' }, env);
    expect(r.status).toBe(401);
    expect(((await r.json()) as { error: string }).error).toBe('jws_required');
  });

  it('400 invalid_payload when JWS is malformed (too short for schema min 40)', async () => {
    // Schema-level rejection still fires for a present-but-malformed JWS.
    // Distinguishes "you sent garbage" (400) from "you sent nothing on a
    // privileged route with a bound cookie" (401) per Sprint 37 line 113.
    const r = await postVerify({ jws: 'short', sessionId: 'x', expectedAction: 'checkout' }, env);
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toBe('invalid_payload');
  });

  it('404 session_not_found when DB returns no rows', async () => {
    db._setSelectResult([]);
    const r = await postVerify(validBody(), env);
    expect(r.status).toBe(404);
    expect(((await r.json()) as { error: string }).error).toBe('session_not_found');
  });

  it('401 session_revoked when session.revoked is true', async () => {
    db._setSelectResult([okSession({ revoked: true })]);
    const r = await postVerify(validBody(), env);
    expect(r.status).toBe(401);
    expect(((await r.json()) as { error: string }).error).toBe('session_revoked');
  });

  it('401 session_expired when boundCookieExpiresAt is in the past', async () => {
    db._setSelectResult([okSession({ boundCookieExpiresAt: new Date(Date.now() - 1000).toISOString() })]);
    const r = await postVerify(validBody(), env);
    expect(r.status).toBe(401);
    expect(((await r.json()) as { error: string }).error).toBe('session_expired');
  });

  it('401 with verifyAction reason when JWS verification fails', async () => {
    db._setSelectResult([okSession()]);
    mockVerifyAction.mockResolvedValueOnce({ ok: false, reason: 'action_hash_mismatch' });
    const r = await postVerify(validBody({ body: { amount: 100 } }), env);
    expect(r.status).toBe(401);
    expect(((await r.json()) as { error: string }).error).toBe('action_hash_mismatch');
  });

  it('200 verified=true on happy path with claims echoed in response', async () => {
    db._setSelectResult([okSession()]);
    mockVerifyAction.mockResolvedValueOnce({
      ok: true,
      claims: { sub: 'tf-dbsc-1', iat: 1, exp: 100, nonce: 'n', action: 'checkout' },
      protectedHeader: {},
    });
    const r = await postVerify(validBody(), env);
    expect(r.status).toBe(200);
    const j = (await r.json()) as { data: { verified: boolean; action: string; channelBound: boolean } };
    expect(j.data.verified).toBe(true);
    expect(j.data.action).toBe('checkout');
    expect(j.data.channelBound).toBe(false); // no exporter header
  });

  it('passes X-TF-Channel-Exporter through to verifyAction expectedTlsExporter', async () => {
    db._setSelectResult([okSession()]);
    mockVerifyAction.mockResolvedValueOnce({
      ok: true,
      claims: { sub: 'tf-dbsc-1', iat: 1, exp: 100, nonce: 'n', action: 'checkout' },
      protectedHeader: {},
    });
    const r = await postVerify(validBody(), env, { 'X-TF-Channel-Exporter': VALID_HEX });
    expect(r.status).toBe(200);
    expect(r.headers.get('Sec-TF-Channel-Bound')).toBe('1');
    const opts = mockVerifyAction.mock.calls[0]![1] as { expectedTlsExporter?: string };
    expect(opts.expectedTlsExporter).toBe(VALID_HEX);
    const j = (await r.json()) as { data: { channelBound: boolean } };
    expect(j.data.channelBound).toBe(true);
  });

  it('emits Sec-TF-Channel-Bound: 0 when no exporter header is supplied', async () => {
    db._setSelectResult([okSession()]);
    mockVerifyAction.mockResolvedValueOnce({
      ok: true,
      claims: { sub: 'tf-dbsc-1', iat: 1, exp: 100, nonce: 'n', action: 'checkout' },
      protectedHeader: {},
    });
    const r = await postVerify(validBody(), env);
    expect(r.headers.get('Sec-TF-Channel-Bound')).toBe('0');
    const opts = mockVerifyAction.mock.calls[0]![1] as { expectedTlsExporter?: string };
    expect(opts.expectedTlsExporter).toBeUndefined();
  });

  it('threads requireTlsExporter=true through when caller asks (sensitive route opt-in)', async () => {
    db._setSelectResult([okSession()]);
    mockVerifyAction.mockResolvedValueOnce({ ok: false, reason: 'tls_exporter_missing' });
    const r = await postVerify(validBody({ requireTlsExporter: true }), env);
    expect(r.status).toBe(401);
    expect(((await r.json()) as { error: string }).error).toBe('tls_exporter_missing');
    const opts = mockVerifyAction.mock.calls[0]![1] as { requireTlsExporter?: boolean };
    expect(opts.requireTlsExporter).toBe(true);
  });

  it('rejects 401 nonce_replay when same JWS nonce is posted twice (one-shot enforcement)', async () => {
    db._setSelectResult([okSession()]);
    mockVerifyAction.mockResolvedValue({
      ok: true,
      claims: { sub: 'tf-dbsc-1', iat: 1, exp: 100, nonce: 'replay-me', action: 'checkout' },
      protectedHeader: {},
    });
    // Pre-seed the cache as if a prior request already consumed this nonce.
    await env.CACHE.put('action_nonce:t1:replay-me', '1');
    const r = await postVerify(validBody(), env);
    expect(r.status).toBe(401);
    expect(((await r.json()) as { error: string }).error).toBe('nonce_replay');
  });

  it('persists the nonce to CACHE on successful verify (sets up one-shot for next request)', async () => {
    db._setSelectResult([okSession()]);
    mockVerifyAction.mockResolvedValueOnce({
      ok: true,
      claims: { sub: 'tf-dbsc-1', iat: 1, exp: 100, nonce: 'fresh-nonce', action: 'checkout' },
      protectedHeader: {},
    });
    const r = await postVerify(validBody({ maxAgeSeconds: 30 }), env);
    expect(r.status).toBe(200);
    expect(env.CACHE.put).toHaveBeenCalledWith(
      'action_nonce:t1:fresh-nonce',
      '1',
      { expirationTtl: 35 },
    );
  });
});
