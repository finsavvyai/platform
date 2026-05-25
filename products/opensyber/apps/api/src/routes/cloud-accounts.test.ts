import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createMockEnv, createMockDb, mockAuthFetch } from '../test/helpers.js';

vi.mock('../lib/db.js', () => ({ createDb: vi.fn(() => (globalThis as any).__mockDb) }));
vi.mock('../utils/encryption.js', () => ({ encrypt: vi.fn(async (t: string) => `enc:${t}`) }));
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (c: any, next: any) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized', message: 'Missing or invalid authorization header' }, 401);
    }
    c.set('userId', 'user_test123');
    await next();
  },
}));
vi.mock('../middleware/rbac.js', () => ({
  resolveOrgContext: async (c: any, next: any) => {
    const orgId = c.req.header('X-Org-Id') ?? null;
    const role = c.req.header('X-Test-Role') ?? null;
    c.set('orgId', orgId);
    c.set('role', orgId ? role ?? 'admin' : null);
    c.set('orgMember', orgId ? { orgId, userId: 'user_test123', role: role ?? 'admin' } : null);
    await next();
  },
}));
vi.mock('../middleware/plan-enforcement.js', () => ({
  loadPlanConfig: async (c: any, next: any) => {
    c.set('planConfig', {
      plan: c.req.header('X-Org-Id') ? 'team' : 'personal',
      config: { cspmAccounts: 10 },
      isOrg: Boolean(c.req.header('X-Org-Id')),
    });
    await next();
  },
}));
vi.stubGlobal('fetch', mockAuthFetch());

import { cloudAccountRoutes } from './cloud-accounts.js';

describe('Cloud Account Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockEnv: Env;

  const auth = { Authorization: 'Bearer valid-token' };
  const org = { ...auth, 'X-Org-Id': 'org_test' };
  const jsonOrg = { ...org, 'Content-Type': 'application/json' };
  const viewerOrg = { ...jsonOrg, 'X-Test-Role': 'viewer' };
  const devOrg = { ...org, 'X-Test-Role': 'developer' };
  const member = { id: 'mem1', orgId: 'org_test', userId: 'user_test123', role: 'admin', status: 'active' };
  const viewer = { ...member, role: 'viewer' };
  const dev = { ...member, role: 'developer' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    vi.stubGlobal('fetch', mockAuthFetch());
    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api/cloud', cloudAccountRoutes);
  });

  it('returns 401 without auth', async () => {
    const res = await app.request('/api/cloud/accounts', {}, mockEnv);
    expect(res.status).toBe(401);
  });

  // ── GET /accounts ─────────────────────────────────────────────────
  describe('GET /api/cloud/accounts', () => {
    it('returns accounts scoped to org', async () => {
      mockDb._setSelectResults([[{ id: 'acc_1', provider: 'aws', name: 'Prod' }]]);
      const res = await app.request('/api/cloud/accounts', { headers: org }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe('acc_1');
    });

    it('returns accounts in solo mode (no X-Org-Id)', async () => {
      mockDb._setSelectResult([{ id: 'acc_solo', provider: 'gcp' }]);
      const res = await app.request('/api/cloud/accounts', { headers: auth }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(1);
    });

    it('returns empty array when no accounts', async () => {
      mockDb._setSelectResults([[]]);
      const res = await app.request('/api/cloud/accounts', { headers: org }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toEqual([]);
    });
  });

  // ── POST /accounts ────────────────────────────────────────────────
  describe('POST /api/cloud/accounts', () => {
    const valid = { provider: 'aws', name: 'My AWS' };

    it('creates account with encrypted credentials, returns 201', async () => {
      mockDb._setSelectResults([[{ count: 0 }], [{ id: 'acc_new', provider: 'aws', status: 'active' }]]);
      const res = await app.request('/api/cloud/accounts', {
        method: 'POST', headers: jsonOrg,
        body: JSON.stringify({ ...valid, credentials: { key: 'secret' } }),
      }, mockEnv);
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.data.provider).toBe('aws');
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it('validates provider — rejects invalid', async () => {
      mockDb._setSelectResults([[{ count: 0 }]]);
      const res = await app.request('/api/cloud/accounts', {
        method: 'POST', headers: jsonOrg,
        body: JSON.stringify({ provider: 'oracle', name: 'Bad' }),
      }, mockEnv);
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.message).toContain('Invalid enum value');
    });

    it('validates name is required', async () => {
      mockDb._setSelectResults([[{ count: 0 }]]);
      const res = await app.request('/api/cloud/accounts', {
        method: 'POST', headers: jsonOrg,
        body: JSON.stringify({ provider: 'aws' }),
      }, mockEnv);
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Required');
    });

    it('returns 403 without cloud.write (viewer role)', async () => {
      const res = await app.request('/api/cloud/accounts', {
        method: 'POST', headers: viewerOrg, body: JSON.stringify(valid),
      }, mockEnv);
      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.message).toContain('cloud.write');
    });

    it('returns 500 for invalid JSON body (unhandled parse error)', async () => {
      mockDb._setSelectResults([[{ count: 0 }]]);
      const res = await app.request('/api/cloud/accounts', {
        method: 'POST', headers: jsonOrg, body: 'not-json',
      }, mockEnv);
      expect(res.status).toBe(500);
    });
  });

  // ── PATCH /accounts/:id ───────────────────────────────────────────
  describe('PATCH /api/cloud/accounts/:id', () => {
    it('updates name and status', async () => {
      mockDb._setSelectResults([
        [{ id: 'acc_1', name: 'Old', status: 'active' }],
        [{ id: 'acc_1', name: 'New', status: 'inactive' }],
      ]);
      const res = await app.request('/api/cloud/accounts/acc_1', {
        method: 'PATCH', headers: jsonOrg,
        body: JSON.stringify({ name: 'New', status: 'inactive' }),
      }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.name).toBe('New');
      expect(mockDb.update).toHaveBeenCalledTimes(1);
    });

    it('returns 404 for non-existent account', async () => {
      mockDb._setSelectResults([[]]);
      const res = await app.request('/api/cloud/accounts/acc_x', {
        method: 'PATCH', headers: jsonOrg, body: JSON.stringify({ name: 'Up' }),
      }, mockEnv);
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Account not found');
    });

    it('returns 400 when no valid fields provided', async () => {
      mockDb._setSelectResults([[{ id: 'acc_1' }]]);
      const res = await app.request('/api/cloud/accounts/acc_1', {
        method: 'PATCH', headers: jsonOrg, body: JSON.stringify({ unknown: 'v' }),
      }, mockEnv);
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.message).toContain('No valid fields');
    });
  });

  // ── DELETE /accounts/:id ──────────────────────────────────────────
  describe('DELETE /api/cloud/accounts/:id', () => {
    it('removes account (admin has cloud.admin)', async () => {
      mockDb._setSelectResults([[{ id: 'acc_1' }]]);
      const res = await app.request('/api/cloud/accounts/acc_1', {
        method: 'DELETE', headers: org,
      }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.deleted).toBe(true);
      expect(mockDb.delete).toHaveBeenCalledTimes(1);
    });

    it('returns 403 for non-admin (developer lacks cloud.admin)', async () => {
      const res = await app.request('/api/cloud/accounts/acc_1', {
        method: 'DELETE', headers: devOrg,
      }, mockEnv);
      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.message).toContain('cloud.admin');
    });

    it('returns 404 for non-existent account', async () => {
      mockDb._setSelectResults([[]]);
      const res = await app.request('/api/cloud/accounts/acc_x', {
        method: 'DELETE', headers: org,
      }, mockEnv);
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Account not found');
    });
  });
});
