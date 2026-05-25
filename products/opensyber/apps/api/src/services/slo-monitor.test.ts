import { describe, it, expect, beforeEach } from 'vitest';
import { createMockDb } from '../test/helpers.js';
import {
  getSloTier,
  computeSloStatus,
  checkSloBreaches,
} from './slo-monitor.js';

describe('slo-monitor: tier and status', () => {
  let db: any;

  beforeEach(() => {
    db = createMockDb();
  });

  describe('getSloTier', () => {
    it('returns cloud-security tier for guardduty, security-hub, scc', () => {
      expect(getSloTier('guardduty')).toBe('cloud-security');
      expect(getSloTier('security-hub')).toBe('cloud-security');
      expect(getSloTier('scc')).toBe('cloud-security');
    });

    it('returns identity tier for entra-id and okta', () => {
      expect(getSloTier('entra-id')).toBe('identity');
      expect(getSloTier('okta')).toBe('identity');
    });

    it('returns ide-agents tier for vscode-agent and jetbrains-agent', () => {
      expect(getSloTier('vscode-agent')).toBe('ide-agents');
      expect(getSloTier('jetbrains-agent')).toBe('ide-agents');
    });

    it('returns siem-forwarding tier for datadog, splunk, loki', () => {
      expect(getSloTier('datadog')).toBe('siem-forwarding');
      expect(getSloTier('splunk')).toBe('siem-forwarding');
      expect(getSloTier('loki')).toBe('siem-forwarding');
    });

    it('returns null for unknown integration', () => {
      expect(getSloTier('unknown-service')).toBeNull();
    });
  });

  describe('computeSloStatus', () => {
    it('returns null for unknown integration slug', () => {
      const status = computeSloStatus({
        integrationSlug: 'unknown-service',
        avgLatencyMs: 100,
        eventsReceived: 100,
        errorCount: 0,
      });
      expect(status).toBeNull();
    });

    it('returns compliant status when within cloud-security thresholds', () => {
      const status = computeSloStatus({
        integrationSlug: 'guardduty',
        avgLatencyMs: 300_000,
        eventsReceived: 100,
        errorCount: 0,
      });

      expect(status!.tier).toBe('cloud-security');
      expect(status!.latencyOk).toBe(true);
      expect(status!.breached).toBe(false);
    });

    it('returns breached status when latency exceeds threshold', () => {
      const status = computeSloStatus({
        integrationSlug: 'guardduty',
        avgLatencyMs: 700_000,
        eventsReceived: 100,
        errorCount: 0,
      });

      expect(status!.latencyOk).toBe(false);
      expect(status!.breached).toBe(true);
    });

    it('returns breached when availability or error rate threshold exceeded', () => {
      const statusAvail = computeSloStatus({
        integrationSlug: 'guardduty',
        avgLatencyMs: 300_000,
        eventsReceived: 100,
        errorCount: 10,
      });
      expect(statusAvail!.availabilityOk).toBe(false);

      const statusError = computeSloStatus({
        integrationSlug: 'guardduty',
        avgLatencyMs: 300_000,
        eventsReceived: 100,
        errorCount: 10,
      });
      expect(statusError!.breachAlertOk).toBe(false);
    });

    it('computes correct compliance score', () => {
      const status = computeSloStatus({
        integrationSlug: 'guardduty',
        avgLatencyMs: 300_000,
        eventsReceived: 100,
        errorCount: 0,
      });

      expect(status!.compliance).toBeGreaterThan(95);
      expect(status!.compliance).toBeLessThanOrEqual(100);
    });

    it('handles zero events and different tiers', () => {
      const statusCloud = computeSloStatus({
        integrationSlug: 'guardduty',
        avgLatencyMs: 300_000,
        eventsReceived: 0,
        errorCount: 0,
      });
      expect(statusCloud!.availabilityOk).toBe(true);

      const statusSiem = computeSloStatus({
        integrationSlug: 'datadog',
        avgLatencyMs: 25_000,
        eventsReceived: 100,
        errorCount: 0,
      });
      expect(statusSiem!.tier).toBe('siem-forwarding');
      expect(statusSiem!.latencyOk).toBe(true);
    });

    it('returns breached siem-forwarding when latency exceeds 30 sec', () => {
      const status = computeSloStatus({
        integrationSlug: 'splunk',
        avgLatencyMs: 35_000,
        eventsReceived: 100,
        errorCount: 0,
      });

      expect(status!.tier).toBe('siem-forwarding');
      expect(status!.latencyOk).toBe(false);
      expect(status!.breached).toBe(true);
    });
  });

  describe('checkSloBreaches', () => {
    it('returns breached connections and filters compliant ones', async () => {
      db._setSelectResults([
        [
          { id: 'conn-1', slug: 'guardduty', integrationSlug: 'guardduty', avgLatencyMs: 700_000, eventsReceived: 100, errorCount: 0 },
          { id: 'conn-2', slug: 'okta', integrationSlug: 'okta', avgLatencyMs: 300_000, eventsReceived: 100, errorCount: 0 },
        ],
      ]);

      const breaches = await checkSloBreaches(db, 'user-123');

      expect(breaches).toHaveLength(1);
      expect(breaches[0].connectionId).toBe('conn-1');
      expect(breaches[0].status.breached).toBe(true);
    });

    it('returns empty array when no breaches', async () => {
      db._setSelectResults([
        [
          { id: 'conn-1', slug: 'guardduty', integrationSlug: 'guardduty', avgLatencyMs: 300_000, eventsReceived: 100, errorCount: 0 },
        ],
      ]);

      const breaches = await checkSloBreaches(db, 'user-123');

      expect(breaches).toHaveLength(0);
    });

    it('queries DB with userId and returns status details', async () => {
      db._setSelectResults([
        [
          { id: 'conn-1', slug: 'datadog', integrationSlug: 'datadog', avgLatencyMs: 50_000, eventsReceived: 100, errorCount: 5 },
        ],
      ]);

      const breaches = await checkSloBreaches(db, 'user-456');

      expect(db.select).toHaveBeenCalled();
      expect(breaches).toHaveLength(1);
      expect(breaches[0].status.tier).toBe('siem-forwarding');
      expect(breaches[0].status.compliance).toBeDefined();
    });
  });
});
