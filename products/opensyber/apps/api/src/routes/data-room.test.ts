/**
 * Data Room Route Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createMockEnv } from '../test/helpers.js';

vi.mock('../lib/db.js', () => ({ createDb: vi.fn(() => ({})) }));
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (c: any, next: any) => {
    c.set('userId', 'user_admin');
    await next();
  },
}));
vi.mock('../middleware/admin.js', () => ({
  adminMiddleware: async (_c: any, next: any) => { await next(); },
}));

import { dataRoomRoutes } from './data-room.js';

function createMockDB(results: unknown[]) {
  let callIndex = 0;
  const makeResult = () => {
    const idx = callIndex++;
    return {
      first: vi.fn(async () => results[idx] ?? null),
      all: vi.fn(async () => ({ results: Array.isArray(results[idx]) ? results[idx] : [] })),
      bind: vi.fn(() => makeResult()),
    };
  };
  return {
    prepare: vi.fn(() => makeResult()),
  } as unknown as D1Database;
}

function createApp(results: unknown[]) {
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();
  app.route('/', dataRoomRoutes);
  const env = createMockEnv({ DB: createMockDB(results) });
  return { app, env };
}

describe('Data Room', () => {
  it('GET / returns investor metrics', async () => {
    const { app, env } = createApp([
      { total: 25, paying: 10 },
      { total: 100 },
      { total: 5000 },
      { total: 250 },
      { avg_score: 78 },
    ]);

    const res = await app.request('/', {}, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.customers.totalOrgs).toBe(25);
    expect(body.data.customers.payingOrgs).toBe(10);
  });

  it('GET /export returns full JSON bundle', async () => {
    const { app, env } = createApp([
      [{ id: 'org1', name: 'Acme', plan: 'pro', created_at: '2026-01-01' }],
      { total: 50, active: 30 },
      [{ month: '2026-03', signups: 5 }],
      { total: 12 },
    ]);

    const res = await app.request('/export', {}, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.company).toBe('OpenSyber');
    expect(body.data.organizations).toHaveLength(1);
  });

  it('handles empty database gracefully', async () => {
    const { app, env } = createApp([null, null, null, null, null]);

    const res = await app.request('/', {}, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.customers.totalOrgs).toBe(0);
  });
});
