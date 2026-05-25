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
vi.mock('../services/slo-monitor.js', () => ({
  getSloTier: vi.fn((slug: string) => (slug === 'aws' ? 'cloud-security' : 'identity')),
  computeSloStatus: vi.fn(() => ({ tier: 'cloud-security', latencyOk: true, availabilityOk: true, breachAlertOk: true, compliance: 98, breached: false })),
  checkSloBreaches: vi.fn(async () => []),
}));
vi.stubGlobal('fetch', mockAuthFetch());
import { sloRoutes } from './slo-dashboard.js';

describe('SLO Dashboard Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockEnv: Env;
  const auth = { Authorization: 'Bearer valid-token' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    vi.stubGlobal('fetch', mockAuthFetch());
    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api/integrations/slo', sloRoutes);
  });

  // ── GET / ────────────────────────────────────────────────────────────
  describe('GET /api/integrations/slo', () => {
    it('returns SLO status for all integrations', async () => {
      mockDb._setSelectResults([[]]);
      const res = await app.request('/api/integrations/slo', { headers: auth }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toHaveProperty('integrations');
      expect(body).toHaveProperty('summary');
      expect(body).toHaveProperty('breaches');
      expect(Array.isArray(body.integrations)).toBe(true);
      expect(Array.isArray(body.breaches)).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await app.request('/api/integrations/slo', {}, mockEnv);
      expect(res.status).toBe(401);
    });

    it('summary has required fields', async () => {
      mockDb._setSelectResults([[]]);
      const res = await app.request('/api/integrations/slo', { headers: auth }, mockEnv);
      const body = (await res.json()) as any;
      const summary = body.summary;
      expect(summary).toHaveProperty('total');
      expect(summary).toHaveProperty('withSlo');
      expect(summary).toHaveProperty('breached');
      expect(summary).toHaveProperty('complianceAvg');
      expect(typeof summary.total).toBe('number');
      expect(typeof summary.withSlo).toBe('number');
      expect(typeof summary.breached).toBe('number');
      expect(typeof summary.complianceAvg).toBe('number');
    });

    it('integrations have required fields', async () => {
      const mockConnections = [
        {
          id: 'conn1',
          slug: 'aws',
          status: 'active',
          avgLatencyMs: 150,
          eventsReceived: 1000,
          errorCount: 5,
          lastSyncAt: new Date().toISOString(),
          lastErrorAt: null,
        },
      ];
      mockDb._setSelectResults([mockConnections, []]);
      const res = await app.request('/api/integrations/slo', { headers: auth }, mockEnv);
      const body = (await res.json()) as any;
      body.integrations.forEach((integration: any) => {
        expect(integration).toHaveProperty('connectionId');
        expect(integration).toHaveProperty('slug');
        expect(integration).toHaveProperty('status');
        expect(integration).toHaveProperty('tier');
        expect(integration).toHaveProperty('slo');
        expect(integration).toHaveProperty('lastSyncAt');
      });
    });

    it('returns empty integrations when no connections', async () => {
      mockDb._setSelectResults([[], []]);
      const res = await app.request('/api/integrations/slo', { headers: auth }, mockEnv);
      const body = (await res.json()) as any;
      expect(body.integrations).toEqual([]);
      expect(body.summary.total).toBe(0);
    });

    it('breaches is always an array', async () => {
      mockDb._setSelectResults([[], []]);
      const res = await app.request('/api/integrations/slo', { headers: auth }, mockEnv);
      const body = (await res.json()) as any;
      expect(Array.isArray(body.breaches)).toBe(true);
    });

    it('summary total matches integrations length', async () => {
      const mockConnections = [
        {
          id: 'conn1',
          slug: 'aws',
          status: 'active',
          avgLatencyMs: 150,
          eventsReceived: 1000,
          errorCount: 5,
          lastSyncAt: new Date().toISOString(),
          lastErrorAt: null,
        },
        {
          id: 'conn2',
          slug: 'gcp',
          status: 'active',
          avgLatencyMs: 200,
          eventsReceived: 800,
          errorCount: 2,
          lastSyncAt: new Date().toISOString(),
          lastErrorAt: null,
        },
      ];
      mockDb._setSelectResults([mockConnections, []]);
      const res = await app.request('/api/integrations/slo', { headers: auth }, mockEnv);
      const body = (await res.json()) as any;
      expect(body.summary.total).toBe(2);
      expect(body.integrations.length).toBe(2);
    });

    it('slo contains compliance and status properties', async () => {
      const mockConnections = [
        {
          id: 'conn1',
          slug: 'aws',
          status: 'active',
          avgLatencyMs: 150,
          eventsReceived: 1000,
          errorCount: 5,
          lastSyncAt: new Date().toISOString(),
          lastErrorAt: null,
        },
      ];
      mockDb._setSelectResults([mockConnections, []]);
      const res = await app.request('/api/integrations/slo', { headers: auth }, mockEnv);
      const body = (await res.json()) as any;
      const integration = body.integrations[0];
      expect(integration.slo).toHaveProperty('compliance');
      expect(integration.slo).toHaveProperty('breached');
    });

    it('complianceAvg is within valid range', async () => {
      mockDb._setSelectResults([[], []]);
      const res = await app.request('/api/integrations/slo', { headers: auth }, mockEnv);
      const body = (await res.json()) as any;
      expect(body.summary.complianceAvg).toBeGreaterThanOrEqual(0);
      expect(body.summary.complianceAvg).toBeLessThanOrEqual(100);
    });
  });
});
