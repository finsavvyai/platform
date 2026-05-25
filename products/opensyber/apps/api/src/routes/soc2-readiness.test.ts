/**
 * SOC2 Readiness Route Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createMockEnv } from '../test/helpers.js';

vi.mock('../lib/db.js', () => ({ createDb: vi.fn(() => ({})) }));
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (c: any, next: any) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    c.set('userId', 'user_test123');
    await next();
  },
}));
vi.mock('../middleware/rbac.js', () => ({
  resolveOrgContext: async (c: any, next: any) => {
    const orgId = c.req.header('X-Org-Id') ?? null;
    c.set('orgId', orgId);
    await next();
  },
}));

import { soc2Routes } from './soc2-readiness.js';

function createMockDB(results: unknown[]) {
  let callIndex = 0;
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => {
        const idx = callIndex++;
        return {
          first: vi.fn(async () => results[idx] ?? null),
          all: vi.fn(async () => ({ results: Array.isArray(results[idx]) ? results[idx] : [] })),
        };
      }),
    })),
  } as unknown as D1Database;
}

const authOrg = { Authorization: 'Bearer valid-token', 'X-Org-Id': 'org_test' };
const authOnly = { Authorization: 'Bearer valid-token' };

function createApp(results: unknown[]) {
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();
  app.route('/', soc2Routes);
  const env = createMockEnv({ DB: createMockDB(results) });
  return { app, env };
}

describe('SOC2 Readiness', () => {
  it('GET / returns readiness when no assessment exists', async () => {
    const { app, env } = createApp([null]);
    const res = await app.request('/', { headers: authOrg }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.hasAssessment).toBe(false);
  });

  it('GET /mappings returns SOC2-to-OASF mappings', async () => {
    const { app, env } = createApp([]);
    const res = await app.request('/mappings', { headers: authOrg }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.mappings).toHaveLength(15);
  });

  it('GET /evidence requires org context', async () => {
    const { app, env } = createApp([]);
    // Authenticated but no X-Org-Id header
    const res = await app.request('/evidence', { headers: authOnly }, env);
    expect(res.status).toBe(400);
  });

  it('GET /evidence returns evidence counts', async () => {
    const { app, env } = createApp([
      { cnt: 5 }, { cnt: 3 }, { cnt: 1 }, { cnt: 2 }, { cnt: 100 },
    ]);

    const res = await app.request('/evidence', { headers: authOrg }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.evidence.rbacMembers).toBe(5);
  });
});
