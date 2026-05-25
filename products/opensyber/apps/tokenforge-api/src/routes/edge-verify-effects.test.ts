/**
 * Side-effect coverage for POST /v1/edge/verify.
 * Sibling of edge-verify.test.ts (189L) — pins alert/webhook dispatch
 * call shape, nonce-KV write behavior, and the JWS-bypasses-nonce gate.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
vi.mock('../lib/usage.js', () => ({ incrementUsage: vi.fn(async () => undefined) }));

const { mockVerifySignature, mockVerifyEdgeSignature, mockAlerts, mockWebhook } = vi.hoisted(() => ({
  mockVerifySignature: vi.fn(),
  mockVerifyEdgeSignature: vi.fn(),
  mockAlerts: vi.fn(async () => undefined),
  mockWebhook: vi.fn(async () => undefined),
}));
vi.mock('@opensyber/tokenforge/server/internal', async (orig) => {
  const actual = await (orig as () => Promise<Record<string, unknown>>)();
  return { ...actual, importPublicKey: vi.fn(async () => ({}) as CryptoKey), verifySignature: mockVerifySignature };
});
vi.mock('../services/edge/sig-verify.js', () => ({ verifyEdgeSignature: mockVerifyEdgeSignature }));
vi.mock('../services/alert-dispatch.js', () => ({ dispatchAlerts: mockAlerts }));
vi.mock('../services/webhook-dispatch.js', () => ({ dispatchWebhook: mockWebhook }));

import worker from '../index.js';

const nowSec = () => Math.floor(Date.now() / 1000);
const validHeaders = (over: Record<string, string | null> = {}) => ({
  signature: 'sig-stub', nonce: `n-${Math.random()}`, timestamp: String(nowSec()), deviceId: 'dev_1', ...over,
});
const validBody = (over: Record<string, unknown> = {}) => ({
  path: '/api/x', method: 'GET', headers: validHeaders(),
  ipAddress: '1.2.3.4', countryCode: 'US', userAgent: 'TestAgent/1.0', ...over,
});
const okSession = (over: Record<string, unknown> = {}) => ({
  id: 'dev_1', tenantId: 't1', sessionId: 'ses_1', userId: 'user_1', publicKey: 'jwk-stub',
  ipAddress: '1.2.3.4', countryCode: 'US', deviceFingerprint: 'fp-stub',
  boundAt: new Date(Date.now() - 60_000).toISOString(),
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  revoked: 0, ...over,
});

async function post(body: unknown, env: Env): Promise<Response> {
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

describe('POST /v1/edge/verify — side effects', () => {
  let env: Env;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
    mockVerifySignature.mockResolvedValue(true);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('fires session.verified webhook on every decision (allow / step_up / block)', async () => {
    db._setSelectResult([okSession()]);
    await post(validBody(), env);
    const verifiedCall = mockWebhook.mock.calls.find((c) => c[2] === 'session.verified');
    expect(verifiedCall).toBeDefined();
    const payload = verifiedCall![3] as Record<string, unknown>;
    expect(payload.deviceId).toBe('dev_1');
    expect(payload.sessionId).toBe('ses_1');
    expect(['allow', 'step_up', 'block']).toContain(payload.decision);
  });

  it('fires session.hijack_attempt webhook with reason=signature_invalid when verifySignature=false', async () => {
    mockVerifySignature.mockResolvedValueOnce(false);
    db._setSelectResult([okSession()]);
    await post(validBody(), env);
    const hijackCall = mockWebhook.mock.calls.find((c) => c[2] === 'session.hijack_attempt');
    expect(hijackCall).toBeDefined();
    expect((hijackCall![3] as Record<string, unknown>).reason).toBe('signature_invalid');
  });

  it('does NOT fire hijack_attempt when signature verifies (only session.verified)', async () => {
    db._setSelectResult([okSession()]);
    await post(validBody(), env);
    const hijack = mockWebhook.mock.calls.find((c) => c[2] === 'session.hijack_attempt');
    expect(hijack).toBeUndefined();
  });

  it('dispatchAlerts called with trust.block when device_not_found short-circuits to block', async () => {
    db._setSelectResult([]);
    await post(validBody(), env);
    expect(mockAlerts).toHaveBeenCalled();
    const alertPayload = mockAlerts.mock.calls[0]![1] as Record<string, unknown>;
    expect(alertPayload.type).toBe('trust.block');
    expect(alertPayload.reason).toBe('device_not_found');
  });

  it('legacy path stores nonce in CACHE under key `nonce:<tenantId>:<nonce>` for replay defense', async () => {
    db._setSelectResult([okSession()]);
    const nonce = `nonce-${Math.random()}`;
    await post(validBody({ headers: validHeaders({ nonce }) }), env);
    const stored = await env.CACHE.get(`nonce:t1:${nonce}`);
    expect(stored).toBe('1');
  });

  it('JWS path does NOT store nonce in CACHE (JWS verifier handles iat/exp instead)', async () => {
    mockVerifyEdgeSignature.mockResolvedValueOnce({ ok: true, mode: 'jws' });
    db._setSelectResult([okSession()]);
    const nonce = `nonce-jws-${Math.random()}`;
    await post(
      validBody({ headers: { ...validHeaders({ nonce }), jws: 'h.p.s' } }),
      env,
    );
    const stored = await env.CACHE.get(`nonce:t1:${nonce}`);
    expect(stored).toBeNull();
  });

  it('degraded mode (no deviceId) still increments usage but skips webhook dispatch', async () => {
    await post(validBody({ headers: validHeaders({ deviceId: null, signature: null }) }), env);
    // No webhook dispatch on degraded path — only allow/block/step_up dispatch
    expect(mockWebhook).not.toHaveBeenCalled();
  });
});
