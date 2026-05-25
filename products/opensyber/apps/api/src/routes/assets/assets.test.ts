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

import { assetRoutes } from './index.js';

describe('Asset Routes', () => {
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
    app.route('/api/assets', assetRoutes);
  });

  it('returns 401 without auth', async () => {
    const res = await app.request('/api/assets', {}, mockEnv);
    expect(res.status).toBe(401);
  });

  describe('GET /api/assets', () => {
    it('lists assets for org', async () => {
      mockDb._setSelectResults([[{ id: 'a1', name: 'File A', assetType: 'file' }]]);
      const res = await app.request('/api/assets', { headers: org }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(1);
      expect(body.hasMore).toBe(false);
    });

    it('returns empty when no orgId', async () => {
      const res = await app.request('/api/assets', { headers: auth }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toEqual([]);
    });

    it('paginates with hasMore', async () => {
      const items = Array.from({ length: 51 }, (_, i) => ({ id: `a${i}` }));
      mockDb._setSelectResults([items]);
      const res = await app.request('/api/assets?limit=50', { headers: org }, mockEnv);
      const body = (await res.json()) as any;
      expect(body.hasMore).toBe(true);
      expect(body.data).toHaveLength(50);
      expect(body.nextCursor).toBe('a49');
    });

    it('rejects invalid limit', async () => {
      const res = await app.request('/api/assets?limit=999', { headers: org }, mockEnv);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/assets/:id', () => {
    it('returns single asset', async () => {
      mockDb._setSelectResults([[{ id: 'a1', name: 'Secret Key' }]]);
      const res = await app.request('/api/assets/a1', { headers: org }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.id).toBe('a1');
    });

    it('returns 404 when not found', async () => {
      mockDb._setSelectResults([[]]);
      const res = await app.request('/api/assets/missing', { headers: org }, mockEnv);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/assets', () => {
    const valid = { assetType: 'file', name: 'config.yml', identifier: '/etc/config.yml' };

    it('creates asset, returns 201', async () => {
      const res = await app.request('/api/assets', {
        method: 'POST', headers: jsonOrg, body: JSON.stringify(valid),
      }, mockEnv);
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.data.name).toBe('config.yml');
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it('returns 400 without orgId', async () => {
      const res = await app.request('/api/assets', {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify(valid),
      }, mockEnv);
      expect(res.status).toBe(400);
    });

    it('validates required fields', async () => {
      const res = await app.request('/api/assets', {
        method: 'POST', headers: jsonOrg, body: JSON.stringify({ assetType: 'file' }),
      }, mockEnv);
      expect(res.status).toBe(400);
    });

    it('rejects invalid assetType', async () => {
      const res = await app.request('/api/assets', {
        method: 'POST', headers: jsonOrg,
        body: JSON.stringify({ ...valid, assetType: 'spaceship' }),
      }, mockEnv);
      expect(res.status).toBe(400);
    });

    it('accepts metadata', async () => {
      const res = await app.request('/api/assets', {
        method: 'POST', headers: jsonOrg,
        body: JSON.stringify({ ...valid, metadata: { region: 'us-east-1' } }),
      }, mockEnv);
      expect(res.status).toBe(201);
    });
  });

  describe('PUT /api/assets/:id', () => {
    it('updates asset', async () => {
      mockDb._setSelectResults([[{ id: 'a1', name: 'Old' }]]);
      const res = await app.request('/api/assets/a1', {
        method: 'PUT', headers: jsonOrg,
        body: JSON.stringify({ name: 'New', sensitivity: 'high' }),
      }, mockEnv);
      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalledTimes(1);
    });

    it('returns 404 for non-existent asset', async () => {
      mockDb._setSelectResults([[]]);
      const res = await app.request('/api/assets/missing', {
        method: 'PUT', headers: jsonOrg, body: JSON.stringify({ name: 'Up' }),
      }, mockEnv);
      expect(res.status).toBe(404);
    });

    it('rejects invalid sensitivity', async () => {
      mockDb._setSelectResults([[{ id: 'a1' }]]);
      const res = await app.request('/api/assets/a1', {
        method: 'PUT', headers: jsonOrg,
        body: JSON.stringify({ sensitivity: 'ultra' }),
      }, mockEnv);
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/assets/:id', () => {
    it('deletes asset', async () => {
      mockDb._setSelectResults([[{ id: 'a1' }]]);
      const res = await app.request('/api/assets/a1', {
        method: 'DELETE', headers: org,
      }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.deleted).toBe(true);
    });

    it('returns 404 for non-existent asset', async () => {
      mockDb._setSelectResults([[]]);
      const res = await app.request('/api/assets/missing', {
        method: 'DELETE', headers: org,
      }, mockEnv);
      expect(res.status).toBe(404);
    });
  });
});
