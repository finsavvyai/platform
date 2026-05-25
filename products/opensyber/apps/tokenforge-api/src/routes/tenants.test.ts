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

describe('Tenant Routes', () => {
  let mockEnv: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = mockDb;
  });

  describe('GET /v1/tenant', () => {
    it('returns tenant info with usage', async () => {
      mockDb._setSelectResults([
        [{ keyId: 'k1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' }],
        [{ id: 't1', name: 'Test', slug: 'test', plan: 'pro', lemonSqueezyCustomerId: 'c1', lemonSqueezySubscriptionId: 's1', createdAt: '2025-01-01' }],
        [{ totalVerifications: 100, totalBinds: 50 }],
      ]);
      const res = await workerRequest('/v1/tenant', { headers: authHeaders() }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      const data = body.data as Record<string, unknown>;
      expect(data.name).toBe('Test');
      expect(data.plan).toBe('pro');
    });

    it('returns 404 when tenant not found', async () => {
      mockDb._setSelectResults([
        [{ keyId: 'k1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' }],
        [],
      ]);
      const res = await workerRequest('/v1/tenant', { headers: authHeaders() }, mockEnv);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /v1/tenant/api-keys', () => {
    it('creates a new API key', async () => {
      mockDb._setSelectResults([
        [{ keyId: 'k1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' }],
        [{ id: 'k1' }],
      ]);
      const res = await workerRequest('/v1/tenant/api-keys', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'My Key' }),
      }, mockEnv);
      expect(res.status).toBe(201);
      const data = ((await res.json()) as { data: Record<string, unknown> }).data;
      expect(data.name).toBe('My Key');
      expect((data.key as string).startsWith('tf_')).toBe(true);
      expect(data.allowedDomains).toEqual([]);
    });

    it('creates key with allowed domains', async () => {
      mockDb._setSelectResults([
        [{ keyId: 'k1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' }],
        [],
      ]);
      const res = await workerRequest('/v1/tenant/api-keys', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Web Key', allowedDomains: ['myapp.com', 'staging.myapp.com'] }),
      }, mockEnv);
      expect(res.status).toBe(201);
      const data = ((await res.json()) as { data: Record<string, unknown> }).data;
      expect(data.allowedDomains).toEqual(['myapp.com', 'staging.myapp.com']);
    });

    it('returns 400 with invalid body', async () => {
      mockDb._setSelectResults([
        [{ keyId: 'k1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' }],
        [{ totalVerifications: 0, totalBinds: 0 }],
      ]);
      const res = await workerRequest('/v1/tenant/api-keys', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      }, mockEnv);
      expect(res.status).toBe(400);
    });

    it('creates key with expiration', async () => {
      mockDb._setSelectResults([
        [{ keyId: 'k1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' }],
        [],
      ]);
      const res = await workerRequest('/v1/tenant/api-keys', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Temp Key', expiresInDays: 30 }),
      }, mockEnv);
      expect(res.status).toBe(201);
      const data = ((await res.json()) as { data: Record<string, unknown> }).data;
      expect(data.expiresAt).toBeDefined();
    });
  });

  describe('GET /v1/tenant/api-keys', () => {
    it('returns list of API keys with domains', async () => {
      mockDb._setSelectResults([
        [{ keyId: 'k1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' }],
        [
          { id: 'k1', name: 'Key 1', prefix: 'tf_ab12...', isActive: true, lastUsedAt: null, expiresAt: null, createdAt: '2025-01-01' },
          { id: 'k2', name: 'Key 2', prefix: 'tf_cd34...', isActive: false, lastUsedAt: null, expiresAt: null, createdAt: '2025-01-02' },
        ],
      ]);
      await mockEnv.CACHE.put('domains:k1', JSON.stringify(['myapp.com']));
      const res = await workerRequest('/v1/tenant/api-keys', { headers: authHeaders() }, mockEnv);
      expect(res.status).toBe(200);
      const data = ((await res.json()) as { data: Array<Record<string, unknown>> }).data;
      expect(data.length).toBe(2);
      expect(data[0]!.allowedDomains).toEqual(['myapp.com']);
      expect(data[1]!.allowedDomains).toEqual([]);
    });
  });
});
