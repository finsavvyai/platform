import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockEnv, createMockDb } from '../test/helpers.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({ createDb: vi.fn(() => (globalThis as Record<string, unknown>).__mockDb) }));
const { mockIncrementUsage, mockDispatchWebhook } = vi.hoisted(() => ({
  mockIncrementUsage: vi.fn().mockResolvedValue(undefined),
  mockDispatchWebhook: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../lib/usage.js', () => ({ incrementUsage: mockIncrementUsage }));
vi.mock('../services/webhook-dispatch.js', () => ({ dispatchWebhook: mockDispatchWebhook }));
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

const validBindBody = {
  publicKey: 'pk_device_key_123',
  userId: 'user_1',
  sessionId: 'sess_1',
  fingerprint: 'fp_browser_abc',
};

describe('Bind Routes', () => {
  let mockEnv: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = mockDb;
  });

  const KEY_ROW = { keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' };
  const USAGE_ROW = { totalVerifications: 0, totalBinds: 0 };
  const seedSelects = (existingSessions: unknown[] = []) => mockDb._setSelectResults([[KEY_ROW], [USAGE_ROW], existingSessions]);

  async function postBind(body: unknown, headers: Record<string, string> = {}): Promise<Response> {
    return workerRequest('/v1/bind', { method: 'POST', headers: { ...authHeaders(), ...headers }, body: JSON.stringify(body) }, mockEnv);
  }

  it('POST /v1/bind — binds device successfully', async () => {
    seedSelects();
    const res = await postBind(validBindBody);
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.deviceId).toBeDefined();
    expect(data.sessionId).toBe('sess_1');
    expect(data.trustScore).toBe(100);
  });

  it('POST /v1/bind — returns 400 for missing fields', async () => {
    seedSelects();
    const res = await postBind({ publicKey: 'pk_test' });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('validation_error');
  });

  it('POST /v1/bind — returns 409 for duplicate active session', async () => {
    seedSelects([{ id: 'dev_existing', tenantId: 't1', sessionId: 'sess_1', userId: 'user_1', publicKey: 'pk_device_key_123', revoked: 0 }]);
    const res = await postBind(validBindBody);
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe('already_bound');
  });

  it('POST /v1/bind — allows rebind when previous session is revoked', async () => {
    seedSelects([{ id: 'dev_old', tenantId: 't1', sessionId: 'sess_0', userId: 'user_1', publicKey: 'pk_device_key_123', revoked: 1 }]);
    const res = await postBind(validBindBody);
    expect(res.status).toBe(201);
  });

  it('POST /v1/bind — fires session.bound webhook', async () => {
    seedSelects();
    await postBind(validBindBody);
    expect(mockDispatchWebhook).toHaveBeenCalledTimes(1);
    const [, , event, payload] = mockDispatchWebhook.mock.calls[0]!;
    expect(event).toBe('session.bound');
    expect((payload as { sessionId: string }).sessionId).toBe('sess_1');
    expect((payload as { trustScore: number }).trustScore).toBe(100);
  });

  it('POST /v1/bind — increments usage with kind="bind"', async () => {
    seedSelects();
    await postBind(validBindBody);
    expect(mockIncrementUsage).toHaveBeenCalled();
    expect(mockIncrementUsage.mock.calls[0]![2]).toBe('bind');
  });

  it('POST /v1/bind — expiresAt is 24h from now (±5s skew)', async () => {
    seedSelects();
    const before = Date.now();
    const res = await postBind(validBindBody);
    const body = (await res.json()) as { data: { expiresAt: string } };
    const exp = new Date(body.data.expiresAt).getTime();
    expect(Math.abs(exp - (before + 86400_000))).toBeLessThan(5_000);
  });

  it('POST /v1/bind — persists CF ipAddress + countryCode into the inserted row', async () => {
    seedSelects();
    await postBind(validBindBody, { 'cf-connecting-ip': '1.2.3.4', 'cf-ipcountry': 'US' });
    const inserted = mockDb._insertChain.values.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted.ipAddress).toBe('1.2.3.4');
    expect(inserted.countryCode).toBe('US');
  });

  it('POST /v1/bind — fingerprint omitted falls back to hashFingerprint(userAgent)', async () => {
    seedSelects();
    const { fingerprint: _, ...withoutFp } = validBindBody;
    void _;
    await postBind(withoutFp, { 'user-agent': 'Mozilla/5.0 TestUA' });
    const inserted = mockDb._insertChain.values.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(typeof inserted.deviceFingerprint).toBe('string');
    expect(inserted.deviceFingerprint).not.toBe('Mozilla/5.0 TestUA');
    expect((inserted.deviceFingerprint as string).length).toBeGreaterThan(0);
  });

  it('POST /v1/bind — deviceId is 32 lowercase hex chars (UUID with dashes stripped)', async () => {
    seedSelects();
    const res = await postBind(validBindBody);
    const data = ((await res.json()) as { data: { deviceId: string } }).data;
    expect(data.deviceId).toMatch(/^[0-9a-f]{32}$/);
  });

  it('POST /v1/bind — inserted row has trustScore=100 + boundAt === lastVerifiedAt', async () => {
    seedSelects();
    await postBind(validBindBody);
    const inserted = mockDb._insertChain.values.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted.trustScore).toBe(100);
    expect(inserted.boundAt).toBe(inserted.lastVerifiedAt);
    expect(inserted.revoked).toBe(0);
  });

  it('POST /v1/bind — session.bound webhook payload includes all 8 documented keys', async () => {
    seedSelects();
    await postBind(validBindBody, { 'cf-connecting-ip': '5.6.7.8', 'cf-ipcountry': 'CA' });
    const [, , , payload] = mockDispatchWebhook.mock.calls[0]!;
    const p = payload as Record<string, unknown>;
    expect(Object.keys(p).sort()).toEqual(
      ['boundAt', 'countryCode', 'deviceId', 'expiresAt', 'ipAddress', 'sessionId', 'trustScore', 'userId'],
    );
    expect(p.ipAddress).toBe('5.6.7.8');
    expect(p.countryCode).toBe('CA');
  });

  it('POST /v1/bind — missing CF headers → ipAddress="" + countryCode="" (blank string, not null)', async () => {
    seedSelects();
    await postBind(validBindBody); // no cf-* headers
    const inserted = mockDb._insertChain.values.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted.ipAddress).toBe('');
    expect(inserted.countryCode).toBe('');
  });
});
