import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockEnv, createMockDb } from '../test/helpers.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({ createDb: vi.fn(() => (globalThis as Record<string, unknown>).__mockDb) }));
const { mockIncrementUsage, mockDispatchWebhook } = vi.hoisted(() => ({
  mockIncrementUsage: vi.fn().mockResolvedValue(undefined),
  mockDispatchWebhook: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../lib/usage.js', () => ({ incrementUsage: mockIncrementUsage }));
vi.mock('../services/webhook-dispatch.js', () => ({
  dispatchWebhook: mockDispatchWebhook,
  crossedCritical: (prev: number, curr: number) => prev >= 40 && curr < 40,
  crossedDegraded: (prev: number, curr: number) => prev >= 80 && curr < 80,
}));
vi.mock('hono/logger', () => ({ logger: () => async (_c: unknown, next: () => Promise<void>) => { await next(); } }));

import worker from '../index.js';

async function workerRequest(path: string, init: RequestInit, env: Env): Promise<Response> {
  return worker.fetch(
    new Request(`http://localhost${path}`, init),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}
const authHeaders = (): Record<string, string> => ({ Authorization: 'Bearer tf_testkey123', 'Content-Type': 'application/json' });

const validVerifyBody = {
  signature: 'test_sig_base64',
  nonce: 'unique_nonce_123',
  timestamp: Math.floor(Date.now() / 1000),
  publicKey: 'pk_test_key',
  path: '/api/data',
  method: 'GET',
  sessionId: 'sess_1',
};

const mockSession = {
  id: 'dev_abc123',
  tenantId: 't1',
  sessionId: 'sess_1',
  userId: 'user_1',
  publicKey: 'pk_test_key',
  deviceFingerprint: 'fp_test',
  ipAddress: '1.2.3.4',
  countryCode: 'US',
  trustScore: 100,
  boundAt: '2025-01-01T00:00:00Z',
  lastVerifiedAt: '2025-01-01T00:00:00Z',
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  revoked: 0,
  revokedReason: null,
  createdAt: '2025-01-01T00:00:00Z',
};

describe('Verify Routes', () => {
  let mockEnv: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = mockDb;
  });

  const KEY = { keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' };
  const USAGE = { totalVerifications: 0, totalBinds: 0 };
  const seed = (sessions: unknown[] = [mockSession]) => mockDb._setSelectResults([[KEY], [USAGE], sessions]);
  const post = (body: unknown = validVerifyBody, headers: Record<string, string> = {}): Promise<Response> =>
    workerRequest('/v1/verify', { method: 'POST', headers: { ...authHeaders(), ...headers }, body: JSON.stringify(body) }, mockEnv);

  it('POST /v1/verify — validates successfully', async () => {
    seed();
    const res = await post();
    expect(res.status).toBe(200);
    const data = ((await res.json()) as { data: { valid: boolean; trustScore: number } }).data;
    expect(data.valid).toBe(true);
    expect(typeof data.trustScore).toBe('number');
  });

  it('POST /v1/verify — returns 400 for missing fields', async () => {
    seed();
    const res = await post({ signature: 'test' });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('validation_error');
  });

  it('POST /v1/verify — returns 400 for expired timestamp', async () => {
    seed();
    const res = await post({ ...validVerifyBody, timestamp: Math.floor(Date.now() / 1000) - 120 });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('request_expired');
  });

  it('POST /v1/verify — returns 401 for device not bound', async () => {
    seed([]);
    const res = await post();
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: string }).error).toBe('device_not_bound');
  });

  it('POST /v1/verify — returns 401 for revoked session', async () => {
    seed([{ ...mockSession, revoked: 1 }]);
    const res = await post();
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: string }).error).toBe('session_revoked');
  });

  it('POST /v1/verify — returns 401 for expired session (expiresAt in past)', async () => {
    seed([{ ...mockSession, expiresAt: new Date(Date.now() - 1000).toISOString() }]);
    const res = await post();
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: string }).error).toBe('session_expired');
  });

  it('POST /v1/verify — fires session.verified webhook with deviceId+sessionId+userId', async () => {
    seed();
    await post();
    const verified = mockDispatchWebhook.mock.calls.find((c) => c[2] === 'session.verified');
    expect(verified).toBeDefined();
    const payload = verified![3] as Record<string, unknown>;
    expect(payload.sessionId).toBe('sess_1');
    expect(payload.userId).toBe('user_1');
    expect(payload.deviceId).toBe('dev_abc123');
  });

  it('POST /v1/verify — fires session.hijack_attempt when ip + country + fingerprint all changed', async () => {
    seed();
    await post(validVerifyBody, {
      'cf-connecting-ip': '99.99.99.99', 'cf-ipcountry': 'RU', 'user-agent': 'Mozilla/5.0 different',
    });
    const hijack = mockDispatchWebhook.mock.calls.find((c) => c[2] === 'session.hijack_attempt');
    expect(hijack).toBeDefined();
  });

  it('POST /v1/verify — increments usage with kind="verification"', async () => {
    seed();
    await post();
    expect(mockIncrementUsage).toHaveBeenCalled();
    expect(mockIncrementUsage.mock.calls[0]![2]).toBe('verification');
  });

  it('POST /v1/verify — response data includes deviceId/userId/sessionId', async () => {
    seed();
    const res = await post();
    const data = ((await res.json()) as { data: { deviceId: string; userId: string; sessionId: string } }).data;
    expect(data.deviceId).toBe('dev_abc123');
    expect(data.userId).toBe('user_1');
    expect(data.sessionId).toBe('sess_1');
  });

  it('POST /v1/verify — does NOT fire trust_score.* webhooks when prev is already in critical band (no crossing)', async () => {
    // session.trustScore=30 means prev=30, already in critical band.
    // Even if signals drive score lower, neither `prev>=40` (critical
    // crossing) nor `prev>=80` (degraded crossing) is satisfied.
    // Pinning the no-spurious-crossing-within-band invariant.
    seed([{ ...mockSession, trustScore: 30 }]);
    await post();
    const fired = mockDispatchWebhook.mock.calls.map((c) => c[2]);
    expect(fired).not.toContain('trust_score.critical');
    expect(fired).not.toContain('trust_score.degraded');
  });

  it('POST /v1/verify — does NOT fire hijack_attempt when only IP changed (fingerprint + country unchanged)', async () => {
    seed();
    await post(validVerifyBody, { 'cf-connecting-ip': '5.6.7.8', 'cf-ipcountry': 'US' });
    const hijack = mockDispatchWebhook.mock.calls.find((c) => c[2] === 'session.hijack_attempt');
    expect(hijack).toBeUndefined();
  });

  it('POST /v1/verify — accepts timestamp at the +60s edge (boundary is `> 60`, not `>=`)', async () => {
    seed();
    const res = await post({ ...validVerifyBody, timestamp: Math.floor(Date.now() / 1000) + 60 });
    expect(res.status).toBe(200);
  });

  it('POST /v1/verify — rejects timestamp at -61s (just outside the window)', async () => {
    seed();
    const res = await post({ ...validVerifyBody, timestamp: Math.floor(Date.now() / 1000) - 61 });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('request_expired');
  });

  it('POST /v1/verify — DB.update sets new trustScore + fresh lastVerifiedAt ISO string', async () => {
    seed();
    await post();
    expect(mockDb._updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        trustScore: expect.any(Number),
        lastVerifiedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      }),
    );
  });
});
