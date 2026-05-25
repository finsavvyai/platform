import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env, Variables } from '../../types.js';
import { createMockEnv, createMockDb, mockAuthFetch } from '../../test/helpers.js';

vi.mock('../../lib/db.js', () => ({ createDb: vi.fn(() => (globalThis as any).__mockDb) }));
vi.mock('../../utils/encryption.js', () => ({
  encrypt: vi.fn(async (t: string) => `enc:${t}`),
  decrypt: vi.fn(async (t: string) => t.replace('enc:', '')),
}));
vi.mock('../../middleware/auth.js', () => ({
  authMiddleware: async (c: any, next: any) => {
    const h = c.req.header('Authorization');
    if (!h?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);
    c.set('userId', 'user_test123');
    await next();
  },
}));
vi.mock('../../middleware/rbac.js', () => ({
  resolveOrgContextAutoDetect: async (c: any, next: any) => {
    const orgId = c.req.header('X-Org-Id') ?? null;
    c.set('orgId', orgId);
    c.set('role', orgId ? 'admin' : null);
    c.set('orgMember', orgId ? { orgId, userId: 'user_test123', role: 'admin' } : null);
    await next();
  },
  requirePermission: () => async (c: any, next: any) => {
    const orgId = c.get('orgId') ?? c.req.header('X-Org-Id') ?? null;
    c.set('orgId', orgId);
    c.set('role', orgId ? 'admin' : null);
    c.set('orgMember', orgId ? { orgId, userId: 'user_test123', role: 'admin' } : null);
    await next();
  },
}));
vi.mock('../../middleware/plan-enforcement.js', () => ({
  loadPlanConfig: async (_c: any, next: any) => { await next(); },
  requirePlanFeature: () => async (_c: any, next: any) => { await next(); },
}));
vi.mock('../../services/alerts/dispatcher.js', () => ({
  sendTestAlert: vi.fn(async () => ({ success: true, externalId: 'test-ext-1' })),
}));
vi.stubGlobal('fetch', mockAuthFetch());

import { alertChannelRoutes } from './index.js';

describe('Alert Channel Routes', () => {
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
    app.route('/api/alert-channels', alertChannelRoutes);
  });

  it('returns 401 without auth', async () => {
    const res = await app.request('/api/alert-channels', {}, mockEnv);
    expect(res.status).toBe(401);
  });

  describe('GET /api/alert-channels', () => {
    it('lists channels for org', async () => {
      mockDb._setSelectResults([[
        { id: 'ac-1', channelType: 'slack', name: 'Alerts', config: 'enc:{}', minSeverity: 'high', isActive: true },
      ]]);
      const res = await app.request('/api/alert-channels', { headers: org }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(1);
      expect(body.data[0].channelType).toBe('slack');
      // config should be stripped from response
      expect(body.data[0].config).toBeUndefined();
    });

    it('returns empty without orgId', async () => {
      const res = await app.request('/api/alert-channels', { headers: auth }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toEqual([]);
    });
  });

  describe('GET /api/alert-channels/:id', () => {
    it('returns single channel with decrypted config', async () => {
      mockDb._setSelectResults([[{ id: 'ac-1', channelType: 'email', name: 'Team', config: 'enc:{"to":["a@b.com"]}' }]]);
      const res = await app.request('/api/alert-channels/ac-1', { headers: org }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.config).toEqual({ to: ['a@b.com'] });
    });

    it('returns 404 for missing channel', async () => {
      mockDb._setSelectResults([[]]);
      const res = await app.request('/api/alert-channels/missing', { headers: org }, mockEnv);
      expect(res.status).toBe(404);
    });

    it('returns 404 without orgId', async () => {
      const res = await app.request('/api/alert-channels/ac-1', { headers: auth }, mockEnv);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/alert-channels', () => {
    const validSlack = {
      channelType: 'slack', name: 'Prod Alerts',
      config: { slack: { webhookUrl: 'https://hooks.slack.com/xxx' } },
    };

    it('creates channel, returns 201', async () => {
      const res = await app.request('/api/alert-channels', {
        method: 'POST', headers: jsonOrg, body: JSON.stringify(validSlack),
      }, mockEnv);
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.data.channelType).toBe('slack');
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it('returns 400 without orgId', async () => {
      const res = await app.request('/api/alert-channels', {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify(validSlack),
      }, mockEnv);
      expect(res.status).toBe(400);
    });

    it('validates required fields', async () => {
      const res = await app.request('/api/alert-channels', {
        method: 'POST', headers: jsonOrg,
        body: JSON.stringify({ channelType: 'slack' }),
      }, mockEnv);
      expect(res.status).toBe(400);
    });

    it('validates channel-specific config', async () => {
      const res = await app.request('/api/alert-channels', {
        method: 'POST', headers: jsonOrg,
        body: JSON.stringify({
          channelType: 'slack', name: 'Bad',
          config: { slack: { webhookUrl: 'not-https' } },
        }),
      }, mockEnv);
      expect(res.status).toBe(400);
    });

    it('requires matching config key', async () => {
      const res = await app.request('/api/alert-channels', {
        method: 'POST', headers: jsonOrg,
        body: JSON.stringify({
          channelType: 'slack', name: 'Bad', config: { email: { to: ['a@b.com'] } },
        }),
      }, mockEnv);
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/alert-channels/:id', () => {
    it('updates channel name', async () => {
      mockDb._setSelectResults([[{ id: 'ac-1', channelType: 'slack' }]]);
      const res = await app.request('/api/alert-channels/ac-1', {
        method: 'PUT', headers: jsonOrg,
        body: JSON.stringify({ name: 'Updated', isActive: false }),
      }, mockEnv);
      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalledTimes(1);
    });

    it('returns 404 for missing channel', async () => {
      mockDb._setSelectResults([[]]);
      const res = await app.request('/api/alert-channels/missing', {
        method: 'PUT', headers: jsonOrg, body: JSON.stringify({ name: 'X' }),
      }, mockEnv);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/alert-channels/:id', () => {
    it('deletes channel', async () => {
      mockDb._setSelectResults([[{ id: 'ac-1' }]]);
      const res = await app.request('/api/alert-channels/ac-1', {
        method: 'DELETE', headers: org,
      }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.deleted).toBe(true);
    });

    it('returns 404 for missing channel', async () => {
      mockDb._setSelectResults([[]]);
      const res = await app.request('/api/alert-channels/missing', {
        method: 'DELETE', headers: org,
      }, mockEnv);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/alert-channels/:id/test', () => {
    it('sends test alert', async () => {
      mockDb._setSelectResults([[{ id: 'ac-1', channelType: 'slack', config: 'enc:{}' }]]);
      const res = await app.request('/api/alert-channels/ac-1/test', {
        method: 'POST', headers: org,
      }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.sent).toBe(true);
    });

    it('returns 404 for missing channel', async () => {
      mockDb._setSelectResults([[]]);
      const res = await app.request('/api/alert-channels/missing/test', {
        method: 'POST', headers: org,
      }, mockEnv);
      expect(res.status).toBe(404);
    });
  });
});
