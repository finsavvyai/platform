import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockEnv, createMockDb, mockAuthFetch } from '../test/helpers.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as any).__mockDb),
}));

vi.mock('hono/logger', () => ({
  logger: () => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
}));

vi.stubGlobal('fetch', mockAuthFetch('user_admin'));

import worker from '../index.js';

async function request(path: string, init: RequestInit = {}, env: Env) {
  const req = new Request(`http://localhost${path}`, init);
  return worker.fetch(req, env, { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as any);
}

describe('Admin Stats Routes', () => {
  let env: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    vi.stubGlobal('fetch', mockAuthFetch('user_admin'));
  });

  it('GET /api/admin/stats returns 401 without auth', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Unauthorized', { status: 401 })));
    const res = await request('/api/admin/stats', {}, env);
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/stats returns 403 for non-admin', async () => {
    // authMiddleware only calls Clerk API (mocked), doesn't query DB
    // First DB select is adminMiddleware checking isAdmin
    mockDb._setSelectResults([
      [{ isAdmin: 0 }],
    ]);
    const res = await request('/api/admin/stats', {
      headers: { Authorization: 'Bearer valid-token' },
    }, env);
    expect(res.status).toBe(403);
  });

  it('GET /api/admin/stats returns stats for admin', async () => {
    mockDb._setSelectResults([
      [{ isAdmin: 1 }],  // admin middleware check
      [{ count: 100 }],  // totalUsers
      [{ count: 50 }],   // totalInstances
      [{ count: 10 }],   // totalOrgs
      [{ count: 1000 }], // totalEvents
      [{ count: 30 }],   // activeInstances
      [{ count: 14 }],   // totalLeads
      [{ count: 5 }],    // recentLeads7d
      [{ count: 220 }],  // trustPageViews
      [{ count: 87 }],   // recentViews7d
      [{ count: 48 }],   // trustTrialStarts
      [{ count: 31 }],   // trustSignupViews
      [{ count: 9 }],    // trustDemoRequests
      [{ source: 'linkedin', count: 80 }, { source: 'x', count: 42 }], // topSources
    ]);
    const res = await request('/api/admin/stats', {
      headers: { Authorization: 'Bearer valid-token' },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.totalUsers).toBe(100);
    expect(body.data.totalInstances).toBe(50);
    expect(body.data.trustFunnel.totalLeads).toBe(14);
    expect(body.data.trustFunnel.trustPageViews).toBe(220);
    expect(body.data.trustFunnel.topSources[0]).toEqual({ source: 'linkedin', count: 80 });
  });
});
