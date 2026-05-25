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

describe('Tenant Auth Middleware', () => {
  let mockEnv: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = mockDb;
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await workerRequest('/v1/sessions', {}, mockEnv);
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe('unauthorized');
  });

  it('returns 401 when Bearer token is missing', async () => {
    const res = await workerRequest(
      '/v1/sessions',
      { headers: { Authorization: 'Basic abc' } },
      mockEnv,
    );
    expect(res.status).toBe(401);
  });

  it('returns 401 when API key does not start with tf_', async () => {
    const res = await workerRequest(
      '/v1/sessions',
      { headers: { Authorization: 'Bearer sk_invalid' } },
      mockEnv,
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.message).toContain('Invalid token format');
  });

  it('returns 401 when API key is not found in database', async () => {
    mockDb._setSelectResult([]);
    const res = await workerRequest(
      '/v1/sessions',
      { headers: { Authorization: 'Bearer tf_testkey123' } },
      mockEnv,
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.message).toContain('Invalid API key');
  });

  it('returns 401 when API key is inactive', async () => {
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: false, expiresAt: null, tenantPlan: 'pro' }],
      [],
    ]);
    const res = await workerRequest(
      '/v1/sessions',
      { headers: { Authorization: 'Bearer tf_testkey123' } },
      mockEnv,
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.message).toContain('inactive');
  });

  it('returns 401 when API key has expired', async () => {
    const expiredDate = new Date(Date.now() - 86400000).toISOString();
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: expiredDate, tenantPlan: 'pro' }],
      [],
    ]);
    const res = await workerRequest(
      '/v1/sessions',
      { headers: { Authorization: 'Bearer tf_testkey123' } },
      mockEnv,
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.message).toContain('expired');
  });

  it('authenticates successfully with valid API key', async () => {
    // First select: tenant auth lookup. Second select: usage limit. Third: sessions list.
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' }],
      [{ totalVerifications: 0, totalBinds: 0 }],
      [],
    ]);
    const res = await workerRequest(
      '/v1/sessions',
      { headers: { Authorization: 'Bearer tf_testkey123' } },
      mockEnv,
    );
    expect(res.status).toBe(200);
  });

  it('returns 401 invalid_token_format when Bearer prefix is unknown (not tf_ or sjwt_)', async () => {
    const res = await workerRequest(
      '/v1/sessions',
      { headers: { Authorization: 'Bearer xyz_unknown_prefix' } },
      mockEnv,
    );
    expect(res.status).toBe(401);
    expect(((await res.json()) as { message: string }).message).toContain('Invalid token format');
  });

  it('returns 403 domain_not_allowed when Origin is not in the configured allowlist', async () => {
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' }],
    ]);
    await mockEnv.CACHE.put('domains:key1', JSON.stringify(['app.acme.com']));
    const res = await workerRequest(
      '/v1/sessions',
      {
        headers: {
          Authorization: 'Bearer tf_testkey123',
          Origin: 'https://attacker.example',
        },
      },
      mockEnv,
    );
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: string }).error).toBe('domain_not_allowed');
  });

  it('accepts wildcard subdomain in allowlist (e.g. *.acme.com matches foo.acme.com)', async () => {
    mockDb._setSelectResults([
      [{ keyId: 'key1', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' }],
      [{ totalVerifications: 0, totalBinds: 0 }],
      [],
    ]);
    await mockEnv.CACHE.put('domains:key1', JSON.stringify(['*.acme.com']));
    const res = await workerRequest(
      '/v1/sessions',
      {
        headers: {
          Authorization: 'Bearer tf_testkey123',
          Origin: 'https://foo.acme.com',
        },
      },
      mockEnv,
    );
    expect(res.status).toBe(200);
  });
});
