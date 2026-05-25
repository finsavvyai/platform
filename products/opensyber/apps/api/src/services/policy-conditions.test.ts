import { describe, it, expect } from 'vitest';
import {
  matchesCondition,
  type Condition,
  type Event,
} from './policy-engine.js';

describe('policy-engine: condition matching', () => {
  describe('equals operator', () => {
    it('matches when values are equal', () => {
      const condition: Condition = {
        field: 'severity',
        operator: 'equals',
        value: 'high',
      };
      const event: Event = {
        severity: 'high',
        eventType: 'test',
        integrationSlug: 'test',
        summary: 'test',
      };

      expect(matchesCondition(condition, event)).toBe(true);
    });

    it('does not match when values differ', () => {
      const condition: Condition = {
        field: 'severity',
        operator: 'equals',
        value: 'high',
      };
      const event: Event = {
        severity: 'low',
        eventType: 'test',
        integrationSlug: 'test',
        summary: 'test',
      };

      expect(matchesCondition(condition, event)).toBe(false);
    });
  });

  describe('contains operator', () => {
    it('matches when substring exists', () => {
      const condition: Condition = {
        field: 'summary',
        operator: 'contains',
        value: 'malware',
      };
      const event: Event = {
        summary: 'Critical malware detected in system',
        severity: 'critical',
        eventType: 'threat',
        integrationSlug: 'defender',
      };

      expect(matchesCondition(condition, event)).toBe(true);
    });

    it('does not match when substring missing', () => {
      const condition: Condition = {
        field: 'summary',
        operator: 'contains',
        value: 'ransomware',
      };
      const event: Event = {
        summary: 'Critical malware detected',
        severity: 'critical',
        eventType: 'threat',
        integrationSlug: 'defender',
      };

      expect(matchesCondition(condition, event)).toBe(false);
    });
  });

  describe('matches (regex) operator', () => {
    it('matches valid regex pattern', () => {
      const condition: Condition = {
        field: 'eventType',
        operator: 'matches',
        value: 'threat-.*',
      };
      const event: Event = {
        eventType: 'threat-detected',
        severity: 'high',
        integrationSlug: 'defender',
        summary: 'test',
      };

      expect(matchesCondition(condition, event)).toBe(true);
    });

    it('does not match when pattern fails', () => {
      const condition: Condition = {
        field: 'eventType',
        operator: 'matches',
        value: 'threat-.*',
      };
      const event: Event = {
        eventType: 'anomaly-detected',
        severity: 'high',
        integrationSlug: 'defender',
        summary: 'test',
      };

      expect(matchesCondition(condition, event)).toBe(false);
    });

    it('handles invalid regex gracefully', () => {
      const condition: Condition = {
        field: 'summary',
        operator: 'matches',
        value: '[invalid(',
      };
      const event: Event = {
        summary: 'test',
        severity: 'high',
        eventType: 'test',
        integrationSlug: 'test',
      };

      expect(matchesCondition(condition, event)).toBe(false);
    });
  });

  describe('in operator', () => {
    it('matches single string value', () => {
      const condition: Condition = {
        field: 'integrationSlug',
        operator: 'in',
        value: 'datadog',
      };
      const event: Event = {
        integrationSlug: 'datadog',
        severity: 'medium',
        eventType: 'alert',
        summary: 'test',
      };

      expect(matchesCondition(condition, event)).toBe(true);
    });

    it('matches array values', () => {
      const condition: Condition = {
        field: 'severity',
        operator: 'in',
        value: ['high', 'critical'],
      };
      const event: Event = {
        severity: 'critical',
        eventType: 'threat',
        integrationSlug: 'test',
        summary: 'test',
      };

      expect(matchesCondition(condition, event)).toBe(true);
    });

    it('does not match when value not in array', () => {
      const condition: Condition = {
        field: 'severity',
        operator: 'in',
        value: ['high', 'critical'],
      };
      const event: Event = {
        severity: 'low',
        eventType: 'threat',
        integrationSlug: 'test',
        summary: 'test',
      };

      expect(matchesCondition(condition, event)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles missing field gracefully', () => {
      const condition: Condition = {
        field: 'severity',
        operator: 'equals',
        value: 'high',
      };
      const event: Event = {
        eventType: 'test',
        integrationSlug: 'test',
        summary: 'test',
      } as Event;

      expect(matchesCondition(condition, event)).toBe(false);
    });
  });
});
