import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockEnv, createMockDb } from '../../test/helpers.js';
import type { Env } from '../../types.js';

vi.mock('../../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as Record<string, unknown>).__mockDb),
}));
vi.mock('hono/logger', () => ({
  logger: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../../middleware/tenant-auth.js', () => ({
  tenantAuth: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set('tenantId', 't1');
    c.set('tenantPlan', 'pro');
    await next();
  },
}));
vi.mock('../../middleware/usage-limit.js', () => ({ usageLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); } }));
vi.mock('../../middleware/rate-limit.js', () => ({
  publicRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  apiRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  rateLimit: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../../middleware/guard.js', () => ({
  guardMiddleware: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));

import worker from '../../index.js';

async function api(method: string, path: string, env: Env, body?: unknown): Promise<Response> {
  return worker.fetch(
    new Request(`http://localhost${path}`, {
      method,
      headers: { 'content-type': 'application/json', authorization: 'Bearer tf_test' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

let env: Env;
beforeEach(() => {
  vi.clearAllMocks();
  env = createMockEnv();
  (globalThis as Record<string, unknown>).__mockDb = createMockDb();
});

describe('GET /scim/v2/Groups', () => {
  it('returns SCIM ListResponse with empty Resources (groups not first-class in v1)', async () => {
    const res = await api('GET', '/scim/v2/Groups', env);
    expect(res.status).toBe(200);
    const j = (await res.json()) as { schemas: string[]; totalResults: number; Resources: unknown[] };
    expect(j.schemas[0]).toBe('urn:ietf:params:scim:api:messages:2.0:ListResponse');
    expect(j.totalResults).toBe(0);
    expect(j.Resources).toEqual([]);
  });
});

describe('POST /scim/v2/Groups', () => {
  it('returns 201 with SCIM Group schema + UUID id + displayName from body', async () => {
    const res = await api('POST', '/scim/v2/Groups', env, { displayName: 'Engineering' });
    expect(res.status).toBe(201);
    const j = (await res.json()) as { schemas: string[]; id: string; displayName: string; members: unknown[] };
    expect(j.schemas[0]).toBe('urn:ietf:params:scim:schemas:core:2.0:Group');
    expect(j.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(j.displayName).toBe('Engineering');
    expect(j.members).toEqual([]);
  });

  it('falls back to displayName="Unknown" when body is missing it', async () => {
    const res = await api('POST', '/scim/v2/Groups', env, {});
    const j = (await res.json()) as { displayName: string };
    expect(j.displayName).toBe('Unknown');
  });
});

describe('PATCH /scim/v2/Groups/:id', () => {
  it('returns SCIM Group schema with the id from the URL (no-op acknowledge)', async () => {
    const res = await api('PATCH', '/scim/v2/Groups/grp_abc123', env, {
      Operations: [{ op: 'add', path: 'members', value: [{ value: 'tf-sub-1' }] }],
    });
    expect(res.status).toBe(200);
    const j = (await res.json()) as { schemas: string[]; id: string; members: unknown[] };
    expect(j.schemas[0]).toBe('urn:ietf:params:scim:schemas:core:2.0:Group');
    expect(j.id).toBe('grp_abc123');
    expect(j.members).toEqual([]);
  });
});

describe('DELETE /scim/v2/Groups/:id', () => {
  it('returns 204 No Content (no-op acknowledge)', async () => {
    const res = await api('DELETE', '/scim/v2/Groups/grp_abc123', env);
    expect(res.status).toBe(204);
  });
});
