import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    c.set('tenantId', 't1');
    c.set('tenantPlan', 'pro');
    await next();
  },
}));
vi.mock('../middleware/usage-limit.js', () => ({ usageLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); } }));
vi.mock('../middleware/rate-limit.js', () => ({
  publicRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  apiRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  rateLimit: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../middleware/guard.js', () => ({
  guardMiddleware: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));

import worker from '../index.js';

async function workerRequest(path: string, init: RequestInit, env: Env): Promise<Response> {
  return worker.fetch(
    new Request(`http://localhost${path}`, init),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

describe('Policies CRUD routes', () => {
  let mockEnv: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = mockDb;
  });

  it('rejects POST with malformed rules JSON', async () => {
    const res = await workerRequest(
      '/v1/policies',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'broken', rules: 'not-json' }),
      },
      mockEnv,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe('invalid_rules');
  });

  it('rejects POST when payload is missing required fields', async () => {
    const res = await workerRequest(
      '/v1/policies',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'no-rules' }),
      },
      mockEnv,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe('invalid_payload');
  });

  it('accepts a valid policy', async () => {
    const res = await workerRequest(
      '/v1/policies',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'block-ru',
          rules: JSON.stringify({ if_any: [{ geo_country_in: ['RU'] }], then: 'block' }),
        }),
      },
      mockEnv,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect((body.data as Record<string, unknown>).name).toBe('block-ru');
  });

  it('GET / returns rows ordered by priority', async () => {
    mockDb._setSelectResult([
      { id: 'p1', tenantId: 't1', name: 'low-prio', priority: 100, enabled: true, rules: '{}' },
      { id: 'p2', tenantId: 't1', name: 'top-prio', priority: 5, enabled: true, rules: '{}' },
    ]);
    const res = await workerRequest('/v1/policies', { method: 'GET' }, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string }> };
    expect(body.data).toHaveLength(2);
    expect(body.data[0]!.id).toBe('p1');
  });

  it('PATCH /:id returns 404 when policy does not exist', async () => {
    mockDb._setSelectResult([]);
    const res = await workerRequest(
      '/v1/policies/missing',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'rename' }),
      },
      mockEnv,
    );
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe('policy_not_found');
  });

  it('PATCH /:id rejects malformed rules JSON without touching DB', async () => {
    const res = await workerRequest(
      '/v1/policies/p1',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rules: 'not-json' }),
      },
      mockEnv,
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('invalid_rules');
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('PATCH /:id updates an existing policy on happy path', async () => {
    mockDb._setSelectResult([
      { id: 'p1', tenantId: 't1', name: 'old', priority: 100, enabled: true, rules: '{}' },
    ]);
    const res = await workerRequest(
      '/v1/policies/p1',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'renamed', priority: 50 }),
      },
      mockEnv,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string; updated: boolean } };
    expect(body.data.id).toBe('p1');
    expect(body.data.updated).toBe(true);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('DELETE /:id returns 404 when policy does not exist', async () => {
    mockDb._setSelectResult([]);
    const res = await workerRequest('/v1/policies/missing', { method: 'DELETE' }, mockEnv);
    expect(res.status).toBe(404);
    expect(mockDb.delete).not.toHaveBeenCalled();
  });

  it('DELETE /:id removes the row on happy path', async () => {
    mockDb._setSelectResult([
      { id: 'p1', tenantId: 't1', name: 'doomed', priority: 100, enabled: true, rules: '{}' },
    ]);
    const res = await workerRequest('/v1/policies/p1', { method: 'DELETE' }, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { deleted: boolean } };
    expect(body.data.deleted).toBe(true);
    expect(mockDb.delete).toHaveBeenCalled();
  });
});
