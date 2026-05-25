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

describe('Tenant Key Domain Routes', () => {
  let mockEnv: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = mockDb;
  });

  describe('PUT /v1/tenant/api-keys/:id/domains', () => {
    it('updates allowed domains', async () => {
      mockDb._setSelectResults([
        [{ keyId: 'k1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' }],
        [{ id: 'k2' }],
      ]);
      const res = await workerRequest('/v1/tenant/api-keys/k2/domains', {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedDomains: ['new.com', 'other.com'] }),
      }, mockEnv);
      expect(res.status).toBe(200);
      const data = ((await res.json()) as { data: Record<string, unknown> }).data;
      expect(data.allowedDomains).toEqual(['new.com', 'other.com']);
      expect(mockEnv.CACHE.put).toHaveBeenCalledWith(
        'domains:k2',
        JSON.stringify(['new.com', 'other.com']),
      );
    });

    it('clears domains when empty array', async () => {
      mockDb._setSelectResults([
        [{ keyId: 'k1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' }],
        [{ id: 'k2' }],
      ]);
      const res = await workerRequest('/v1/tenant/api-keys/k2/domains', {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedDomains: [] }),
      }, mockEnv);
      expect(res.status).toBe(200);
      expect(mockEnv.CACHE.delete).toHaveBeenCalledWith('domains:k2');
    });

    it('returns 404 for non-existent key', async () => {
      mockDb._setSelectResults([
        [{ keyId: 'k1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' }],
        [],
      ]);
      const res = await workerRequest('/v1/tenant/api-keys/nonexistent/domains', {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedDomains: ['a.com'] }),
      }, mockEnv);
      expect(res.status).toBe(404);
    });

    it('rejects when domain limit exceeded for free plan', async () => {
      mockDb._setSelectResults([
        [{ keyId: 'k1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'free' }],
        [{ id: 'k2' }],
      ]);
      const res = await workerRequest('/v1/tenant/api-keys/k2/domains', {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedDomains: ['a.com', 'b.com'] }),
      }, mockEnv);
      expect(res.status).toBe(403);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe('plan_limit');
    });
  });

  describe('Plan limit enforcement', () => {
    it('rejects key creation when key count limit exceeded', async () => {
      mockDb._setSelectResults([
        [{ keyId: 'k1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'free' }],
        [{ id: 'k1' }, { id: 'k2' }],
      ]);
      const res = await workerRequest('/v1/tenant/api-keys', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Too Many' }),
      }, mockEnv);
      expect(res.status).toBe(403);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe('plan_limit');
    });

    it('rejects domain creation when domain limit exceeded', async () => {
      mockDb._setSelectResults([
        [{ keyId: 'k1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'free' }],
        [],
      ]);
      const res = await workerRequest('/v1/tenant/api-keys', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Key', allowedDomains: ['a.com', 'b.com'] }),
      }, mockEnv);
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /v1/tenant/api-keys/:id', () => {
    it('revokes key and cleans up domains', async () => {
      mockDb._setSelectResults([
        [{ keyId: 'k1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' }],
        [{ id: 'k2', tenantId: 't1', isActive: true }],
      ]);
      const res = await workerRequest('/v1/tenant/api-keys/k2', {
        method: 'DELETE',
        headers: authHeaders(),
      }, mockEnv);
      expect(res.status).toBe(200);
      const data = ((await res.json()) as { data: Record<string, unknown> }).data;
      expect(data.revoked).toBe(true);
    });

    it('returns 404 for non-existent key', async () => {
      mockDb._setSelectResults([
        [{ keyId: 'k1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' }],
        [],
      ]);
      const res = await workerRequest('/v1/tenant/api-keys/nonexistent', {
        method: 'DELETE',
        headers: authHeaders(),
      }, mockEnv);
      expect(res.status).toBe(404);
    });
  });
});
