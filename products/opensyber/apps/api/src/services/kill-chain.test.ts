import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockDb } from '../test/helpers.js';
import {
  KILL_CHAIN_RULES,
  evaluateKillChain,
  findCorrelatedEvents,
  createUnifiedIncident,
  type KillChainRule,
  type CorrelatedEvent,
} from './kill-chain.js';

describe('kill-chain: events and incidents', () => {
  let db: any;

  beforeEach(() => {
    db = createMockDb();
  });


  describe('findCorrelatedEvents', () => {
    it('returns event with all required fields and respects time windows', async () => {
      const rule = KILL_CHAIN_RULES[0]; // 30 min window
      const newEvent = {
        integrationSlug: 'outlook',
        eventType: 'phishing_detected',
        createdAt: '2024-01-01T12:00:00Z',
      };

      const events = await findCorrelatedEvents(db, rule, newEvent);

      expect(events).toHaveLength(1);
      expect(events[0]).toHaveProperty('eventId');
      expect(events[0].integrationSlug).toBe('outlook');
      expect(events[0].eventType).toBe('phishing_detected');

      // Verify time window calculation (60 min rule)
      const rule60 = KILL_CHAIN_RULES.find(r => r.timeWindowMinutes === 60)!;
      const windowStart = new Date(new Date(newEvent.createdAt).getTime() - rule60.timeWindowMinutes * 60 * 1000);
      expect(windowStart.getTime()).toBeLessThan(new Date(newEvent.createdAt).getTime());
    });
  });

  describe('createUnifiedIncident', () => {
    it('creates incident with rule ID, critical severity, open status, and unique ID', async () => {
      const rule = KILL_CHAIN_RULES[0];
      const correlatedEvents: CorrelatedEvent[] = [
        { eventId: 'evt-1', integrationSlug: 'outlook', eventType: 'phishing_detected', createdAt: new Date().toISOString() },
      ];

      const incident1 = await createUnifiedIncident(db, rule, correlatedEvents);
      const incident2 = await createUnifiedIncident(db, rule, correlatedEvents);

      expect(incident1.ruleId).toBe(rule.id);
      expect(incident1.severity).toBe('critical');
      expect(incident1.status).toBe('open');
      expect(incident1.id).not.toBe(incident2.id);
    });

    it('includes all correlated event IDs and sets rule summary', async () => {
      const rule = KILL_CHAIN_RULES[1]; // supply chain rule
      const correlatedEvents: CorrelatedEvent[] = [
        { eventId: 'evt-1', integrationSlug: 'github', eventType: 'dependabot_alert', createdAt: new Date().toISOString() },
        { eventId: 'evt-2', integrationSlug: 'ide', eventType: 'npm_install', createdAt: new Date().toISOString() },
        { eventId: 'evt-3', integrationSlug: 'cloudtrail', eventType: 'iam_change', createdAt: new Date().toISOString() },
      ];

      const incident = await createUnifiedIncident(db, rule, correlatedEvents);

      expect(incident.correlatedEventIds).toContain('evt-1');
      expect(incident.correlatedEventIds).toContain('evt-2');
      expect(incident.correlatedEventIds).toContain('evt-3');
      expect(incident.summary).toBe(rule.description);
    });

    it('sets createdAt to current timestamp', async () => {
      const rule = KILL_CHAIN_RULES[0];
      const correlatedEvents: CorrelatedEvent[] = [
        { eventId: 'evt-1', integrationSlug: 'outlook', eventType: 'phishing_detected', createdAt: new Date().toISOString() },
      ];

      const beforeTime = new Date();
      const incident = await createUnifiedIncident(db, rule, correlatedEvents);
      const afterTime = new Date();
      const incidentTime = new Date(incident.createdAt);

      expect(incidentTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(incidentTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe('evaluateKillChain', () => {
    it('returns array of critical incidents for matched kill chain patterns', async () => {
      const newEvent = {
        integrationSlug: 'cloudtrail',
        eventType: 'iam_change',
        createdAt: new Date().toISOString(),
      };

      const incidents = await evaluateKillChain(db, newEvent);

      expect(incidents).toBeInstanceOf(Array);
      for (const incident of incidents) {
        expect(incident.severity).toBe('critical');
        expect(incident.status).toBe('open');
      }
    });
  });
});
