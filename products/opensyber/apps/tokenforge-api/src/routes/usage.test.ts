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

describe('Usage Routes', () => {
  let mockEnv: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = mockDb;
  });

  it('GET /v1/usage — returns current period stats', async () => {
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' }],
      [{ totalVerifications: 500, totalBinds: 100, totalStepUps: 10 }],
    ]);

    const res = await workerRequest('/v1/usage', { headers: authHeaders() }, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.plan).toBe('pro');
    expect(data.verifications).toBe(500);
    expect(data.binds).toBe(100);
    expect(data.stepUps).toBe(10);
    expect(data.total).toBe(600);
    expect(data.limit).toBe(50000);
  });

  it('GET /v1/usage — returns unlimited for enterprise', async () => {
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'enterprise' }],
      [],
      [{ totalVerifications: 1000, totalBinds: 200, totalStepUps: 50 }],
    ]);

    const res = await workerRequest('/v1/usage', { headers: authHeaders() }, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.limit).toBe('unlimited');
    expect(data.remaining).toBe('unlimited');
  });

  it('GET /v1/usage/daily — returns daily breakdown', async () => {
    const dailyData = [
      { date: '2025-01-15', verifications: 100, binds: 20, stepUps: 5 },
      { date: '2025-01-14', verifications: 80, binds: 15, stepUps: 3 },
    ];

    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' }],
      dailyData,
    ]);

    const res = await workerRequest('/v1/usage/daily', { headers: authHeaders() }, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    const data = body.data as unknown[];
    expect(data.length).toBe(2);
  });

  it('GET /v1/usage — returns zero stats when no usage', async () => {
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'free' }],
      [{ totalVerifications: 0, totalBinds: 0, totalStepUps: 0 }],
    ]);

    const res = await workerRequest('/v1/usage', { headers: authHeaders() }, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.total).toBe(0);
    expect(data.limit).toBe(1000);
    expect(data.remaining).toBe(1000);
  });

  it('GET /v1/usage — periodStart is YYYY-MM-01 and periodEnd is YYYY-MM-DD next month start', async () => {
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'free' }],
      [{ totalVerifications: 0, totalBinds: 0, totalStepUps: 0 }],
    ]);
    const res = await workerRequest('/v1/usage', { headers: authHeaders() }, mockEnv);
    const data = ((await res.json()) as { data: { periodStart: string; periodEnd: string } }).data;
    expect(data.periodStart).toMatch(/^\d{4}-\d{2}-01$/);
    expect(data.periodEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(data.periodEnd).getTime()).toBeGreaterThan(new Date(data.periodStart).getTime());
  });

  it('GET /v1/usage — remaining clamps at 0 when usage exceeds limit (no negatives)', async () => {
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'free' }],
      [{ totalVerifications: 5000, totalBinds: 0, totalStepUps: 0 }],
    ]);
    const res = await workerRequest('/v1/usage', { headers: authHeaders() }, mockEnv);
    const data = ((await res.json()) as { data: { total: number; limit: number; remaining: number } }).data;
    expect(data.total).toBe(5000);
    expect(data.limit).toBe(1000);
    expect(data.remaining).toBe(0);
  });

  it('GET /v1/usage — defaults all counters to 0 when COALESCE returns no row at all', async () => {
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'free' }],
      [], // no row
    ]);
    const res = await workerRequest('/v1/usage', { headers: authHeaders() }, mockEnv);
    const data = ((await res.json()) as { data: { verifications: number; binds: number; stepUps: number; total: number } }).data;
    expect(data.verifications).toBe(0);
    expect(data.binds).toBe(0);
    expect(data.stepUps).toBe(0);
    expect(data.total).toBe(0);
  });

  it('GET /v1/usage/daily — returns rows verbatim from DB (no shape munging)', async () => {
    const rows = [
      { date: '2025-01-15', verifications: 100, binds: 20, stepUps: 5 },
      { date: '2025-01-14', verifications: 80, binds: 15, stepUps: 3 },
      { date: '2025-01-13', verifications: 60, binds: 10, stepUps: 1 },
    ];
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' }],
      rows,
    ]);
    const res = await workerRequest('/v1/usage/daily', { headers: authHeaders() }, mockEnv);
    const data = ((await res.json()) as { data: typeof rows }).data;
    expect(data).toEqual(rows);
  });
});
