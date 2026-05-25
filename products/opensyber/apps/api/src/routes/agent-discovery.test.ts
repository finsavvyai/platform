import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createMockDb, createMockEnv } from '../test/helpers.js';

vi.mock('../lib/db.js', () => ({ createDb: vi.fn(() => (globalThis as any).__mockDb) }));
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (c: any, next: any) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);
    c.set('userId', 'user_test123');
    await next();
  },
}));
vi.mock('../middleware/rbac.js', () => ({
  resolveOrgContext: async (c: any, next: any) => {
    c.set('orgId', c.req.header('X-Org-Id') ?? null);
    await next();
  },
}));
import { agentDiscoveryRoutes } from './agent-discovery.js';

describe('Agent Discovery Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockEnv: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api/discovery', agentDiscoveryRoutes);
  });

  it('starts discovery run with org context', async () => {
    const res = await app.request('/api/discovery/runs', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer token',
        'X-Org-Id': 'org_123',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sourceType: 'repo', sourceRef: 'github.com/acme/repo' }),
    }, mockEnv);

    expect(res.status).toBe(201);
    const body = await res.json() as { data: { id: string; status: string } };
    expect(body.data.id).toBeTruthy();
    expect(body.data.status).toBe('running');
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb._insertChain.values).toHaveBeenCalled();
  });

  it('returns 400 when org context is missing', async () => {
    const res = await app.request('/api/discovery/runs', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    }, mockEnv);

    expect(res.status).toBe(400);
  });
});
