import { describe, it, expect } from 'vitest';
import {
  evaluateRules,
  type Rule,
  type Event,
} from './policy-engine.js';

describe('policy-engine: rule evaluation', () => {

  describe('evaluateRules', () => {
    it('returns matching actions when conditions match', () => {
      const rules: Rule[] = [
        {
          id: 'rule-1',
          name: 'High severity alert',
          isActive: true,
          priority: 10,
          conditions: [
            { field: 'severity', operator: 'equals', value: 'high' },
          ],
          actions: [
            { type: 'alert', config: { channel: 'slack' } },
          ],
        },
      ];
      const event: Event = {
        severity: 'high',
        eventType: 'threat',
        integrationSlug: 'defender',
        summary: 'High severity threat',
      };

      const matched = evaluateRules(rules, event);

      expect(matched).toHaveLength(1);
      expect(matched[0].rule.id).toBe('rule-1');
      expect(matched[0].actions).toHaveLength(1);
    });

    it('returns empty when no rules match', () => {
      const rules: Rule[] = [
        {
          id: 'rule-1',
          name: 'High severity alert',
          isActive: true,
          priority: 10,
          conditions: [
            { field: 'severity', operator: 'equals', value: 'critical' },
          ],
          actions: [
            { type: 'alert', config: { channel: 'slack' } },
          ],
        },
      ];
      const event: Event = {
        severity: 'low',
        eventType: 'info',
        integrationSlug: 'defender',
        summary: 'Low severity event',
      };

      const matched = evaluateRules(rules, event);

      expect(matched).toHaveLength(0);
    });

    it('filters inactive rules', () => {
      const rules: Rule[] = [
        {
          id: 'rule-1',
          name: 'Inactive rule',
          isActive: false,
          priority: 10,
          conditions: [
            { field: 'severity', operator: 'equals', value: 'high' },
          ],
          actions: [
            { type: 'alert', config: {} },
          ],
        },
      ];
      const event: Event = {
        severity: 'high',
        eventType: 'threat',
        integrationSlug: 'defender',
        summary: 'test',
      };

      const matched = evaluateRules(rules, event);

      expect(matched).toHaveLength(0);
    });

    it('respects rule priority ordering', () => {
      const rules: Rule[] = [
        {
          id: 'rule-low',
          name: 'Low priority',
          isActive: true,
          priority: 1,
          conditions: [{ field: 'severity', operator: 'equals', value: 'high' }],
          actions: [{ type: 'alert', config: {} }],
        },
        {
          id: 'rule-high',
          name: 'High priority',
          isActive: true,
          priority: 100,
          conditions: [{ field: 'severity', operator: 'equals', value: 'high' }],
          actions: [{ type: 'escalate', config: {} }],
        },
      ];
      const event: Event = {
        severity: 'high',
        eventType: 'threat',
        integrationSlug: 'defender',
        summary: 'test',
      };

      const matched = evaluateRules(rules, event);

      expect(matched[0].rule.id).toBe('rule-high');
      expect(matched[1].rule.id).toBe('rule-low');
    });

    it('returns multiple matching rules', () => {
      const rules: Rule[] = [
        {
          id: 'rule-1',
          name: 'Rule 1',
          isActive: true,
          priority: 10,
          conditions: [{ field: 'severity', operator: 'equals', value: 'critical' }],
          actions: [{ type: 'alert', config: {} }],
        },
        {
          id: 'rule-2',
          name: 'Rule 2',
          isActive: true,
          priority: 10,
          conditions: [{ field: 'severity', operator: 'equals', value: 'critical' }],
          actions: [{ type: 'escalate', config: {} }],
        },
      ];
      const event: Event = {
        severity: 'critical',
        eventType: 'breach',
        integrationSlug: 'defender',
        summary: 'test',
      };

      const matched = evaluateRules(rules, event);

      expect(matched).toHaveLength(2);
    });

    it('requires all conditions to match (AND logic)', () => {
      const rules: Rule[] = [
        {
          id: 'rule-1',
          name: 'Multi-condition rule',
          isActive: true,
          priority: 10,
          conditions: [
            { field: 'severity', operator: 'equals', value: 'critical' },
            { field: 'integrationSlug', operator: 'equals', value: 'defender' },
          ],
          actions: [{ type: 'alert', config: {} }],
        },
      ];
      const event: Event = {
        severity: 'critical',
        eventType: 'breach',
        integrationSlug: 'okta',
        summary: 'test',
      };

      const matched = evaluateRules(rules, event);

      expect(matched).toHaveLength(0);
    });
  });
});
