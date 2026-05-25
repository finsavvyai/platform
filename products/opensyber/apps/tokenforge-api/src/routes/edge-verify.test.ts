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
vi.mock('../services/alert-dispatch.js', () => ({ dispatchAlerts: vi.fn(async () => undefined) }));
vi.mock('../services/webhook-dispatch.js', () => ({ dispatchWebhook: vi.fn(async () => undefined) }));
vi.mock('../lib/usage.js', () => ({ incrementUsage: vi.fn(async () => undefined) }));

const { mockVerifySignature, mockVerifyEdgeSignature } = vi.hoisted(() => ({
  mockVerifySignature: vi.fn(),
  mockVerifyEdgeSignature: vi.fn(),
}));
vi.mock('@opensyber/tokenforge/server/internal', async (orig) => {
  const actual = await (orig as () => Promise<Record<string, unknown>>)();
  return {
    ...actual,
    importPublicKey: vi.fn(async () => ({}) as CryptoKey),
    verifySignature: mockVerifySignature,
  };
});
vi.mock('../services/edge/sig-verify.js', () => ({
  verifyEdgeSignature: mockVerifyEdgeSignature,
}));

import worker from '../index.js';

async function postEdgeVerify(body: unknown, env: Env): Promise<Response> {
  return worker.fetch(
    new Request('http://localhost/v1/edge/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': 'Bearer tf_test' },
      body: JSON.stringify(body),
    }),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

const nowSec = (): number => Math.floor(Date.now() / 1000);

const validHeaders = (over: Record<string, string | null> = {}) => ({
  signature: 'sig-stub', nonce: `nonce-${Math.random()}`, timestamp: String(nowSec()), deviceId: 'dev_1', ...over,
});
const validBody = (over: Record<string, unknown> = {}) => ({
  path: '/api/x', method: 'GET', headers: validHeaders(), ipAddress: '1.2.3.4', countryCode: 'US', userAgent: 'TestAgent/1.0', ...over,
});
const okSession = (over: Record<string, unknown> = {}) => ({
  id: 'dev_1', tenantId: 't1', sessionId: 'ses_1', userId: 'user_1', publicKey: 'jwk-stub',
  ipAddress: '1.2.3.4', countryCode: 'US', deviceFingerprint: 'fp-stub',
  boundAt: new Date(Date.now() - 60_000).toISOString(),
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  revoked: 0, ...over,
});

describe('POST /v1/edge/verify', () => {
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 400 validation_error when body is missing required path field', async () => {
    const r = await postEdgeVerify({ method: 'GET', headers: validHeaders() }, env);
    expect(r.status).toBe(400);
    const j = (await r.json()) as { error: string };
    expect(j.error).toBe('validation_error');
  });

  it('returns degraded mode when signature header missing', async () => {
    const r = await postEdgeVerify(
      validBody({ headers: validHeaders({ signature: null, deviceId: null }) }),
      env,
    );
    expect(r.status).toBe(200);
    const j = (await r.json()) as { data: { status: string; bound: boolean } };
    expect(j.data.status).toBe('degraded');
    expect(j.data.bound).toBe(false);
  });

  it('blocks when timestamp is older than 60s', async () => {
    const r = await postEdgeVerify(
      validBody({ headers: validHeaders({ timestamp: String(nowSec() - 120) }) }),
      env,
    );
    const j = (await r.json()) as { data: { status: string; reason: string } };
    expect(j.data.status).toBe('block');
    expect(j.data.reason).toBe('timestamp_skew');
  });

  it('blocks when nonce already exists in CACHE (replay)', async () => {
    await env.CACHE.put('nonce:t1:replayed', '1');
    const r = await postEdgeVerify(
      validBody({ headers: validHeaders({ nonce: 'replayed' }) }),
      env,
    );
    const j = (await r.json()) as { data: { reason: string } };
    expect(j.data.reason).toBe('nonce_replay');
  });

  it('blocks when device session not found', async () => {
    db._setSelectResult([]);
    const r = await postEdgeVerify(validBody(), env);
    const j = (await r.json()) as { data: { reason: string } };
    expect(j.data.reason).toBe('device_not_found');
  });

  it('blocks when session is revoked', async () => {
    db._setSelectResult([okSession({ revoked: 1 })]);
    const r = await postEdgeVerify(validBody(), env);
    const j = (await r.json()) as { data: { reason: string } };
    expect(j.data.reason).toBe('session_revoked');
  });

  it('blocks when session is expired', async () => {
    db._setSelectResult([okSession({ expiresAt: new Date(Date.now() - 1000).toISOString() })]);
    const r = await postEdgeVerify(validBody(), env);
    const j = (await r.json()) as { data: { reason: string } };
    expect(j.data.reason).toBe('session_expired');
  });

  it('allows with bound=true and trustScore when signature verifies', async () => {
    db._setSelectResult([okSession()]);
    const r = await postEdgeVerify(validBody(), env);
    const j = (await r.json()) as { data: { status: string; bound: boolean; trustScore: number; deviceId: string } };
    expect(['allow', 'step_up']).toContain(j.data.status);
    expect(j.data.bound).toBe(true);
    expect(j.data.deviceId).toBe('dev_1');
    expect(j.data.trustScore).toBeGreaterThan(0);
  });

  it('downgrades to step_up or block when signature is invalid', async () => {
    mockVerifySignature.mockResolvedValueOnce(false);
    db._setSelectResult([okSession()]);
    const r = await postEdgeVerify(validBody(), env);
    const j = (await r.json()) as { data: { status: string; trustScore: number } };
    expect(['step_up', 'block']).toContain(j.data.status);
    expect(j.data.trustScore).toBeLessThan(80);
  });

  it('JWS path: allows when verifyEdgeSignature reports ok and bypasses legacy ts/nonce checks', async () => {
    mockVerifyEdgeSignature.mockResolvedValueOnce({ ok: true, mode: 'jws' });
    db._setSelectResult([okSession()]);
    // ts is intentionally stale to prove the JWS path skips the 60s legacy guard.
    const r = await postEdgeVerify(
      validBody({ headers: { ...validHeaders({ timestamp: String(nowSec() - 600) }), jws: 'h.p.s' } }),
      env,
    );
    const j = (await r.json()) as { data: { status: string; bound: boolean } };
    expect(['allow', 'step_up']).toContain(j.data.status);
    expect(j.data.bound).toBe(true);
    expect(mockVerifyEdgeSignature).toHaveBeenCalledTimes(1);
  });

  it('JWS path: invalid JWS produces step_up/block via trust-score downgrade', async () => {
    mockVerifyEdgeSignature.mockResolvedValueOnce({ ok: false, mode: 'jws', reason: 'jws_bad_signature' });
    db._setSelectResult([okSession()]);
    const r = await postEdgeVerify(
      validBody({ headers: { ...validHeaders(), jws: 'h.p.s' } }),
      env,
    );
    const j = (await r.json()) as { data: { status: string; trustScore: number } };
    expect(['step_up', 'block']).toContain(j.data.status);
    expect(j.data.trustScore).toBeLessThan(80);
  });
});
