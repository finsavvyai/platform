import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
let db: ReturnType<typeof createMockDb>;

beforeEach(() => {
  vi.clearAllMocks();
  env = createMockEnv();
  db = createMockDb();
  (globalThis as Record<string, unknown>).__mockDb = db;
});
afterEach(() => { vi.restoreAllMocks(); });

describe('GET /scim/v2/Users', () => {
  it('returns SCIM ListResponse with totalResults + Resources', async () => {
    db._setSelectResult([
      { id: 'tf-sub-1', externalSubject: 'alice', email: 'alice@acme.com', name: 'Alice', metadata: null },
      { id: 'tf-sub-2', externalSubject: 'bob', email: null, name: null, metadata: null },
    ]);
    const res = await api('GET', '/scim/v2/Users', env);
    expect(res.status).toBe(200);
    const j = (await res.json()) as { schemas: string[]; totalResults: number; Resources: unknown[] };
    expect(j.schemas[0]).toBe('urn:ietf:params:scim:api:messages:2.0:ListResponse');
    expect(j.totalResults).toBe(2);
    expect(j.Resources).toHaveLength(2);
  });
});

describe('GET /scim/v2/Users/:id', () => {
  it('returns 404 SCIM error when not found', async () => {
    db._setSelectResult([]);
    const res = await api('GET', '/scim/v2/Users/missing', env);
    expect(res.status).toBe(404);
    const j = (await res.json()) as { schemas: string[]; detail: string };
    expect(j.schemas[0]).toBe('urn:ietf:params:scim:api:messages:2.0:Error');
    expect(j.detail).toBe('User not found');
  });

  it('returns SCIM user with userName/externalId/email when found', async () => {
    db._setSelectResult([{
      id: 'tf-sub-1', externalSubject: 'alice', email: 'alice@acme.com',
      name: 'Alice Example', metadata: JSON.stringify({ active: true }),
    }]);
    const res = await api('GET', '/scim/v2/Users/tf-sub-1', env);
    const j = (await res.json()) as {
      schemas: string[]; id: string; userName: string; externalId: string;
      emails: Array<{ value: string; primary: boolean }>; active: boolean;
    };
    expect(j.schemas[0]).toBe('urn:ietf:params:scim:schemas:core:2.0:User');
    expect(j.userName).toBe('alice');
    expect(j.externalId).toBe('alice');
    expect(j.emails).toEqual([{ value: 'alice@acme.com', primary: true }]);
    expect(j.active).toBe(true);
  });
});

describe('POST /scim/v2/Users', () => {
  it('returns 400 SCIM error when payload missing required userName', async () => {
    const res = await api('POST', '/scim/v2/Users', env, { schemas: ['x'] });
    expect(res.status).toBe(400);
    const j = (await res.json()) as { schemas: string[]; status: string };
    expect(j.schemas[0]).toBe('urn:ietf:params:scim:api:messages:2.0:Error');
    expect(j.status).toBe('400');
  });

  it('inserts a subject + returns 201 with SCIM-shaped user on happy path', async () => {
    db._setSelectResult([]);
    const res = await api('POST', '/scim/v2/Users', env, {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      userName: 'alice@acme.com',
      name: { formatted: 'Alice Example' },
      emails: [{ value: 'alice@acme.com', primary: true }],
      externalId: 'okta-1',
      active: true,
    });
    expect(res.status).toBe(201);
    const j = (await res.json()) as { id: string; userName: string; emails: unknown[] };
    expect(j.id).toMatch(/^tf-sub-/);
    expect(j.userName).toBe('okta-1');
    expect(db.insert).toHaveBeenCalled();
  });

  it('picks the primary email when multiple are provided', async () => {
    db._setSelectResult([]);
    const res = await api('POST', '/scim/v2/Users', env, {
      schemas: ['x'], userName: 'u1',
      emails: [
        { value: 'work@acme.com', primary: false },
        { value: 'primary@acme.com', primary: true },
      ],
    });
    const j = (await res.json()) as { emails: Array<{ value: string }> };
    expect(j.emails[0]!.value).toBe('primary@acme.com');
  });
});

describe('PATCH /scim/v2/Users/:id', () => {
  it('returns 404 SCIM error when subject not found', async () => {
    db._setSelectResult([]);
    const res = await api('PATCH', '/scim/v2/Users/missing', env, { Operations: [] });
    expect(res.status).toBe(404);
  });

  it('processes Operations[active=false] and persists deactivation', async () => {
    db._setSelectResult([{
      id: 'tf-sub-1', externalSubject: 'alice', email: null, name: null,
      metadata: JSON.stringify({ active: true }),
    }]);
    const res = await api('PATCH', '/scim/v2/Users/tf-sub-1', env, {
      Operations: [{ op: 'replace', path: 'active', value: false }],
    });
    expect(res.status).toBe(200);
    const j = (await res.json()) as { active: boolean };
    expect(j.active).toBe(false);
    expect(db.update).toHaveBeenCalled();
  });
});

describe('DELETE /scim/v2/Users/:id', () => {
  it('returns 204 No Content and issues a delete', async () => {
    const res = await api('DELETE', '/scim/v2/Users/tf-sub-1', env);
    expect(res.status).toBe(204);
    expect(db.delete).toHaveBeenCalled();
  });
});
