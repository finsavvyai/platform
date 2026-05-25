import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createMockEnv, createMockDb, mockAuthFetch } from '../test/helpers.js';

vi.mock('../lib/db.js', () => ({ createDb: vi.fn(() => (globalThis as any).__mockDb) }));
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (c: any, next: any) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
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
vi.mock('../services/eu-ai-act.js', () => ({
  classifyAiRisk: vi.fn(),
  exportAuditTrail: vi.fn(async () => []),
  mapToNistAiRmf: vi.fn(() => ({ nistFunction: 'GOVERN', controls: ['C1'] })),
  AI_RISK_CATEGORIES: ['limited', 'medium', 'high-risk', 'prohibited'],
  NIST_AI_RMF_FUNCTIONS: ['GOVERN', 'MAP', 'MEASURE', 'MANAGE'],
}));
vi.stubGlobal('fetch', mockAuthFetch());
import { complianceAiRoutes } from './compliance-ai.js';

describe('Compliance AI Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockEnv: Env;
  const auth = { Authorization: 'Bearer valid-token' };
  const org = { ...auth, 'X-Org-Id': 'org_test' };
  const json = { ...auth, 'Content-Type': 'application/json' };
  const jsonOrg = { ...org, 'Content-Type': 'application/json' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    vi.stubGlobal('fetch', mockAuthFetch());
    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api/compliance-ai', complianceAiRoutes);
  });

  describe('GET /api/compliance-ai/risk-classification', () => {
    it('returns AI systems with risk levels', async () => {
      const res = await app.request('/api/compliance-ai/risk-classification', {
        headers: auth,
      }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('returns systems with required fields', async () => {
      const res = await app.request('/api/compliance-ai/risk-classification', {
        headers: auth,
      }, mockEnv);
      const body = (await res.json()) as any;
      body.data.forEach((system: any) => {
        expect(system).toHaveProperty('id');
        expect(system).toHaveProperty('name');
        expect(system).toHaveProperty('riskLevel');
        expect(system).toHaveProperty('riskScore');
        expect(system.riskScore).toBeGreaterThanOrEqual(0);
        expect(system.riskScore).toBeLessThanOrEqual(100);
      });
    });

    it('returns 401 without auth', async () => {
      const res = await app.request('/api/compliance-ai/risk-classification', {}, mockEnv);
      expect(res.status).toBe(401);
    });

    it('includes risk categories in response', async () => {
      const res = await app.request('/api/compliance-ai/risk-classification', {
        headers: auth,
      }, mockEnv);
      const body = (await res.json()) as any;
      expect(body.riskCategories).toBeDefined();
      expect(Array.isArray(body.riskCategories)).toBe(true);
    });
  });

  describe('GET /api/compliance-ai/audit-trail', () => {
    it('returns audit trail for date range', async () => {
      const from = '2026-01-01';
      const to = '2026-03-20';
      mockDb._setSelectResult([]);
      const res = await app.request(
        `/api/compliance-ai/audit-trail?from=${from}&to=${to}`,
        { headers: auth },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('returns 400 without from parameter', async () => {
      const to = '2026-03-20';
      const res = await app.request(
        `/api/compliance-ai/audit-trail?to=${to}`,
        { headers: auth },
        mockEnv,
      );
      expect(res.status).toBe(400);
    });

    it('returns 400 without to parameter', async () => {
      const from = '2026-01-01';
      const res = await app.request(
        `/api/compliance-ai/audit-trail?from=${from}`,
        { headers: auth },
        mockEnv,
      );
      expect(res.status).toBe(400);
    });

    it('returns 400 with invalid date format', async () => {
      const res = await app.request(
        '/api/compliance-ai/audit-trail?from=invalid&to=invalid',
        { headers: auth },
        mockEnv,
      );
      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await app.request(
        '/api/compliance-ai/audit-trail?from=2026-01-01&to=2026-03-20',
        {},
        mockEnv,
      );
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/compliance-ai/nist-mapping', () => {
    it('returns NIST mapping for findings', async () => {
      const res = await app.request(
        '/api/compliance-ai/nist-mapping',
        { headers: auth },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(Array.isArray(body.data)).toBe(true);
      expect(Array.isArray(body.nistFunctions)).toBe(true);
    });

    it('mappings have required fields', async () => {
      const res = await app.request(
        '/api/compliance-ai/nist-mapping',
        { headers: auth },
        mockEnv,
      );
      const body = (await res.json()) as any;
      body.data.forEach((mapping: any) => {
        expect(mapping).toHaveProperty('finding');
        expect(mapping).toHaveProperty('nistFunction');
        expect(mapping).toHaveProperty('controls');
        expect(Array.isArray(mapping.controls)).toBe(true);
      });
    });

    it('returns 401 without auth', async () => {
      const res = await app.request('/api/compliance-ai/nist-mapping', {}, mockEnv);
      expect(res.status).toBe(401);
    });

    it('includes NIST functions in response', async () => {
      const res = await app.request(
        '/api/compliance-ai/nist-mapping',
        { headers: auth },
        mockEnv,
      );
      const body = (await res.json()) as any;
      expect(body.nistFunctions.length).toBeGreaterThan(0);
    });
  });
});
