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
  resolveOrgContextAutoDetect: async (c: any, next: any) => { await next(); },
  requirePermission: () => async (c: any, next: any) => {
    const orgId = c.req.header('X-Org-Id') ?? null;
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
vi.mock('../../services/oasf/index.js', () => ({
  runAssessment: vi.fn(async () => ({
    assessmentId: 'a-1', overallScore: 73, grade: 'C',
    passingCount: 11, failingCount: 3, partialCount: 1, totalControls: 15,
    controls: [{ controlId: 'OASF-01', status: 'pass', evidenceSummary: 'ok' }],
  })),
  getAssessmentHistory: vi.fn(async () => [
    { id: 'a-1', overallScore: 73, grade: 'C', createdAt: '2026-03-07' },
  ]),
  getAssessmentDetail: vi.fn(async (db: any, id: string) => {
    if (id === 'missing') return null;
    return { id: 'a-1', overallScore: 73, results: [] };
  }),
}));
vi.stubGlobal('fetch', mockAuthFetch());

import { oasfComplianceRoutes } from './index.js';

describe('OASF Compliance Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockEnv: Env;

  const auth = { Authorization: 'Bearer tok' };
  const org = { ...auth, 'X-Org-Id': 'org_test' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    const mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    vi.stubGlobal('fetch', mockAuthFetch());
    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api/oasf', oasfComplianceRoutes);
  });

  it('returns 401 without auth', async () => {
    const res = await app.request('/api/oasf/assessments', {}, mockEnv);
    expect(res.status).toBe(401);
  });

  describe('POST /api/oasf/assess', () => {
    it('runs full assessment and returns 201', async () => {
      const res = await app.request('/api/oasf/assess', {
        method: 'POST', headers: org,
      }, mockEnv);
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.data.overallScore).toBe(73);
      expect(body.data.grade).toBe('C');
    });

    it('returns 400 without orgId', async () => {
      const res = await app.request('/api/oasf/assess', {
        method: 'POST', headers: auth,
      }, mockEnv);
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/oasf/assessments', () => {
    it('runs assessment and returns 201 (alias)', async () => {
      const res = await app.request('/api/oasf/assessments', {
        method: 'POST', headers: org,
      }, mockEnv);
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.data.overallScore).toBe(73);
      expect(body.data.grade).toBe('C');
    });

    it('returns 400 without orgId', async () => {
      const res = await app.request('/api/oasf/assessments', {
        method: 'POST', headers: auth,
      }, mockEnv);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/oasf/assessments', () => {
    it('lists assessment history', async () => {
      const res = await app.request('/api/oasf/assessments', { headers: org }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(1);
    });

    it('returns empty without orgId', async () => {
      const res = await app.request('/api/oasf/assessments', { headers: auth }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toEqual([]);
    });
  });

  describe('GET /api/oasf/assessments/:id', () => {
    it('returns assessment detail', async () => {
      const res = await app.request('/api/oasf/assessments/a-1', { headers: org }, mockEnv);
      expect(res.status).toBe(200);
    });

    it('returns 404 for missing assessment', async () => {
      const res = await app.request('/api/oasf/assessments/missing', { headers: org }, mockEnv);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/oasf/controls', () => {
    it('returns 15 OASF controls', async () => {
      const res = await app.request('/api/oasf/controls', { headers: auth }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(15);
      expect(body.data[0].id).toBe('OASF-01');
    });
  });

  describe('GET /api/oasf/framework-mapping', () => {
    it('returns mapping table', async () => {
      const res = await app.request('/api/oasf/framework-mapping', { headers: auth }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(15);
      expect(body.data[0].soc2).toBeDefined();
      expect(body.data[0].iso27001).toBeDefined();
      expect(body.data[0].nistCsf).toBeDefined();
    });
  });
});
