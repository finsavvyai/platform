import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env, Variables } from '../../types.js';
import { createMockEnv, createMockDb, mockAuthFetch } from '../../test/helpers.js';

vi.mock('../../lib/db.js', () => ({ createDb: vi.fn(() => (globalThis as any).__mockDb) }));
vi.mock('../../middleware/auth.js', () => ({
  authMiddleware: async (c: any, next: any) => {
    const h = c.req.header('Authorization');
    if (!h?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);
    c.set('userId', 'user_test123');
    await next();
  },
}));
vi.mock('../../middleware/rbac.js', () => ({
  requirePermission: () => async (c: any, next: any) => {
    const orgId = c.req.header('X-Org-Id') ?? null;
    c.set('orgId', orgId);
    c.set('role', orgId ? 'admin' : null);
    c.set('orgMember', orgId ? { orgId, userId: 'user_test123', role: 'admin' } : null);
    await next();
  },
}));
vi.stubGlobal('fetch', mockAuthFetch());

import { assetRelationRoutes } from './index.js';

describe('Asset Relation Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockEnv: Env;

  const auth = { Authorization: 'Bearer tok' };
  const org = { ...auth, 'X-Org-Id': 'org_test' };
  const jsonOrg = { ...org, 'Content-Type': 'application/json' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    vi.stubGlobal('fetch', mockAuthFetch());
    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api/asset-relations', assetRelationRoutes);
  });

  it('returns 401 without auth', async () => {
    const res = await app.request('/api/asset-relations/a1', {}, mockEnv);
    expect(res.status).toBe(401);
  });

  describe('GET /api/asset-relations/:assetId', () => {
    it('lists relations for asset', async () => {
      mockDb._setSelectResults([[
        { id: 'r1', sourceAssetId: 'a1', targetAssetId: 'a2', relationType: 'read_access' },
      ]]);
      const res = await app.request('/api/asset-relations/a1', { headers: org }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(1);
    });

    it('returns empty without orgId', async () => {
      const res = await app.request('/api/asset-relations/a1', { headers: auth }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toEqual([]);
    });
  });

  describe('POST /api/asset-relations', () => {
    const valid = {
      sourceAssetId: 'a1', targetAssetId: 'a2', relationType: 'read_access',
    };

    it('creates relation, returns 201', async () => {
      // Two selects: source asset check, target asset check
      mockDb._setSelectResults([[{ id: 'a1' }], [{ id: 'a2' }]]);
      const res = await app.request('/api/asset-relations', {
        method: 'POST', headers: jsonOrg, body: JSON.stringify(valid),
      }, mockEnv);
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.data.relationType).toBe('read_access');
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it('returns 400 without orgId', async () => {
      const res = await app.request('/api/asset-relations', {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify(valid),
      }, mockEnv);
      expect(res.status).toBe(400);
    });

    it('returns 404 when source asset missing', async () => {
      mockDb._setSelectResults([[], [{ id: 'a2' }]]);
      const res = await app.request('/api/asset-relations', {
        method: 'POST', headers: jsonOrg, body: JSON.stringify(valid),
      }, mockEnv);
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.message).toContain('Source');
    });

    it('returns 404 when target asset missing', async () => {
      mockDb._setSelectResults([[{ id: 'a1' }], []]);
      const res = await app.request('/api/asset-relations', {
        method: 'POST', headers: jsonOrg, body: JSON.stringify(valid),
      }, mockEnv);
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.message).toContain('Target');
    });

    it('validates required fields', async () => {
      const res = await app.request('/api/asset-relations', {
        method: 'POST', headers: jsonOrg, body: JSON.stringify({ sourceAssetId: 'a1' }),
      }, mockEnv);
      expect(res.status).toBe(400);
    });

    it('rejects invalid relationType', async () => {
      const res = await app.request('/api/asset-relations', {
        method: 'POST', headers: jsonOrg,
        body: JSON.stringify({ ...valid, relationType: 'teleports_to' }),
      }, mockEnv);
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/asset-relations/:id', () => {
    it('deletes relation', async () => {
      mockDb._setSelectResults([[{ id: 'r1' }]]);
      const res = await app.request('/api/asset-relations/r1', {
        method: 'DELETE', headers: org,
      }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.deleted).toBe(true);
    });

    it('returns 404 for non-existent relation', async () => {
      mockDb._setSelectResults([[]]);
      const res = await app.request('/api/asset-relations/missing', {
        method: 'DELETE', headers: org,
      }, mockEnv);
      expect(res.status).toBe(404);
    });
  });
});
