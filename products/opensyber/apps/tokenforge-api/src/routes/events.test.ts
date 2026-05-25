import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockEnv, createMockDb } from '../test/helpers.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as Record<string, unknown>).__mockDb),
}));

vi.mock('hono/logger', () => ({
  logger: () => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
}));

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

const mockEvent = {
  id: 'evt_1',
  tenantId: 't1',
  sessionId: 'sess_1',
  userId: 'user_1',
  eventType: 'DEVICE_BOUND',
  trustScoreBefore: 0,
  trustScoreAfter: 100,
  ipAddress: '1.2.3.4',
  countryCode: 'US',
  userAgent: 'Mozilla/5.0',
  metadata: '{}',
  createdAt: '2025-01-01T00:00:00Z',
};

describe('Events Routes', () => {
  let mockEnv: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = mockDb;
  });

  it('GET /v1/events — returns empty event list', async () => {
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' }],
      [],
    ]);

    const res = await workerRequest('/v1/events', { headers: authHeaders() }, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.data).toEqual([]);
    expect(body.hasMore).toBe(false);
  });

  it('GET /v1/events — returns events', async () => {
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' }],
      [mockEvent],
    ]);

    const res = await workerRequest('/v1/events', { headers: authHeaders() }, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    const data = body.data as unknown[];
    expect(data.length).toBe(1);
  });

  it('GET /v1/events — supports eventType filter', async () => {
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' }],
      [mockEvent],
    ]);

    const res = await workerRequest(
      '/v1/events?eventType=DEVICE_BOUND',
      { headers: authHeaders() },
      mockEnv,
    );
    expect(res.status).toBe(200);
  });

  it('GET /v1/events — supports userId filter', async () => {
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' }],
      [mockEvent],
    ]);

    const res = await workerRequest(
      '/v1/events?userId=user_1',
      { headers: authHeaders() },
      mockEnv,
    );
    expect(res.status).toBe(200);
  });

  it('GET /v1/events — supports cursor pagination', async () => {
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' }],
      [mockEvent],
    ]);

    const res = await workerRequest(
      '/v1/events?cursor=evt_0',
      { headers: authHeaders() },
      mockEnv,
    );
    expect(res.status).toBe(200);
  });

  const KEY = { keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' };

  it('GET /v1/events — limit=999 still returns 200 (clamped at 100, DoS guard)', async () => {
    mockDb._setSelectResults([[KEY], []]);
    const res = await workerRequest('/v1/events?limit=999', { headers: authHeaders() }, mockEnv);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { hasMore: boolean }).hasMore).toBe(false);
  });

  it('GET /v1/events — limit=0 still returns 200 (floored at 1, lower-bound guard)', async () => {
    mockDb._setSelectResults([[KEY], [mockEvent]]);
    const res = await workerRequest('/v1/events?limit=0', { headers: authHeaders() }, mockEnv);
    expect(res.status).toBe(200);
  });

  it('GET /v1/events — sets nextCursor=last id within slice when rows>limit (hasMore)', async () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({ ...mockEvent, id: `evt_${String(i).padStart(2, '0')}` }));
    mockDb._setSelectResults([[KEY], rows]);
    const res = await workerRequest('/v1/events?limit=20', { headers: authHeaders() }, mockEnv);
    const body = (await res.json()) as { nextCursor: string | null; hasMore: boolean; data: Array<{ id: string }> };
    expect(body.hasMore).toBe(true);
    expect(body.data).toHaveLength(20);
    expect(body.nextCursor).toBe('evt_19');
  });

  it('GET /v1/events — combined eventType + userId filters do not 500 (composite WHERE)', async () => {
    mockDb._setSelectResults([[KEY], [mockEvent]]);
    const res = await workerRequest(
      '/v1/events?eventType=DEVICE_BOUND&userId=user_1',
      { headers: authHeaders() },
      mockEnv,
    );
    expect(res.status).toBe(200);
  });
});
