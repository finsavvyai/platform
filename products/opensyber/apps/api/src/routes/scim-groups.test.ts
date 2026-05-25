/**
 * SCIM Group Provisioning Route Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { scimGroupRoutes } from './scim-groups.js';
import { createMockEnv } from '../test/helpers.js';

const SCIM_TOKEN = 'scim_test_token_123';

function createMockDB(results: unknown[]) {
  let callIndex = 0;
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => {
        const idx = callIndex++;
        return {
          all: vi.fn(async () => ({ results: Array.isArray(results[idx]) ? results[idx] : [] })),
          first: vi.fn(async () => (!Array.isArray(results[idx]) ? results[idx] : null)),
        };
      }),
    })),
  } as unknown as D1Database;
}

function createMockCache(): KVNamespace {
  return {
    get: vi.fn(async (key: string) => key === `scim:token:${SCIM_TOKEN}` ? JSON.stringify({ orgId: 'org_test' }) : null),
    put: vi.fn(), delete: vi.fn(), list: vi.fn(), getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
}

const scimHeaders = { Authorization: `Bearer ${SCIM_TOKEN}` };

describe('SCIM Groups', () => {
  it('GET /Groups returns 4 role-based groups', async () => {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/', scimGroupRoutes);

    const env = createMockEnv({
      DB: createMockDB([[
        { user_id: 'u1', role: 'admin', email: 'admin@test.com' },
        { user_id: 'u2', role: 'developer', email: 'dev@test.com' },
      ]]),
      CACHE: createMockCache(),
    });

    const res = await app.request('/Groups', { headers: scimHeaders }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.Resources).toHaveLength(4);
  });

  it('GET /Groups/:id returns group with members', async () => {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/', scimGroupRoutes);

    const env = createMockEnv({
      DB: createMockDB([[{ user_id: 'u1', email: 'admin@test.com' }]]),
      CACHE: createMockCache(),
    });

    const res = await app.request('/Groups/admin', { headers: scimHeaders }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.displayName).toBe('Admin');
    expect(body.members).toHaveLength(1);
  });

  it('GET /Groups/:id returns 404 for unknown group', async () => {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/', scimGroupRoutes);

    const env = createMockEnv({ DB: createMockDB([]), CACHE: createMockCache() });
    const res = await app.request('/Groups/unknown', { headers: scimHeaders }, env);
    expect(res.status).toBe(404);
  });

  it('rejects unauthenticated requests', async () => {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/', scimGroupRoutes);

    const env = createMockEnv({ DB: createMockDB([]), CACHE: createMockCache() });
    const res = await app.request('/Groups', {}, env);
    expect(res.status).toBe(401);
  });
});
