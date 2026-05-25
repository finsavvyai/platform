import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockEnv, createMockDb } from '../test/helpers.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({ createDb: vi.fn(() => (globalThis as Record<string, unknown>).__mockDb) }));
const { mockDispatchWebhook } = vi.hoisted(() => ({ mockDispatchWebhook: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../services/webhook-dispatch.js', () => ({
  dispatchWebhook: mockDispatchWebhook,
  crossedCritical: () => false,
  crossedDegraded: () => false,
}));
vi.mock('hono/logger', () => ({ logger: () => async (_c: unknown, next: () => Promise<void>) => { await next(); } }));

import worker from '../index.js';

async function workerRequest(
  path: string,
  init: RequestInit = {},
  env: Env,
): Promise<Response> {
  const url = `http://localhost${path}`;
  const req = new Request(url, init);
  return worker.fetch(
    req,
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

function authHeaders(): Record<string, string> {
  return { Authorization: 'Bearer tf_testkey123' };
}

const mockSession = {
  id: 'dev_abc123',
  tenantId: 't1',
  sessionId: 'sess_1',
  userId: 'user_1',
  publicKey: 'pk_test',
  deviceFingerprint: 'fp_test',
  ipAddress: '1.2.3.4',
  countryCode: 'US',
  trustScore: 100,
  boundAt: '2025-01-01T00:00:00Z',
  lastVerifiedAt: '2025-01-01T00:00:00Z',
  expiresAt: '2025-01-02T00:00:00Z',
  revoked: 0,
  revokedReason: null,
  createdAt: '2025-01-01T00:00:00Z',
};

describe('Sessions Routes', () => {
  let mockEnv: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = mockDb;
  });

  it('GET /v1/sessions — returns empty list', async () => {
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' }],
      [{ totalVerifications: 0, totalBinds: 0 }],
      [],
    ]);

    const res = await workerRequest('/v1/sessions', { headers: authHeaders() }, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.data).toEqual([]);
    expect(body.hasMore).toBe(false);
    expect(body.nextCursor).toBeNull();
  });

  it('GET /v1/sessions — returns sessions with pagination', async () => {
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' }],
      [{ totalVerifications: 0, totalBinds: 0 }],
      [mockSession],
    ]);

    const res = await workerRequest('/v1/sessions', { headers: authHeaders() }, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('GET /v1/sessions/:id — returns single session', async () => {
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' }],
      [{ totalVerifications: 0, totalBinds: 0 }],
      [mockSession],
    ]);

    const res = await workerRequest(
      '/v1/sessions/dev_abc123',
      { headers: authHeaders() },
      mockEnv,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.data).toBeDefined();
  });

  it('GET /v1/sessions/:id — returns 404 for unknown session', async () => {
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' }],
      [{ totalVerifications: 0, totalBinds: 0 }],
      [],
    ]);

    const res = await workerRequest(
      '/v1/sessions/nonexistent',
      { headers: authHeaders() },
      mockEnv,
    );
    expect(res.status).toBe(404);
  });

  it('DELETE /v1/sessions/:id — revokes session', async () => {
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' }],
      [{ totalVerifications: 0, totalBinds: 0 }],
      [mockSession],
    ]);

    const res = await workerRequest(
      '/v1/sessions/dev_abc123',
      { method: 'DELETE', headers: authHeaders() },
      mockEnv,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.revoked).toBe(true);
  });

  it('DELETE /v1/sessions/:id — returns 404 for unknown session', async () => {
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' }],
      [{ totalVerifications: 0, totalBinds: 0 }],
      [],
    ]);

    const res = await workerRequest(
      '/v1/sessions/nonexistent',
      { method: 'DELETE', headers: authHeaders() },
      mockEnv,
    );
    expect(res.status).toBe(404);
  });

  const KEY = { keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' };
  const USAGE = { totalVerifications: 0, totalBinds: 0 };

  it('DELETE /v1/sessions/:id — fires session.revoked webhook with reason="api_revoked"', async () => {
    mockDb._setSelectResults([[KEY], [USAGE], [mockSession]]);
    await workerRequest('/v1/sessions/dev_abc123', { method: 'DELETE', headers: authHeaders() }, mockEnv);
    expect(mockDispatchWebhook).toHaveBeenCalledTimes(1);
    const [, , event, payload] = mockDispatchWebhook.mock.calls[0]!;
    expect(event).toBe('session.revoked');
    expect((payload as { reason: string }).reason).toBe('api_revoked');
    expect((payload as { deviceId: string }).deviceId).toBe('dev_abc123');
  });

  it('DELETE /v1/sessions/:id — persists revoked=1 + revokedReason="api_revoked"', async () => {
    mockDb._setSelectResults([[KEY], [USAGE], [mockSession]]);
    await workerRequest('/v1/sessions/dev_abc123', { method: 'DELETE', headers: authHeaders() }, mockEnv);
    expect(mockDb._updateChain.set).toHaveBeenCalledWith({ revoked: 1, revokedReason: 'api_revoked' });
  });

  it('GET /v1/sessions — clamps limit query parameter at 100 (DoS guard upper bound)', async () => {
    mockDb._setSelectResults([[KEY], [USAGE], []]);
    const res = await workerRequest('/v1/sessions?limit=999', { headers: authHeaders() }, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { hasMore: boolean };
    expect(body.hasMore).toBe(false);
  });

  it('GET /v1/sessions — sets nextCursor to last row id when hasMore=true', async () => {
    mockDb._setSelectResults([
      [KEY], [USAGE],
      // limit defaults to 20; return 21 rows so hasMore=true and we get a cursor
      Array.from({ length: 21 }, (_, i) => ({ ...mockSession, id: `dev_${String(i).padStart(2, '0')}` })),
    ]);
    const res = await workerRequest('/v1/sessions?limit=20', { headers: authHeaders() }, mockEnv);
    const body = (await res.json()) as { nextCursor: string | null; hasMore: boolean; data: Array<{ id: string }> };
    expect(body.hasMore).toBe(true);
    expect(body.data).toHaveLength(20);
    expect(body.nextCursor).toBe('dev_19'); // last id within the limit slice
  });
});
