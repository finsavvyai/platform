import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createMockEnv, createMockDb, mockAuthFetch } from '../test/helpers.js';

vi.mock('../lib/db.js', () => ({ createDb: vi.fn(() => (globalThis as any).__mockDb) }));
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
  requirePermission: () => async (c: any, next: any) => {
    const orgId = c.req.header('X-Org-Id') ?? null;
    const role = orgId ? c.req.header('X-Test-Role') ?? 'admin' : null;
    c.set('orgId', orgId);
    c.set('role', role);
    c.set('orgMember', orgId ? { orgId, userId: 'user_test123', role } : null);
    await next();
  },
}));
vi.mock('../middleware/plan-enforcement.js', () => ({
  loadPlanConfig: async (c: any, next: any) => {
    c.set('planConfig', {
      plan: c.req.header('X-Org-Id') ? 'team' : 'personal',
      config: { teamDashboard: true },
      isOrg: Boolean(c.req.header('X-Org-Id')),
    });
    await next();
  },
  requirePlanFeature: () => async (_c: any, next: any) => {
    await next();
  },
}));
vi.stubGlobal('fetch', mockAuthFetch());

import { agentTeamRoutes } from './agent-activity-team.js';

describe('Agent Activity Team Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockEnv: Env;

  const auth = { Authorization: 'Bearer valid-token' };
  const org = { ...auth, 'X-Org-Id': 'org_test' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    vi.stubGlobal('fetch', mockAuthFetch());
    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api/agents', agentTeamRoutes);
  });

  it('returns 401 without auth', async () => {
    const res = await app.request('/api/agents/team/activity', {}, mockEnv);
    expect(res.status).toBe(401);
  });

  // ── GET /team/activity ────────────────────────────────────────────
  describe('GET /api/agents/team/activity', () => {
    it('returns org-scoped activity, paginated', async () => {
      const events = [
        { id: 'e1', userId: 'u1', orgId: 'org_test', risk: 'high', secretsCount: 0, createdAt: '2026-03-01' },
        { id: 'e2', userId: 'u2', orgId: 'org_test', risk: 'low', secretsCount: 1, createdAt: '2026-03-01' },
      ];
      mockDb._setSelectResults([events]);
      const res = await app.request('/api/agents/team/activity', { headers: org }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(2);
      expect(body.hasMore).toBe(false);
    });

    it('returns 400 without org context (solo mode)', async () => {
      const res = await app.request('/api/agents/team/activity', { headers: auth }, mockEnv);
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.message).toContain('Org context required');
    });

    it('returns hasMore when result count equals limit', async () => {
      const events = Array.from({ length: 100 }, (_, i) => ({
        id: `e${i}`, userId: 'u1', orgId: 'org_test', risk: 'low', secretsCount: 0, createdAt: '2026-03-01',
      }));
      mockDb._setSelectResults([events]);
      const res = await app.request('/api/agents/team/activity', { headers: org }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.hasMore).toBe(true);
    });

    it('returns empty when no activity', async () => {
      mockDb._setSelectResults([[]]);
      const res = await app.request('/api/agents/team/activity', { headers: org }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toEqual([]);
    });
  });

  // ── GET /team/summary ─────────────────────────────────────────────
  describe('GET /api/agents/team/summary', () => {
    it('returns aggregate risk counts with unique users', async () => {
      const events = [
        { id: 'e1', userId: 'u1', risk: 'critical', secretsCount: 2 },
        { id: 'e2', userId: 'u1', risk: 'high', secretsCount: 0 },
        { id: 'e3', userId: 'u2', risk: 'medium', secretsCount: 1 },
        { id: 'e4', userId: 'u3', risk: 'low', secretsCount: 0 },
      ];
      mockDb._setSelectResults([events]);
      const res = await app.request('/api/agents/team/summary', { headers: org }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.total).toBe(4);
      expect(body.data.critical).toBe(1);
      expect(body.data.high).toBe(1);
      expect(body.data.medium).toBe(1);
      expect(body.data.low).toBe(1);
      expect(body.data.secretsDetected).toBe(3);
      expect(body.data.uniqueUsers).toBe(3);
    });

    it('returns 400 without org context', async () => {
      const res = await app.request('/api/agents/team/summary', { headers: auth }, mockEnv);
      expect(res.status).toBe(400);
    });
  });

  // ── GET /team/members ─────────────────────────────────────────────
  describe('GET /api/agents/team/members', () => {
    it('returns per-member breakdown', async () => {
      const events = [
        { id: 'e1', userId: 'u1', risk: 'high', secretsCount: 3 },
        { id: 'e2', userId: 'u1', risk: 'low', secretsCount: 0 },
        { id: 'e3', userId: 'u2', risk: 'critical', secretsCount: 1 },
      ];
      mockDb._setSelectResults([events]);
      const res = await app.request('/api/agents/team/members', { headers: org }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(2);
      const u1 = body.data.find((m: any) => m.userId === 'u1');
      expect(u1.total).toBe(2);
      expect(u1.high).toBe(1);
      expect(u1.secretsDetected).toBe(3);
      const u2 = body.data.find((m: any) => m.userId === 'u2');
      expect(u2.total).toBe(1);
      expect(u2.critical).toBe(1);
    });

    it('returns 400 without org context', async () => {
      const res = await app.request('/api/agents/team/members', { headers: auth }, mockEnv);
      expect(res.status).toBe(400);
    });

    it('returns empty when no events', async () => {
      mockDb._setSelectResults([[]]);
      const res = await app.request('/api/agents/team/members', { headers: org }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toEqual([]);
    });
  });

  // ── GET /team/risk-score ──────────────────────────────────────────
  describe('GET /api/agents/team/risk-score', () => {
    it('returns combined score with grade', async () => {
      mockDb._setSelectResults([
        [{ id: 'e1', risk: 'low', secretsCount: 0, userId: 'u1' }],
        [{ id: 'f1', severity: 'medium', status: 'open' }],
      ]);
      const res = await app.request('/api/agents/team/risk-score', { headers: org }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.agentScore).toBeDefined();
      expect(body.data.cspmScore).toBeDefined();
      expect(body.data.combined).toBeDefined();
      expect(typeof body.data.combined).toBe('number');
      expect(['A', 'B', 'C', 'D', 'F']).toContain(body.data.grade);
    });

    it('returns 400 without org context', async () => {
      const res = await app.request('/api/agents/team/risk-score', { headers: auth }, mockEnv);
      expect(res.status).toBe(400);
    });

    it('returns perfect score when no events or findings', async () => {
      mockDb._setSelectResults([[], []]);
      const res = await app.request('/api/agents/team/risk-score', { headers: org }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.agentScore).toBe(100);
      expect(body.data.cspmScore).toBe(100);
      expect(body.data.combined).toBe(100);
      expect(body.data.grade).toBe('A');
    });
  });
});
