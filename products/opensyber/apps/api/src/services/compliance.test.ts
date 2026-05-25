import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDb } from '../test/helpers.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as any).__mockDb),
}));

import { evaluateCompliance } from './compliance.js';

describe('evaluateCompliance', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  // evaluateCompliance performs 11 sequential db.select() calls:
  // 1. policies (active)
  // 2. alert rules (active)
  // 3. open alerts
  // 4. file baselines
  // 5. open vulnerabilities
  // 6. recent security events (30d)
  // 7. recent audit log (30d)
  // 8. open incidents (then .filter)
  // 9. resolved incidents (then .filter)
  // 10. score history
  // 11. instance
  const buildDbResults = (overrides: Partial<{
    policies: any[];
    alertRules: any[];
    openAlerts: any[];
    baselines: any[];
    vulns: any[];
    events: any[];
    audit: any[];
    incidents: any[];       // raw incidents for both open + resolved queries
    resolvedIncidents: any[];
    scoreHistory: any[];
    instance: any;
  }> = {}): unknown[][] => {
    const o = overrides;
    return [
      o.policies ?? [],
      o.alertRules ?? [],
      o.openAlerts ?? [],
      o.baselines ?? [],
      o.vulns ?? [],
      o.events ?? [],
      o.audit ?? [],
      o.incidents ?? [],          // open incidents query (filtered in code by status)
      o.resolvedIncidents ?? [],  // resolved incidents query (filtered in code by status)
      o.scoreHistory ?? [],
      o.instance ? [o.instance] : [{ id: 'inst_1', gatewayTokenEncrypted: null, agentVersion: null }],
    ];
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
  });

  // ─── SOC2 ─────────────────────────────────────────────────────────────────────

  describe('SOC2 framework', () => {
    it('returns all 20 SOC2 controls with empty data', async () => {
      mockDb._setSelectResults(buildDbResults());
      const { results, overallScore } = await evaluateCompliance(mockDb, 'inst_1', 'soc2');

      expect(results).toHaveLength(20);
      expect(overallScore).toBeGreaterThanOrEqual(0);
      expect(overallScore).toBeLessThanOrEqual(100);
      // Every result should have required fields
      for (const r of results) {
        expect(r.controlId).toBeDefined();
        expect(r.name).toBeDefined();
        expect(r.category).toBeDefined();
        expect(['pass', 'fail']).toContain(r.status);
        expect(r.evidence).toBeDefined();
      }
    });

    it('passes policy controls when policies exist', async () => {
      mockDb._setSelectResults(buildDbResults({
        policies: [{ id: 'pol_1', policyType: 'network_allowlist', isActive: true }],
        instance: { id: 'inst_1', gatewayTokenEncrypted: 'enc', agentVersion: '1.0' },
      }));

      const { results } = await evaluateCompliance(mockDb, 'inst_1', 'soc2');

      // soc2-cc1.1 requires hasPolicies
      const cc11 = results.find((r) => r.controlId === 'soc2-cc1.1');
      expect(cc11?.status).toBe('pass');

      // soc2-cc9.1 (Vendor Management) also requires hasPolicies
      const cc91 = results.find((r) => r.controlId === 'soc2-cc9.1');
      expect(cc91?.status).toBe('pass');
    });

    it('fails monitoring controls without alert rules and events', async () => {
      mockDb._setSelectResults(buildDbResults());
      const { results } = await evaluateCompliance(mockDb, 'inst_1', 'soc2');

      // soc2-cc4.1 requires hasAlertRules && eventCount > 0
      const cc41 = results.find((r) => r.controlId === 'soc2-cc4.1');
      expect(cc41?.status).toBe('fail');
    });

    it('always passes encryption in transit control', async () => {
      mockDb._setSelectResults(buildDbResults());
      const { results } = await evaluateCompliance(mockDb, 'inst_1', 'soc2');

      // soc2-cc6.1 always passes (TLS enforced)
      const cc61 = results.find((r) => r.controlId === 'soc2-cc6.1');
      expect(cc61?.status).toBe('pass');
      expect(cc61?.evidence).toContain('TLS');
    });

    it('computes correct overall score', async () => {
      mockDb._setSelectResults(buildDbResults({
        policies: [{ id: 'pol_1', policyType: 'ip_allowlist', isActive: true }],
        alertRules: [{ id: 'ar_1', isActive: true }],
        events: [{ id: 'ev_1' }],
        audit: [{ id: 'aud_1' }],
        instance: { id: 'inst_1', gatewayTokenEncrypted: 'enc', agentVersion: '1.0' },
        scoreHistory: [{ id: 'sh_1' }],
        baselines: [{ id: 'bl_1' }],
      }));

      const { results, overallScore } = await evaluateCompliance(mockDb, 'inst_1', 'soc2');
      const passing = results.filter((r) => r.status === 'pass').length;
      const expected = Math.round((passing / results.length) * 100);
      expect(overallScore).toBe(expected);
    });
  });

  // ─── ISO 27001 ────────────────────────────────────────────────────────────────

  describe('ISO27001 framework', () => {
    it('returns all 15 ISO27001 controls with empty data', async () => {
      mockDb._setSelectResults(buildDbResults());
      const { results, overallScore } = await evaluateCompliance(mockDb, 'inst_1', 'iso27001');

      expect(results).toHaveLength(15);
      expect(overallScore).toBeGreaterThanOrEqual(0);
      expect(overallScore).toBeLessThanOrEqual(100);
    });

    it('passes asset inventory when agent version exists', async () => {
      mockDb._setSelectResults(buildDbResults({
        instance: { id: 'inst_1', gatewayTokenEncrypted: null, agentVersion: '2.1.0' },
      }));

      const { results } = await evaluateCompliance(mockDb, 'inst_1', 'iso27001');

      // iso-a7.1 requires hasAgentVersion
      const a71 = results.find((r) => r.controlId === 'iso-a7.1');
      expect(a71?.status).toBe('pass');
    });

    it('fails network security control without network policies', async () => {
      mockDb._setSelectResults(buildDbResults());
      const { results } = await evaluateCompliance(mockDb, 'inst_1', 'iso27001');

      // iso-a13.1 requires hasNetworkPolicy
      const a131 = results.find((r) => r.controlId === 'iso-a13.1');
      expect(a131?.status).toBe('fail');
    });
  });

  // ─── CIS ──────────────────────────────────────────────────────────────────────

  describe('CIS framework', () => {
    it('returns all 15 CIS controls with empty data', async () => {
      mockDb._setSelectResults(buildDbResults());
      const { results, overallScore } = await evaluateCompliance(mockDb, 'inst_1', 'cis');

      expect(results).toHaveLength(15);
      expect(overallScore).toBeGreaterThanOrEqual(0);
      expect(overallScore).toBeLessThanOrEqual(100);
    });

    it('passes account management when gateway token present', async () => {
      mockDb._setSelectResults(buildDbResults({
        instance: { id: 'inst_1', gatewayTokenEncrypted: 'enc_token', agentVersion: null },
      }));

      const { results } = await evaluateCompliance(mockDb, 'inst_1', 'cis');

      // cis-5.1 requires hasGatewayToken
      const c51 = results.find((r) => r.controlId === 'cis-5.1');
      expect(c51?.status).toBe('pass');
    });

    it('fails data classification without file rules', async () => {
      mockDb._setSelectResults(buildDbResults());
      const { results } = await evaluateCompliance(mockDb, 'inst_1', 'cis');

      // cis-3.1 requires hasFileRules
      const c31 = results.find((r) => r.controlId === 'cis-3.1');
      expect(c31?.status).toBe('fail');
    });
  });

  // ─── Edge cases ───────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles empty data gracefully for all frameworks', async () => {
      for (const fw of ['soc2', 'iso27001', 'cis'] as const) {
        mockDb._setSelectResults(buildDbResults());
        const { results, overallScore } = await evaluateCompliance(mockDb, 'inst_1', fw);
        expect(results.length).toBeGreaterThan(0);
        expect(overallScore).toBeGreaterThanOrEqual(0);
        expect(overallScore).toBeLessThanOrEqual(100);
      }
    });

    it('throws for unknown framework', async () => {
      mockDb._setSelectResults(buildDbResults());
      await expect(
        evaluateCompliance(mockDb, 'inst_1', 'unknown' as any),
      ).rejects.toThrow('Unknown framework');
    });
  });
});
