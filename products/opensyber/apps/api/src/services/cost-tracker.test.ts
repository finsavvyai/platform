/**
 * Cost Tracker Service Tests
 */
import { describe, it, expect } from 'vitest';
import {
  getModelPricing, calculateCost, summarizeSpend, checkBudgets,
  type CostEvent, type BudgetRule,
} from './cost-tracker.js';

describe('Cost Tracker Service', () => {
  describe('getModelPricing', () => {
    it('returns pricing for known model', () => {
      const pricing = getModelPricing('anthropic', 'claude-opus-4');
      expect(pricing).not.toBeNull();
      expect(pricing!.inputPer1M).toBe(15);
      expect(pricing!.outputPer1M).toBe(75);
    });

    it('returns null for unknown model', () => {
      expect(getModelPricing('unknown', 'model')).toBeNull();
    });
  });

  describe('calculateCost', () => {
    it('calculates correct cost for claude-sonnet-4', () => {
      const cost = calculateCost('anthropic', 'claude-sonnet-4', 1_000_000, 0);
      expect(cost).toBe(3);
    });

    it('calculates correct cost for gpt-4o output', () => {
      const cost = calculateCost('openai', 'gpt-4o', 0, 1_000_000);
      expect(cost).toBe(10);
    });

    it('returns 0 for unknown model', () => {
      expect(calculateCost('unknown', 'model', 1000, 1000)).toBe(0);
    });

    it('handles mixed input and output tokens', () => {
      const cost = calculateCost('anthropic', 'claude-haiku-4-5', 500_000, 200_000);
      const expected = (500_000 / 1_000_000) * 0.80 + (200_000 / 1_000_000) * 4;
      expect(cost).toBeCloseTo(expected, 5);
    });
  });

  describe('summarizeSpend', () => {
    it('tallies today and month spend', () => {
      const now = new Date().toISOString();
      const events: CostEvent[] = [
        { id: '1', agentId: 'a', sessionId: 's', provider: 'p', model: 'm', inputTokens: 0, outputTokens: 0, costUsd: 1.50, timestamp: now },
        { id: '2', agentId: 'a', sessionId: 's', provider: 'p', model: 'm', inputTokens: 0, outputTokens: 0, costUsd: 2.25, timestamp: now },
      ];
      const summary = summarizeSpend(events);
      expect(summary.totalUsd).toBeCloseTo(3.75, 5);
      expect(summary.todayUsd).toBeCloseTo(3.75, 5);
      expect(summary.eventCount).toBe(2);
    });

    it('returns zeroes for empty events', () => {
      const summary = summarizeSpend([]);
      expect(summary.totalUsd).toBe(0);
      expect(summary.eventCount).toBe(0);
    });
  });

  describe('checkBudgets', () => {
    it('detects exceeded budget', () => {
      const rules: BudgetRule[] = [{
        id: 'r1', userId: 'u', scope: 'daily', limitUsd: 10, agentId: null, createdAt: '',
      }];
      const spend = new Map([['daily', 15]]);
      const alerts = checkBudgets(rules, spend);
      expect(alerts[0].exceeded).toBe(true);
      expect(alerts[0].percentUsed).toBe(150);
    });

    it('reports safe budget', () => {
      const rules: BudgetRule[] = [{
        id: 'r1', userId: 'u', scope: 'monthly', limitUsd: 100, agentId: null, createdAt: '',
      }];
      const spend = new Map([['monthly', 25]]);
      const alerts = checkBudgets(rules, spend);
      expect(alerts[0].exceeded).toBe(false);
      expect(alerts[0].percentUsed).toBe(25);
    });
  });
});
