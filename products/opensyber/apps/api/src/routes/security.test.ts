import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env, Variables } from '../types.js';
import { createMockEnv, createMockDb, mockAuthFetch } from '../test/helpers.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as any).__mockDb),
}));

vi.stubGlobal('fetch', mockAuthFetch('user_test123'));

import { securityDashboardRoutes } from './security-dashboard.js';
import { securityNetworkRoutes } from './security-network.js';
import { securityVulnRoutes } from './security-vulns.js';
import { gatewaySecurityRoutes } from './security-gateway.js';
import { gatewaySecurityInfraRoutes } from './security-gateway-infra.js';
import { Hono } from 'hono';

describe('Security Routes', () => {
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
    app.route('/api/security', securityDashboardRoutes);
    app.route('/api/security', securityNetworkRoutes);
    app.route('/api/security', securityVulnRoutes);
    app.route('/api/agent/security', gatewaySecurityRoutes);
    app.route('/api/agent/security', gatewaySecurityInfraRoutes);
  });

  it('returns 401 without auth', async () => {
    const res = await app.request('/api/security/instances/inst_1/dashboard', {}, mockEnv);
    expect(res.status).toBe(401);
  });

  describe('GET /api/security/instances/:instanceId/dashboard', () => {
    it('returns 404 when instance not found', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request(
        '/api/security/instances/inst_1/dashboard',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(404);
    });

    it('returns dashboard with 7 categories and extended data', async () => {
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123', lastHealthCheck: new Date().toISOString(), gatewayTokenEncrypted: 'enc', agentVersion: '1.0' }],
        [], // events
        [], // installations
        [{ id: 'pol_1' }], // active policies
        [{ id: 'rule_1' }], // active alert rules
        [], // open alerts
        [], // open incidents (then filtered)
        [{ id: 'fb_1' }], // file baselines
        [], // open vulnerabilities
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/dashboard',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.dashboard.score.categories).toHaveProperty('credentialSecurity');
      expect(body.dashboard.score.categories).toHaveProperty('skillSafety');
      expect(body.dashboard.score.categories).toHaveProperty('networkSecurity');
      expect(body.dashboard.score.categories).toHaveProperty('updateStatus');
      expect(body.dashboard.score.categories).toHaveProperty('configurationHardening');
      expect(body.dashboard.score.categories).toHaveProperty('vulnerabilityManagement');
      expect(body.dashboard.score.categories).toHaveProperty('incidentReadiness');
      expect(body.dashboard.openAlerts).toBeDefined();
      expect(body.dashboard.openIncidents).toBeDefined();
      expect(body.dashboard.vulnerabilitySummary).toBeDefined();
      expect(body.dashboard.installedSkills).toBeDefined();
    });

    it('deducts score for unverified skills', async () => {
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123', lastHealthCheck: new Date().toISOString(), gatewayTokenEncrypted: 'enc', agentVersion: '1.0' }],
        [],
        [
          { installation: { id: 'si_1' }, skill: { verificationStatus: 'approved' } },
          { installation: { id: 'si_2' }, skill: { verificationStatus: 'pending' } },
          { installation: { id: 'si_3' }, skill: { verificationStatus: 'revoked' } },
        ],
        [{ id: 'pol_1' }], [], [], [], [{ id: 'fb_1' }], [], // extended data
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/dashboard',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.dashboard.installedSkills.verified).toBe(1);
      expect(body.dashboard.installedSkills.unverified).toBe(1);
      expect(body.dashboard.installedSkills.blocked).toBe(1);
      expect(body.dashboard.score.categories.skillSafety).toBeLessThan(100);
      expect(body.dashboard.score.recommendations.length).toBeGreaterThan(0);
    });

    it('deducts score for recent critical events', async () => {
      const recentTime = new Date().toISOString();
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123', lastHealthCheck: new Date().toISOString(), gatewayTokenEncrypted: 'enc', agentVersion: '1.0' }],
        [
          { id: 'ev1', severity: 'critical', eventType: 'credential_access', createdAt: recentTime },
          { id: 'ev2', severity: 'critical', eventType: 'credential_access', createdAt: recentTime },
        ],
        [],
        [{ id: 'pol_1' }], [{ id: 'rule_1' }], [], [], [{ id: 'fb_1' }], [], // extended
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/dashboard',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.dashboard.score.categories.credentialSecurity).toBeLessThan(100);
    });

    it('deducts score for overdue health check', async () => {
      const oldTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123', lastHealthCheck: oldTime, gatewayTokenEncrypted: 'enc', agentVersion: '1.0' }],
        [],
        [],
        [{ id: 'pol_1' }], [{ id: 'rule_1' }], [], [], [{ id: 'fb_1' }], [],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/dashboard',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.dashboard.score.categories.updateStatus).toBeLessThan(100);
      expect(body.dashboard.score.recommendations).toContain('Instance health check is overdue.');
    });

    it('deducts score for missing gateway token and agent version', async () => {
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123', lastHealthCheck: new Date().toISOString(), gatewayTokenEncrypted: null, agentVersion: null }],
        [],
        [],
        [{ id: 'pol_1' }], [{ id: 'rule_1' }], [], [], [{ id: 'fb_1' }], [],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/dashboard',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.dashboard.score.categories.credentialSecurity).toBeLessThan(100);
      expect(body.dashboard.score.categories.updateStatus).toBeLessThan(100);
    });

    it('clamps score at zero when many issues exist', async () => {
      const recentTime = new Date().toISOString();
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123', lastHealthCheck: null, gatewayTokenEncrypted: null, agentVersion: null }],
        Array.from({ length: 10 }, (_, i) => ({ id: `ev${i}`, severity: 'critical', eventType: 'credential_access', createdAt: recentTime })),
        Array.from({ length: 5 }, (_, i) => ({ installation: { id: `si${i}` }, skill: { verificationStatus: 'pending' } })),
        [], [], [{ id: 'a1' }, { id: 'a2' }], [{ status: 'open' }, { status: 'investigating' }], [],
        [{ severity: 'critical' }, { severity: 'critical' }, { severity: 'high' }], // vulns
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/dashboard',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.dashboard.score.overall).toBeLessThanOrEqual(30);
    });

    it('limits recent events to 20 in response', async () => {
      const recentTime = new Date().toISOString();
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123', lastHealthCheck: new Date().toISOString(), gatewayTokenEncrypted: 'enc', agentVersion: '1.0' }],
        Array.from({ length: 30 }, (_, i) => ({ id: `ev${i}`, severity: 'info', createdAt: recentTime })),
        [],
        [{ id: 'pol_1' }], [{ id: 'rule_1' }], [], [], [{ id: 'fb_1' }], [],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/dashboard',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.dashboard.recentEvents).toHaveLength(20);
    });

    it('includes vulnerability summary in dashboard', async () => {
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123', lastHealthCheck: new Date().toISOString(), gatewayTokenEncrypted: 'enc', agentVersion: '1.0' }],
        [], [],
        [{ id: 'pol_1' }], [{ id: 'rule_1' }], [], [], [{ id: 'fb_1' }],
        [{ severity: 'critical' }, { severity: 'high' }, { severity: 'medium' }, { severity: 'low' }],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/dashboard',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.dashboard.vulnerabilitySummary.critical).toBe(1);
      expect(body.dashboard.vulnerabilitySummary.high).toBe(1);
      expect(body.dashboard.vulnerabilitySummary.medium).toBe(1);
      expect(body.dashboard.vulnerabilitySummary.low).toBe(1);
    });
  });

  describe('GET /api/security/instances/:instanceId/events', () => {
    it('returns 404 when instance not found', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request(
        '/api/security/instances/inst_1/events',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(404);
    });

    it('returns events list', async () => {
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123' }],
        [{ id: 'ev1', eventType: 'skill_installed', severity: 'info' }],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/events',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.events).toBeDefined();
    });
  });

  describe('GET /api/security/instances/:instanceId/audit', () => {
    it('returns 404 when instance not found', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request(
        '/api/security/instances/inst_1/audit',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(404);
    });

    it('returns audit log', async () => {
      mockDb._setSelectResults([
        [{ id: 'inst_1', userId: 'user_test123' }],
        [{ id: 'log1', action: 'shell_exec' }],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/audit',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.auditLog).toBeDefined();
    });
  });

  // ─── Gateway-auth routes (agent-facing) ─────────────────────────────
  describe('POST /api/agent/security/instances/:instanceId/events (gateway auth)', () => {
    const gatewayHeaders = {
      'Content-Type': 'application/json',
      'X-Gateway-Token': 'gw-token-123',
      'X-Instance-Id': 'inst_1',
    };

    beforeEach(async () => {
      // Pre-store gateway token
      await mockEnv.CREDENTIAL_VAULT.put('gateway:inst_1', 'gw-token-123');
    });

    it('ingests security events with skillId and details', async () => {
      const payload = {
        events: [
          { eventType: 'skill_blocked', severity: 'warning', details: '{"reason":"unverified"}' },
          { eventType: 'anomaly_detected', severity: 'critical', skillId: 'sk_1' },
        ],
      };

      const res = await app.request(
        '/api/agent/security/instances/inst_1/events',
        {
          method: 'POST',
          headers: gatewayHeaders,
          body: JSON.stringify(payload),
        },
        mockEnv,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.received).toBe(2);
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });

    it('ingests events without optional fields', async () => {
      const payload = {
        events: [
          { eventType: 'login_attempt', severity: 'info' },
        ],
      };

      const res = await app.request(
        '/api/agent/security/instances/inst_1/events',
        {
          method: 'POST',
          headers: gatewayHeaders,
          body: JSON.stringify(payload),
        },
        mockEnv,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.received).toBe(1);
    });

    it('returns 401 without gateway token', async () => {
      const res = await app.request(
        '/api/agent/security/instances/inst_1/events',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: [] }),
        },
        mockEnv,
      );
      expect(res.status).toBe(401);
    });

    it('returns 403 when instance ID does not match header', async () => {
      const res = await app.request(
        '/api/agent/security/instances/inst_other/events',
        {
          method: 'POST',
          headers: gatewayHeaders, // X-Instance-Id is inst_1 but path is inst_other
          body: JSON.stringify({ events: [{ eventType: 'test', severity: 'info' }] }),
        },
        mockEnv,
      );
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/agent/security/instances/:instanceId/audit (gateway auth)', () => {
    const gatewayHeaders = {
      'Content-Type': 'application/json',
      'X-Gateway-Token': 'gw-token-123',
      'X-Instance-Id': 'inst_1',
    };

    beforeEach(async () => {
      await mockEnv.CREDENTIAL_VAULT.put('gateway:inst_1', 'gw-token-123');
    });

    it('ingests audit log entries', async () => {
      const payload = {
        entries: [
          { action: 'shell_exec', details: '{"cmd":"ls"}' },
          { action: 'file_read', skillId: 'sk_1' },
        ],
      };

      const res = await app.request(
        '/api/agent/security/instances/inst_1/audit',
        {
          method: 'POST',
          headers: gatewayHeaders,
          body: JSON.stringify(payload),
        },
        mockEnv,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.received).toBe(2);
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });

    it('returns 401 without gateway token', async () => {
      const res = await app.request(
        '/api/agent/security/instances/inst_1/audit',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries: [] }),
        },
        mockEnv,
      );
      expect(res.status).toBe(401);
    });
  });
});
