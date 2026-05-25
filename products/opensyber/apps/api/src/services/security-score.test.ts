import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateSecurityScore } from './security-score.js';
import type { ScoreInstance, ScoreSkillCounts, ScoreExtended, ScoreEvent } from './security-score.js';

function makeInstance(overrides?: Partial<ScoreInstance>): ScoreInstance {
  return {
    lastHealthCheck: new Date().toISOString(),
    gatewayTokenEncrypted: 'enc_token_abc',
    agentVersion: '0.2.0',
    ...overrides,
  };
}

function makeSkills(overrides?: Partial<ScoreSkillCounts>): ScoreSkillCounts {
  return { verified: 3, unverified: 0, blocked: 0, ...overrides };
}

function makeExtended(overrides?: Partial<ScoreExtended>): ScoreExtended {
  return {
    activePolicies: 2,
    activeAlertRules: 3,
    openAlerts: 0,
    openIncidents: 0,
    fileBaselines: 5,
    vulnSummary: { critical: 0, high: 0, medium: 0, low: 0 },
    ...overrides,
  };
}

function recentEvent(type: string, severity = 'info'): ScoreEvent {
  return { eventType: type, severity, createdAt: new Date().toISOString() };
}

function oldEvent(type: string, severity = 'info'): ScoreEvent {
  return { eventType: type, severity, createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() };
}

describe('calculateSecurityScore', () => {
  it('returns perfect score for ideal configuration', () => {
    const score = calculateSecurityScore(makeInstance(), [], makeSkills(), makeExtended());
    expect(score.overall).toBe(100);
    expect(score.categories.credentialSecurity).toBe(100);
    expect(score.categories.skillSafety).toBe(100);
    expect(score.categories.networkSecurity).toBe(100);
    expect(score.categories.configurationHardening).toBe(100);
    expect(score.categories.vulnerabilityManagement).toBe(100);
    expect(score.recommendations).toHaveLength(0);
  });

  describe('credential security (20%)', () => {
    it('penalizes missing gateway token', () => {
      const score = calculateSecurityScore(
        makeInstance({ gatewayTokenEncrypted: null }),
        [], makeSkills(), makeExtended(),
      );
      expect(score.categories.credentialSecurity).toBe(50);
    });

    it('penalizes critical credential access events', () => {
      const events = [
        recentEvent('credential_access', 'critical'),
        recentEvent('credential_access', 'critical'),
      ];
      const score = calculateSecurityScore(makeInstance(), events, makeSkills(), makeExtended());
      expect(score.categories.credentialSecurity).toBe(70); // 100 - 30
    });

    it('caps credential event penalty at 40', () => {
      const events = Array.from({ length: 10 }, () =>
        recentEvent('credential_access', 'critical'),
      );
      const score = calculateSecurityScore(makeInstance(), events, makeSkills(), makeExtended());
      expect(score.categories.credentialSecurity).toBe(60); // 100 - 40
    });

    it('ignores old credential events', () => {
      const events = [oldEvent('credential_access', 'critical')];
      const score = calculateSecurityScore(makeInstance(), events, makeSkills(), makeExtended());
      expect(score.categories.credentialSecurity).toBe(100);
    });
  });

  describe('skill safety (15%)', () => {
    it('penalizes unverified skills', () => {
      const score = calculateSecurityScore(
        makeInstance(), [], makeSkills({ unverified: 2 }), makeExtended(),
      );
      expect(score.categories.skillSafety).toBe(60);
      expect(score.recommendations).toContain('Remove or verify 2 unverified skill(s).');
    });

    it('penalizes blocked skills heavily', () => {
      const score = calculateSecurityScore(
        makeInstance(), [], makeSkills({ blocked: 2 }), makeExtended(),
      );
      expect(score.categories.skillSafety).toBe(40);
    });

    it('clamps at 0 for many bad skills', () => {
      const score = calculateSecurityScore(
        makeInstance(), [], makeSkills({ unverified: 5, blocked: 3 }), makeExtended(),
      );
      expect(score.categories.skillSafety).toBe(0);
    });
  });

  describe('network security (20%)', () => {
    it('penalizes unauthorized network events', () => {
      const events = [
        recentEvent('unauthorized_network', 'warning'),
        recentEvent('unauthorized_network', 'warning'),
        recentEvent('unauthorized_network', 'warning'),
      ];
      const score = calculateSecurityScore(makeInstance(), events, makeSkills(), makeExtended());
      expect(score.categories.networkSecurity).toBe(70);
    });

    it('penalizes missing network policies', () => {
      const score = calculateSecurityScore(
        makeInstance(), [], makeSkills(), makeExtended({ activePolicies: 0 }),
      );
      expect(score.categories.networkSecurity).toBe(80);
    });
  });

  describe('update status (10%)', () => {
    it('penalizes missing agent version', () => {
      const score = calculateSecurityScore(
        makeInstance({ agentVersion: null }), [], makeSkills(), makeExtended(),
      );
      expect(score.categories.updateStatus).toBe(60);
    });

    it('penalizes overdue health check', () => {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const score = calculateSecurityScore(
        makeInstance({ lastHealthCheck: tenMinAgo }), [], makeSkills(), makeExtended(),
      );
      expect(score.categories.updateStatus).toBe(70);
    });

    it('penalizes null health check', () => {
      const score = calculateSecurityScore(
        makeInstance({ lastHealthCheck: null }), [], makeSkills(), makeExtended(),
      );
      expect(score.categories.updateStatus).toBe(70);
    });
  });

  describe('configuration hardening (15%)', () => {
    it('penalizes no policies, baselines, or alert rules', () => {
      const score = calculateSecurityScore(
        makeInstance(), [], makeSkills(),
        makeExtended({ activePolicies: 0, fileBaselines: 0, activeAlertRules: 0 }),
      );
      expect(score.categories.configurationHardening).toBe(20);
    });
  });

  describe('vulnerability management (10%)', () => {
    it('penalizes critical vulnerabilities', () => {
      const score = calculateSecurityScore(
        makeInstance(), [], makeSkills(),
        makeExtended({ vulnSummary: { critical: 2, high: 0, medium: 0, low: 0 } }),
      );
      expect(score.categories.vulnerabilityManagement).toBe(50);
    });

    it('penalizes high severity vulnerabilities', () => {
      const score = calculateSecurityScore(
        makeInstance(), [], makeSkills(),
        makeExtended({ vulnSummary: { critical: 0, high: 3, medium: 0, low: 0 } }),
      );
      expect(score.categories.vulnerabilityManagement).toBe(55);
    });

    it('ignores low severity vulnerabilities', () => {
      const score = calculateSecurityScore(
        makeInstance(), [], makeSkills(),
        makeExtended({ vulnSummary: { critical: 0, high: 0, medium: 0, low: 10 } }),
      );
      expect(score.categories.vulnerabilityManagement).toBe(100);
    });
  });

  describe('incident readiness (10%)', () => {
    it('penalizes open incidents and alerts', () => {
      const score = calculateSecurityScore(
        makeInstance(), [], makeSkills(),
        makeExtended({ openIncidents: 2, openAlerts: 3 }),
      );
      expect(score.categories.incidentReadiness).toBe(65);
    });

    it('penalizes missing alert rules', () => {
      const score = calculateSecurityScore(
        makeInstance(), [], makeSkills(),
        makeExtended({ activeAlertRules: 0 }),
      );
      expect(score.categories.incidentReadiness).toBe(70);
    });
  });

  describe('overall score', () => {
    it('calculates weighted average correctly', () => {
      // All categories at 100 → overall 100
      const perfect = calculateSecurityScore(makeInstance(), [], makeSkills(), makeExtended());
      expect(perfect.overall).toBe(100);
    });

    it('calculates low score for worst case', () => {
      const score = calculateSecurityScore(
        makeInstance({ gatewayTokenEncrypted: null, agentVersion: null, lastHealthCheck: null }),
        Array.from({ length: 10 }, () => recentEvent('unauthorized_network', 'warning')),
        makeSkills({ unverified: 5, blocked: 3 }),
        makeExtended({
          activePolicies: 0,
          activeAlertRules: 0,
          fileBaselines: 0,
          openAlerts: 10,
          openIncidents: 5,
          vulnSummary: { critical: 4, high: 5, medium: 10, low: 20 },
        }),
      );
      expect(score.overall).toBeLessThan(30);
      expect(score.recommendations.length).toBeGreaterThan(5);
    });

    it('clamps overall between 0 and 100', () => {
      const score = calculateSecurityScore(
        makeInstance({ gatewayTokenEncrypted: null, agentVersion: null, lastHealthCheck: null }),
        Array.from({ length: 50 }, () => recentEvent('credential_access', 'critical')),
        makeSkills({ unverified: 10, blocked: 10 }),
        makeExtended({
          activePolicies: 0, activeAlertRules: 0, fileBaselines: 0,
          openAlerts: 100, openIncidents: 100,
          vulnSummary: { critical: 100, high: 100, medium: 100, low: 100 },
        }),
      );
      expect(score.overall).toBeGreaterThanOrEqual(0);
      expect(score.overall).toBeLessThanOrEqual(100);
    });
  });
});
