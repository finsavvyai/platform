import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env, Variables } from '../types.js';
import { createMockEnv, createMockDb, mockAuthFetch } from '../test/helpers.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as any).__mockDb),
}));
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
    c.set('orgId', c.req.header('X-Org-Id') ?? null);
    await next();
  },
  requirePermission: () => async (_c: any, next: any) => { await next(); },
}));

vi.stubGlobal('fetch', mockAuthFetch('user_test123'));

import { complianceRoutes } from './compliance.js';
import { Hono } from 'hono';

describe('Compliance Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockEnv: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  const authHeaders = { Authorization: 'Bearer valid-token' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    vi.stubGlobal('fetch', mockAuthFetch('user_test123'));

    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api/security', complianceRoutes);
  });

  it('returns 401 without auth', async () => {
    const res = await app.request('/api/security/instances/inst_1/compliance-reports', {}, mockEnv);
    expect(res.status).toBe(401);
  });

  // ─── GET /instances/:instanceId/compliance-reports ──────────────────────────

  describe('GET /instances/:instanceId/compliance-reports', () => {
    it('returns 404 when instance not found', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request(
        '/api/security/instances/inst_1/compliance-reports',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.error).toBe('Not found');
    });

    it('returns empty reports list when no reports exist', async () => {
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123' }], // instance found
        [], // no reports
      ]);
      const res = await app.request(
        '/api/security/instances/inst_1/compliance-reports',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.reports).toEqual([]);
    });

    it('returns reports list ordered by generatedAt', async () => {
      const reports = [
        { id: 'rpt_1', instanceId: 'inst_1', framework: 'soc2', overallScore: 80, totalControls: 20, passingControls: 16, failingControls: 4, results: '[]', generatedAt: '2026-02-24T12:00:00Z' },
        { id: 'rpt_2', instanceId: 'inst_1', framework: 'iso27001', overallScore: 60, totalControls: 15, passingControls: 9, failingControls: 6, results: '[]', generatedAt: '2026-02-23T12:00:00Z' },
      ];
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123' }],
        reports,
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/compliance-reports',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.reports).toHaveLength(2);
      expect(body.reports[0].id).toBe('rpt_1');
      expect(body.reports[1].framework).toBe('iso27001');
    });
  });

  // ─── POST /instances/:instanceId/compliance-reports ─────────────────────────

  describe('POST /instances/:instanceId/compliance-reports', () => {
    // evaluateCompliance does 11 db.select() calls internally:
    // policies, rules, openAlerts, baselines, vulns, recentEvents,
    // recentAudit, openIncidents, resolvedIncidents, scoreHistory, instance
    const emptyEvalResults = (): unknown[][] => [
      [], // policies
      [], // alert rules
      [], // open alerts
      [], // baselines
      [], // vulns
      [], // recent events
      [], // recent audit
      [], // open incidents (then .filter)
      [], // resolved incidents (then .filter)
      [], // score history
      [{ id: 'inst_1', gatewayTokenEncrypted: null, agentVersion: null }], // instance
    ];

    it('returns 404 when instance not found', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request(
        '/api/security/instances/inst_1/compliance-reports',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ framework: 'soc2' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid framework', async () => {
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123' }],
      ]);
      const res = await app.request(
        '/api/security/instances/inst_1/compliance-reports',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ framework: 'pci-dss' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.details).toContain('Invalid enum value');
    });

    it('returns 400 when framework is missing', async () => {
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123' }],
      ]);
      const res = await app.request(
        '/api/security/instances/inst_1/compliance-reports',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
    });

    it('generates a SOC2 compliance report', async () => {
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123' }], // instance check in route
        ...emptyEvalResults(),
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/compliance-reports',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ framework: 'soc2' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.report).toBeDefined();
      expect(body.report.framework).toBe('soc2');
      expect(body.report.totalControls).toBe(20); // SOC2 has 20 controls
      expect(body.report.results).toBeInstanceOf(Array);
      expect(body.report.results.length).toBe(20);
      expect(body.report.overallScore).toBeGreaterThanOrEqual(0);
      expect(body.report.overallScore).toBeLessThanOrEqual(100);
      // Insert should be called
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('generates an ISO27001 compliance report', async () => {
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123' }],
        ...emptyEvalResults(),
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/compliance-reports',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ framework: 'iso27001' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.report.framework).toBe('iso27001');
      expect(body.report.totalControls).toBe(15); // ISO27001 has 15 controls
    });

    it('generates a CIS compliance report', async () => {
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123' }],
        ...emptyEvalResults(),
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/compliance-reports',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ framework: 'cis' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.report.framework).toBe('cis');
      expect(body.report.totalControls).toBe(15); // CIS has 15 controls
    });

    it('counts passing and failing controls correctly', async () => {
      // With all empty data and no gateway token/agent version, most controls fail
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123' }],
        ...emptyEvalResults(),
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/compliance-reports',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ framework: 'soc2' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.report.passingControls + body.report.failingControls).toBe(body.report.totalControls);
    });
  });

  // ─── GET /instances/:instanceId/compliance-reports/:reportId ────────────────

  describe('GET /instances/:instanceId/compliance-reports/:reportId', () => {
    it('returns 404 when instance not found', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request(
        '/api/security/instances/inst_1/compliance-reports/rpt_1',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(404);
    });

    it('returns 404 when report not found', async () => {
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123' }], // instance exists
        [], // report not found
      ]);
      const res = await app.request(
        '/api/security/instances/inst_1/compliance-reports/rpt_unknown',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Report not found');
    });

    it('returns report detail with parsed results', async () => {
      const mockResults = [
        { controlId: 'soc2-cc1.1', name: 'Security Policy Documentation', category: 'Common Criteria', status: 'pass', evidence: 'Active security policies configured' },
        { controlId: 'soc2-cc3.1', name: 'Risk Assessment', category: 'Risk Assessment', status: 'fail', evidence: '3 open vulnerabilities, score history unavailable' },
      ];
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123' }],
        [{
          id: 'rpt_1',
          instanceId: 'inst_1',
          framework: 'soc2',
          overallScore: 50,
          totalControls: 2,
          passingControls: 1,
          failingControls: 1,
          results: JSON.stringify(mockResults),
          generatedAt: '2026-02-24T12:00:00Z',
        }],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/compliance-reports/rpt_1',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.report).toBeDefined();
      expect(body.report.id).toBe('rpt_1');
      expect(body.report.framework).toBe('soc2');
      expect(body.report.overallScore).toBe(50);
      // Results should be parsed from JSON string into an array
      expect(body.report.results).toBeInstanceOf(Array);
      expect(body.report.results).toHaveLength(2);
      expect(body.report.results[0].controlId).toBe('soc2-cc1.1');
      expect(body.report.results[0].status).toBe('pass');
      expect(body.report.results[1].status).toBe('fail');
    });
  });
});
