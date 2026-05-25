import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createMockEnv, createMockDb, mockAuthFetch } from '../test/helpers.js';

vi.mock('../lib/db.js', () => ({ createDb: vi.fn(() => (globalThis as any).__mockDb) }));
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (c: any, next: any) => {
    const h = c.req.header('Authorization');
    if (!h?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);
    c.set('userId', 'user_test123');
    await next();
  },
}));
vi.mock('../middleware/rbac.js', () => ({
  resolveOrgContext: async (c: any, next: any) => { await next(); },
  requirePermission: () => async (c: any, next: any) => {
    c.set('orgId', c.req.header('X-Org-Id') ?? null);
    await next();
  },
}));
vi.mock('../utils/instance-access.js', () => ({
  verifyInstanceAccess: vi.fn(async () => ({ id: 'inst-1', userId: 'user_test123' })),
}));
vi.stubGlobal('fetch', mockAuthFetch());

import { marketplaceInstallRoutes } from './marketplace-install.js';

describe('Marketplace Install Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockEnv: Env;
  const auth = { Authorization: 'Bearer tok' };
  const json = { ...auth, 'Content-Type': 'application/json' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    vi.stubGlobal('fetch', mockAuthFetch());
    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api/marketplace', marketplaceInstallRoutes);
  });

  it('installs an approved skill', async () => {
    mockDb._setSelectResults([[{ id: 's-1', verificationStatus: 'approved', currentVersion: '1.0.0' }]]);
    const res = await app.request('/api/marketplace/s-1/install', {
      method: 'POST', headers: json,
      body: JSON.stringify({ instanceId: 'inst-1' }),
    }, mockEnv);
    expect(res.status).toBe(201);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('rejects unapproved skill install', async () => {
    mockDb._setSelectResults([[{ id: 's-1', verificationStatus: 'pending' }]]);
    const res = await app.request('/api/marketplace/s-1/install', {
      method: 'POST', headers: json,
      body: JSON.stringify({ instanceId: 'inst-1' }),
    }, mockEnv);
    expect(res.status).toBe(400);
  });

  it('returns 404 for missing skill', async () => {
    mockDb._setSelectResults([[]]);
    const res = await app.request('/api/marketplace/missing/install', {
      method: 'POST', headers: json,
      body: JSON.stringify({ instanceId: 'inst-1' }),
    }, mockEnv);
    expect(res.status).toBe(404);
  });

  it('requires instanceId for install', async () => {
    mockDb._setSelectResults([[{ id: 's-1', verificationStatus: 'approved' }]]);
    const res = await app.request('/api/marketplace/s-1/install', {
      method: 'POST', headers: json,
      body: JSON.stringify({}),
    }, mockEnv);
    expect(res.status).toBe(400);
  });

  it('lists installed skills', async () => {
    mockDb._setSelectResults([[{ id: 'i-1', skillId: 's-1' }]]);
    const res = await app.request('/api/marketplace/installed?instanceId=inst-1', { headers: auth }, mockEnv);
    expect(res.status).toBe(200);
  });

  it('returns empty without instanceId', async () => {
    const res = await app.request('/api/marketplace/installed', { headers: auth }, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data).toEqual([]);
  });
});
