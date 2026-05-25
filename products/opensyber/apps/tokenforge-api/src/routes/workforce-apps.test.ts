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

vi.mock('../middleware/tenant-auth.js', () => ({
  tenantAuth: async (
    c: { set: (k: string, v: unknown) => void },
    next: () => Promise<void>,
  ) => {
    c.set('tenantId', 't1');
    c.set('tenantPlan', 'pro');
    await next();
  },
}));

vi.mock('../middleware/usage-limit.js', () => ({
  usageLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));

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

describe('Workforce apps CRUD', () => {
  let mockEnv: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = mockDb;
  });

  it('rejects POST when issuer is not a valid URL', async () => {
    const res = await workerRequest(
      '/v1/workforce/apps',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'okta-test',
          idpType: 'oidc_okta',
          issuer: 'not-a-url',
          audience: 'tf-app-1',
          jwksUri: 'https://acme.okta.com/jwks',
        }),
      },
      mockEnv,
    );
    expect(res.status).toBe(400);
  });

  it('rejects POST with unknown IdP type', async () => {
    const res = await workerRequest(
      '/v1/workforce/apps',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'unknown',
          idpType: 'oidc_some_random_thing',
          issuer: 'https://acme.example.com',
          audience: 'tf-app-1',
          jwksUri: 'https://acme.example.com/jwks',
        }),
      },
      mockEnv,
    );
    expect(res.status).toBe(400);
  });

  it('creates a valid Okta workforce app and strips trailing slash from issuer', async () => {
    const res = await workerRequest(
      '/v1/workforce/apps',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'corp-okta',
          idpType: 'oidc_okta',
          issuer: 'https://acme.okta.com/oauth2/default/',
          audience: 'tf-app-1',
          jwksUri: 'https://acme.okta.com/oauth2/default/v1/keys',
        }),
      },
      mockEnv,
    );
    expect(res.status).toBe(201);
    const insertCall = mockDb._insertChain.values.mock.calls[0]?.[0];
    expect(insertCall?.issuer).toBe('https://acme.okta.com/oauth2/default');
    expect(insertCall?.idpType).toBe('oidc_okta');
  });

  it('GET / returns rows ordered by createdAt asc, scoped to tenantId', async () => {
    mockDb._setSelectResult([
      { id: 'wf-1', tenantId: 't1', name: 'okta-prod', idpType: 'oidc_okta' },
      { id: 'wf-2', tenantId: 't1', name: 'auth0-staging', idpType: 'oidc_auth0' },
    ]);
    const res = await workerRequest('/v1/workforce/apps', { method: 'GET' }, mockEnv);
    expect(res.status).toBe(200);
    const j = (await res.json()) as { data: Array<{ id: string }> };
    expect(j.data).toHaveLength(2);
    expect(j.data[0]!.id).toBe('wf-1');
  });

  it('PATCH /:id returns 404 when app not found', async () => {
    mockDb._setSelectResult([]);
    const res = await workerRequest(
      '/v1/workforce/apps/missing',
      { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'rename' }) },
      mockEnv,
    );
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe('workforce_app_not_found');
  });

  it('PATCH /:id rejects invalid issuer URL with 400 invalid_payload', async () => {
    const res = await workerRequest(
      '/v1/workforce/apps/wf-1',
      { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ issuer: 'not-a-url' }) },
      mockEnv,
    );
    expect(res.status).toBe(400);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('PATCH /:id strips trailing slash from issuer on update', async () => {
    mockDb._setSelectResult([{ id: 'wf-1', tenantId: 't1', name: 'old', idpType: 'oidc_okta' }]);
    const res = await workerRequest(
      '/v1/workforce/apps/wf-1',
      { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ issuer: 'https://acme.okta.com/oauth2/default/' }) },
      mockEnv,
    );
    expect(res.status).toBe(200);
    const updateSet = mockDb._updateChain.set.mock.calls[0]?.[0] as { issuer?: string };
    expect(updateSet.issuer).toBe('https://acme.okta.com/oauth2/default');
  });

  it('DELETE /:id returns 404 when app not found', async () => {
    mockDb._setSelectResult([]);
    const res = await workerRequest('/v1/workforce/apps/missing', { method: 'DELETE' }, mockEnv);
    expect(res.status).toBe(404);
    expect(mockDb.delete).not.toHaveBeenCalled();
  });

  it('DELETE /:id removes the row on happy path', async () => {
    mockDb._setSelectResult([{ id: 'wf-1', tenantId: 't1', name: 'doomed' }]);
    const res = await workerRequest('/v1/workforce/apps/wf-1', { method: 'DELETE' }, mockEnv);
    expect(res.status).toBe(200);
    const j = (await res.json()) as { data: { deleted: boolean } };
    expect(j.data.deleted).toBe(true);
    expect(mockDb.delete).toHaveBeenCalled();
  });
});
