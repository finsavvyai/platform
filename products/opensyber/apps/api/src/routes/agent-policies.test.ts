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
  resolveOrgContextAutoDetect: async (c: any, next: any) => {
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
      config: { policyEngine: true },
      isOrg: Boolean(c.req.header('X-Org-Id')),
    });
    await next();
  },
  requirePlanFeature: () => async (_c: any, next: any) => {
    await next();
  },
}));
vi.stubGlobal('fetch', mockAuthFetch());
import { agentPolicyRoutes } from './agent-policies.js';

describe('Agent Policy Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockEnv: Env;
  const auth = { Authorization: 'Bearer valid-token' };
  const org = { ...auth, 'X-Org-Id': 'org_test' };
  const jsonOrg = { ...org, 'Content-Type': 'application/json' };
  const viewerOrg = { ...jsonOrg, 'X-Test-Role': 'viewer' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    vi.stubGlobal('fetch', mockAuthFetch());
    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api/agents', agentPolicyRoutes);
  });

  it('returns 401 without auth', async () => {
    const res = await app.request('/api/agents/policies', {}, mockEnv);
    expect(res.status).toBe(401);
  });

  // ── GET /policies ─────────────────────────────────────────────────
  describe('GET /api/agents/policies', () => {
    it('returns org policies', async () => {
      mockDb._setSelectResults([[{ id: 'p1' }, { id: 'p2' }]]);
      const res = await app.request('/api/agents/policies', { headers: org }, mockEnv);
      expect(res.status).toBe(200);
      expect(((await res.json()) as any).data).toHaveLength(2);
    });
    it('returns 400 without org context', async () => {
      const res = await app.request('/api/agents/policies', { headers: auth }, mockEnv);
      expect(res.status).toBe(400);
    });
    it('returns empty array when no policies', async () => {
      mockDb._setSelectResults([[]]);
      const res = await app.request('/api/agents/policies', { headers: org }, mockEnv);
      expect(((await res.json()) as any).data).toEqual([]);
    });
  });

  // ── POST /policies ────────────────────────────────────────────────
  describe('POST /api/agents/policies', () => {
    const valid = { name: 'Block', ruleType: 'command_pattern', ruleConfig: '{"p":"x"}', severity: 'critical' };

    it('creates with valid data, returns 201', async () => {
      mockDb._setSelectResults([[{ id: 'p_new', name: 'Block' }]]);
      const res = await app.request('/api/agents/policies', {
        method: 'POST', headers: jsonOrg, body: JSON.stringify(valid),
      }, mockEnv);
      expect(res.status).toBe(201);
      expect(((await res.json()) as any).data.name).toBe('Block');
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });
    it('rejects invalid ruleType', async () => {
      const res = await app.request('/api/agents/policies', {
        method: 'POST', headers: jsonOrg,
        body: JSON.stringify({ ...valid, ruleType: 'bad' }),
      }, mockEnv);
      expect(res.status).toBe(400);
      expect(((await res.json()) as any).message).toContain('Invalid enum value');
    });
    it('accepts all valid ruleType values', async () => {
      for (const rt of ['file_pattern', 'command_pattern', 'risk_threshold', 'secrets_threshold']) {
        vi.clearAllMocks(); mockDb = createMockDb(); (globalThis as any).__mockDb = mockDb;
        vi.stubGlobal('fetch', mockAuthFetch());
        mockDb._setSelectResults([[{ id: 'p', ruleType: rt }]]);
        const res = await app.request('/api/agents/policies', {
          method: 'POST', headers: jsonOrg, body: JSON.stringify({ ...valid, ruleType: rt }),
        }, mockEnv);
        expect(res.status).toBe(201);
      }
    });
    it('accepts ruleConfig as any string (Zod allows string union)', async () => {
      mockDb._setSelectResults([[{ id: 'p_new', name: 'Block', ruleConfig: '{bad' }]]);
      const res = await app.request('/api/agents/policies', {
        method: 'POST', headers: jsonOrg, body: JSON.stringify({ ...valid, ruleConfig: '{bad' }),
      }, mockEnv);
      // Zod schema uses z.union([z.string(), z.record(), z.array()]) — any string passes
      expect(res.status).toBe(201);
    });
    it('returns 403 for viewer (lacks agent.policy.write)', async () => {
      const res = await app.request('/api/agents/policies', {
        method: 'POST', headers: viewerOrg, body: JSON.stringify(valid),
      }, mockEnv);
      expect(res.status).toBe(403);
    });
    it('validates name required', async () => {
      const res = await app.request('/api/agents/policies', {
        method: 'POST', headers: jsonOrg,
        body: JSON.stringify({ ruleType: 'file_pattern', ruleConfig: '{}' }),
      }, mockEnv);
      expect(res.status).toBe(400);
      expect(((await res.json()) as any).message).toBe('Required');
    });
    it('defaults severity to high', async () => {
      mockDb._setSelectResults([[{ id: 'p', severity: 'high' }]]);
      const res = await app.request('/api/agents/policies', {
        method: 'POST', headers: jsonOrg,
        body: JSON.stringify({ name: 'T', ruleType: 'file_pattern', ruleConfig: '{}' }),
      }, mockEnv);
      expect(res.status).toBe(201);
    });
  });

  // ── PATCH /policies/:id ───────────────────────────────────────────
  describe('PATCH /api/agents/policies/:id', () => {
    const existing = { id: 'p1', orgId: 'org_test', name: 'Old', severity: 'high', isActive: true };

    it('updates name, severity, and isActive', async () => {
      mockDb._setSelectResults([[existing],
        [{ ...existing, name: 'New', severity: 'critical', isActive: false }]]);
      const res = await app.request('/api/agents/policies/p1', {
        method: 'PATCH', headers: jsonOrg,
        body: JSON.stringify({ name: 'New', severity: 'critical', isActive: false }),
      }, mockEnv);
      expect(res.status).toBe(200);
      const d = ((await res.json()) as any).data;
      expect(d.name).toBe('New');
      expect(d.severity).toBe('critical');
      expect(d.isActive).toBe(false);
    });
    it('returns 404 for non-existent', async () => {
      mockDb._setSelectResults([[]]);
      const res = await app.request('/api/agents/policies/p_x', {
        method: 'PATCH', headers: jsonOrg, body: JSON.stringify({ name: 'Up' }),
      }, mockEnv);
      expect(res.status).toBe(404);
    });
    it('accepts ruleConfig string in PATCH (Zod string union)', async () => {
      mockDb._setSelectResults([[existing],
        [{ ...existing, ruleConfig: 'bad{' }]]);
      const res = await app.request('/api/agents/policies/p1', {
        method: 'PATCH', headers: jsonOrg, body: JSON.stringify({ ruleConfig: 'bad{' }),
      }, mockEnv);
      // Zod schema uses z.union([z.string(), z.record(), z.array()]) — any string passes
      expect(res.status).toBe(200);
    });
  });

  // ── DELETE /policies/:id ──────────────────────────────────────────
  describe('DELETE /api/agents/policies/:id', () => {
    it('removes policy', async () => {
      mockDb._setSelectResults([[{ id: 'p1', orgId: 'org_test' }]]);
      const res = await app.request('/api/agents/policies/p1', { method: 'DELETE', headers: org }, mockEnv);
      expect(res.status).toBe(200);
      expect(((await res.json()) as any).data.deleted).toBe(true);
    });
    it('returns 403 for viewer', async () => {
      const res = await app.request('/api/agents/policies/p1', { method: 'DELETE', headers: viewerOrg }, mockEnv);
      expect(res.status).toBe(403);
    });
    it('returns 404 for non-existent', async () => {
      mockDb._setSelectResults([[]]);
      const res = await app.request('/api/agents/policies/p_x', { method: 'DELETE', headers: org }, mockEnv);
      expect(res.status).toBe(404);
    });
  });

  // ── GET /policies/:id/violations ──────────────────────────────────
  describe('GET /api/agents/policies/:id/violations', () => {
    it('returns violations list', async () => {
      mockDb._setSelectResults([[{ id: 'p1', orgId: 'org_test' }],
        [{ id: 'v1', policyId: 'p1', detail: 'matched rm -rf' }]]);
      const res = await app.request('/api/agents/policies/p1/violations', { headers: org }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(1);
      expect(body.hasMore).toBe(false);
    });
    it('returns 404 when policy not found', async () => {
      mockDb._setSelectResults([[]]);
      const res = await app.request('/api/agents/policies/p_x/violations', { headers: org }, mockEnv);
      expect(res.status).toBe(404);
    });
    it('returns empty when no violations', async () => {
      mockDb._setSelectResults([[{ id: 'p1', orgId: 'org_test' }], []]);
      const res = await app.request('/api/agents/policies/p1/violations', { headers: org }, mockEnv);
      expect(((await res.json()) as any).data).toEqual([]);
    });
  });
});
