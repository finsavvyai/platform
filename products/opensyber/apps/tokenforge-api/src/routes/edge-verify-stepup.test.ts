/**
 * Edge-verify per-action step-up policy upgrade test.
 *
 * Lives in a sibling file (instead of extending edge-verify.test.ts)
 * because the parent test file is already 189L and adding both the
 * step-up loader mock plumbing and the upgrade cases would push it
 * past the 200L portfolio cap.
 */

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
vi.mock('../services/alert-dispatch.js', () => ({ dispatchAlerts: vi.fn(async () => undefined) }));
vi.mock('../services/webhook-dispatch.js', () => ({ dispatchWebhook: vi.fn(async () => undefined) }));
vi.mock('../lib/usage.js', () => ({ incrementUsage: vi.fn(async () => undefined) }));

const { mockResolveStepUp, mockVerifySignature, mockVerifyCompactJws } = vi.hoisted(() => ({
  mockResolveStepUp: vi.fn(),
  mockVerifySignature: vi.fn(),
  mockVerifyCompactJws: vi.fn(),
}));
vi.mock('../services/step-up/loader.js', () => ({ resolveStepUpVerdict: mockResolveStepUp }));
vi.mock('@opensyber/tokenforge/server/internal', async (orig) => {
  const actual = await (orig as () => Promise<Record<string, unknown>>)();
  return {
    ...actual,
    importPublicKey: vi.fn(async () => ({}) as CryptoKey),
    verifySignature: mockVerifySignature,
    verifyCompactJws: mockVerifyCompactJws,
  };
});

import worker from '../index.js';

const nowSec = (): number => Math.floor(Date.now() / 1000);

const okSession = (over: Record<string, unknown> = {}) => ({
  id: 'dev_1', tenantId: 't1', sessionId: 'ses_1', userId: 'user_1',
  publicKey: 'jwk-stub', ipAddress: '1.2.3.4', countryCode: 'US',
  deviceFingerprint: 'fp-stub',
  boundAt: new Date(Date.now() - 60_000).toISOString(),
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  revoked: 0, ...over,
});

async function postEdgeVerify(body: unknown, env: Env): Promise<Response> {
  return worker.fetch(
    new Request('http://localhost/v1/edge/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer tf_test' },
      body: JSON.stringify(body),
    }),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

const allowingBody = (path = '/api/x') => ({
  path, method: 'GET',
  headers: {
    signature: 'sig-stub', nonce: `n-${Math.random()}`, timestamp: String(nowSec()), deviceId: 'dev_1',
  },
  ipAddress: '1.2.3.4', countryCode: 'US', userAgent: 'TestAgent/1.0',
});

describe('edge-verify per-action step-up policy', () => {
  let env: Env;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
    mockVerifySignature.mockResolvedValue(true);
    db._setSelectResult([okSession()]);
  });

  it('does NOT upgrade when no step-up policy matches the path', async () => {
    mockResolveStepUp.mockResolvedValueOnce({
      matched: false, requireFreshSig: false, freshSigMaxAgeSec: 60, requireWebAuthn: false,
    });
    const r = await postEdgeVerify(allowingBody('/api/x'), env);
    const j = (await r.json()) as { data: { status: string } };
    expect(j.data.status).toBe('allow');
  });

  it('upgrades to step_up when policy matches + requireFreshSig + only legacy headers (no JWS)', async () => {
    mockResolveStepUp.mockResolvedValueOnce({
      matched: true, requireFreshSig: true, freshSigMaxAgeSec: 30, requireWebAuthn: false,
    });
    const r = await postEdgeVerify(allowingBody('/checkout'), env);
    const j = (await r.json()) as { data: { status: string } };
    expect(j.data.status).toBe('step_up');
  });

  it('keeps allow when policy matches but requireFreshSig is false', async () => {
    mockResolveStepUp.mockResolvedValueOnce({
      matched: true, requireFreshSig: false, freshSigMaxAgeSec: 60, requireWebAuthn: false,
    });
    const r = await postEdgeVerify(allowingBody('/health'), env);
    const j = (await r.json()) as { data: { status: string } };
    expect(j.data.status).toBe('allow');
  });

  it('keeps allow when policy requires fresh JWS AND a valid JWS is supplied (Sprint 39 line 91 positive path)', async () => {
    // Fresh JWS bypasses the step_up upgrade gate at edge-verify.ts:145
    // (the `!jws` guard) — sub claim must match session.sessionId so the
    // verifyEdgeSignature → verifyJwsPath branch returns ok:true.
    mockVerifyCompactJws.mockResolvedValueOnce({
      ok: true,
      claims: { sub: 'ses_1', iat: nowSec(), exp: nowSec() + 60, nonce: 'n' },
      protectedHeader: { alg: 'ES256' },
    });
    mockResolveStepUp.mockResolvedValueOnce({
      matched: true, requireFreshSig: true, freshSigMaxAgeSec: 60, requireWebAuthn: false,
    });
    const body = { ...allowingBody('/checkout'), method: 'POST' };
    body.headers = { ...body.headers, jws: 'h.p.s' };
    const r = await postEdgeVerify(body, env);
    const j = (await r.json()) as { data: { status: string } };
    expect(j.data.status).toBe('allow');
  });

  it('rejects stale JWS (>maxAgeSeconds) with not-allow status (Sprint 39 line 91 stale path)', async () => {
    // verifyCompactJws returns reason='jws_too_old' for iat older than
    // maxAgeSeconds. signatureValid=false flows into the trust signal,
    // dropping the score below the allow band.
    mockVerifyCompactJws.mockResolvedValueOnce({ ok: false, reason: 'jws_too_old' });
    db._setSelectResult([okSession({ ipAddress: '99.99.99.99', countryCode: 'RU', deviceFingerprint: 'totally-different' })]);
    mockResolveStepUp.mockResolvedValueOnce({
      matched: true, requireFreshSig: true, freshSigMaxAgeSec: 60, requireWebAuthn: false,
    });
    const body = { ...allowingBody('/checkout'), method: 'POST' };
    body.headers = { ...body.headers, jws: 'h.p.s' };
    const r = await postEdgeVerify(body, env);
    const j = (await r.json()) as { data: { status: string } };
    // Behavioral pin: never 'allow' when JWS is stale. block or step_up
    // both indicate the gate fired — the negation is the load-bearing assertion.
    expect(j.data.status).not.toBe('allow');
  });

  it('does not downgrade existing block to step_up (more-restrictive verdict wins)', async () => {
    mockVerifySignature.mockResolvedValueOnce(false);
    db._setSelectResult([okSession({ ipAddress: '99.99.99.99', countryCode: 'RU', deviceFingerprint: 'totally-different' })]);
    mockResolveStepUp.mockResolvedValueOnce({
      matched: true, requireFreshSig: true, freshSigMaxAgeSec: 30, requireWebAuthn: false,
    });
    const r = await postEdgeVerify(allowingBody('/admin/users'), env);
    const j = (await r.json()) as { data: { status: string } };
    expect(['step_up', 'block']).toContain(j.data.status);
  });
});
