/**
 * Agent Risk Trend Routes Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createMockEnv, createMockDb, mockAuthFetch } from '../test/helpers.js';

vi.mock('../lib/db.js', () => ({ createDb: vi.fn(() => (globalThis as any).__mockDb) }));
vi.stubGlobal('fetch', mockAuthFetch());

import { agentRiskTrendRoutes, teamTrendRoutes, teamUserTrendRoutes } from './agent-risk-trend.js';

describe('Agent Risk Trend Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockEnv: Env;

  const auth = { Authorization: 'Bearer valid-token' };
  const org = { ...auth, 'X-Org-Id': 'org-123' };
  const admin = { id: 'mem1', orgId: 'org-123', userId: 'user-123', role: 'admin', status: 'active' };
  const teamOrg = { id: 'org-123', plan: 'team' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    vi.stubGlobal('fetch', mockAuthFetch());
  });

  describe('validateDaysParam via endpoint', () => {
    beforeEach(() => {
      app = new Hono<{ Bindings: Env; Variables: Variables }>();
      app.route('/api/agents', agentRiskTrendRoutes);
    });

    it.each([
      ['7', 7],
      ['30', 30],
      ['90', 90],
      ['15', 30], // invalid, defaults to 30
      ['100', 30], // invalid, defaults to 30
    ])('parses days=%s to %d', async (_input, _expected) => {
      mockDb._setSelectResults([[]]); // Empty trend data

      const query = `?days=${_input}`;
      const res = await app.request(`/api/agents/risk-trend${query}`, { headers: auth }, mockEnv);

      // Should succeed with 200
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.meta.days).toBe(_expected);
    });

    it('defaults to 30 when no days provided', async () => {
      mockDb._setSelectResults([[]]);

      const res = await app.request('/api/agents/risk-trend', { headers: auth }, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.meta.days).toBe(30);
    });
  });

  describe('GET /api/agents/risk-trend', () => {
    beforeEach(() => {
      app = new Hono<{ Bindings: Env; Variables: Variables }>();
      app.route('/api/agents', agentRiskTrendRoutes);
    });

    it('should return user risk trend when not in org context', async () => {
      mockDb._setSelectResults([
        // Risk trend query
        [
          { date: '2025-03-01', agentScore: 85, cspmScore: 90, combinedScore: 87, grade: 'B' },
          { date: '2025-03-02', agentScore: 88, cspmScore: 92, combinedScore: 89, grade: 'B' },
        ],
      ]);

      const res = await app.request('/api/agents/risk-trend?days=7', { headers: auth }, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data).toHaveLength(2);
      expect(data.meta.count).toBe(2);
      expect(data.meta.days).toBe(7);
    });

    it('should return org risk trend when in org context', async () => {
      mockDb._setSelectResults([
        // Risk trend query
        [
          { date: '2025-03-01', agentScore: 75, cspmScore: 80, combinedScore: 77, grade: 'C' },
        ],
      ]);

      const res = await app.request('/api/agents/risk-trend', { headers: org }, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data).toHaveLength(1);
    });

    it('should handle empty trend data', async () => {
      mockDb._setSelectResults([[]]);

      const res = await app.request('/api/agents/risk-trend?days=30', { headers: auth }, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data).toHaveLength(0);
      expect(data.meta.count).toBe(0);
    });
  });

  describe('GET /api/agents/team/risk-trend', () => {
    beforeEach(() => {
      app = new Hono<{ Bindings: Env; Variables: Variables }>();
      app.route('/api/agents/team', teamTrendRoutes);
    });

    it('should return org-level risk trend', async () => {
      // Middleware order: db, auth, loadPlanConfig, requirePlanFeature, requirePermission, handler
      mockDb._setSelectResults([
        // loadPlanConfig - org lookup
        [teamOrg],
        // loadPlanConfig - user plan lookup (higherPlan)
        [{ plan: 'team' }],
        // requirePermission - member lookup
        [admin],
        // Handler - risk trend query
        [
          { date: '2025-03-01', agentScore: 80, cspmScore: 85, combinedScore: 82, grade: 'B' },
          { date: '2025-03-02', agentScore: 82, cspmScore: 88, combinedScore: 84, grade: 'B' },
        ],
      ]);

      const res = await app.request('/api/agents/team/risk-trend?days=7', { headers: org }, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data).toHaveLength(2);
      expect(data.meta.orgId).toBe('org-123');
      expect(data.meta.days).toBe(7);
    });

    it('should return 403 when no membership found', async () => {
      mockDb._setSelectResults([
        // loadPlanConfig - org lookup
        [teamOrg],
        // loadPlanConfig - user plan lookup (higherPlan)
        [{ plan: 'team' }],
        // requirePermission - member lookup - empty
        [],
      ]);

      const res = await app.request('/api/agents/team/risk-trend', { headers: org }, mockEnv);

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Forbidden');
    });
  });

  describe('GET /api/agents/team/:userId/risk-trend', () => {
    beforeEach(() => {
      app = new Hono<{ Bindings: Env; Variables: Variables }>();
      app.route('/api/agents/team', teamUserTrendRoutes);
    });

    it('should return specific user risk trend within org', async () => {
      mockDb._setSelectResults([
        // loadPlanConfig - org lookup
        [teamOrg],
        // loadPlanConfig - user plan lookup (higherPlan)
        [{ plan: 'team' }],
        // requirePermission - member lookup for current user
        [admin],
        // Handler - target user member check
        [{ id: 'member-2', userId: 'user-456', orgId: 'org-123', status: 'active', role: 'developer' }],
        // Handler - risk trend query
        [
          { date: '2025-03-01', agentScore: 90, cspmScore: 95, combinedScore: 92, grade: 'A' },
        ],
      ]);

      const res = await app.request('/api/agents/team/user-456/risk-trend?days=30', { headers: org }, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data).toHaveLength(1);
      expect(data.meta.userId).toBe('user-456');
      expect(data.meta.orgId).toBe('org-123');
    });

    it('should return 404 when user not found in org', async () => {
      mockDb._setSelectResults([
        // loadPlanConfig - org lookup
        [teamOrg],
        // loadPlanConfig - user plan lookup (higherPlan)
        [{ plan: 'team' }],
        // requirePermission - member lookup
        [admin],
        // Handler - target user member check - empty
        [],
      ]);

      const res = await app.request('/api/agents/team/user-999/risk-trend', { headers: org }, mockEnv);

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Not found');
    });

    it('should return 403 when current user has no membership', async () => {
      mockDb._setSelectResults([
        // loadPlanConfig - org lookup
        [teamOrg],
        // loadPlanConfig - user plan lookup (higherPlan)
        [{ plan: 'team' }],
        // requirePermission - member lookup - empty
        [],
      ]);

      const res = await app.request('/api/agents/team/user-456/risk-trend', { headers: org }, mockEnv);

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Forbidden');
    });

    it('should validate days parameter', async () => {
      // Test valid days
      for (const days of [7, 30, 90]) {
        mockDb._setSelectResults([
          // loadPlanConfig - org lookup
          [teamOrg],
          // loadPlanConfig - user plan lookup (higherPlan)
          [{ plan: 'team' }],
          // requirePermission
          [admin],
          // Handler - target user member check
          [{ id: 'member-2', userId: 'user-456', orgId: 'org-123', status: 'active', role: 'developer' }],
          // Handler - risk trend query
          [],
        ]);

        const res = await app.request(`/api/agents/team/user-456/risk-trend?days=${days}`, { headers: org }, mockEnv);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.meta.days).toBe(days);
      }
    });
  });
});
