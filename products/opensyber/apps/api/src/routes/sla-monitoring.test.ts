/**
 * SLA Monitoring Route Tests
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

import { slaMonitoringRoutes } from './sla-monitoring.js';

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

function createApp(results: unknown[]) {
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();
  app.route('/', slaMonitoringRoutes);
  const env = createMockEnv({ DB: createMockDB(results) });
  return { app, env };
}

describe('SLA Monitoring', () => {
  it('GET / returns SLA compliance status', async () => {
    const { app, env } = createApp([
      { target_uptime: 99.9 },
      { total_checks: 1000, up_checks: 998, avg_response_ms: 150, min_response_ms: 50, max_response_ms: 500 },
    ]);

    const res = await app.request('/', { headers: authOrg }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.targetUptime).toBe(99.9);
    expect(body.data.currentUptime).toBe(99.8);
  });

  it('GET / defaults to 100% when no checks', async () => {
    const { app, env } = createApp([
      null,
      { total_checks: 0, up_checks: 0 },
    ]);

    const res = await app.request('/', { headers: authOrg }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.currentUptime).toBe(100);
  });

  it('GET /metrics returns daily breakdown', async () => {
    const { app, env } = createApp([
      [{ day: '2026-03-07', checks: 48, up_checks: 48, avg_ms: 120 }],
      [],
    ]);

    const res = await app.request('/metrics', { headers: authOrg }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.dailyUptime).toHaveLength(1);
  });

  it('requires org context', async () => {
    const { app, env } = createApp([]);
    // Authenticated but no X-Org-Id header
    const res = await app.request('/', { headers: { Authorization: 'Bearer valid-token' } }, env);
    expect(res.status).toBe(400);
  });
});
