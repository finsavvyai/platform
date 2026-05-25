import { describe, it, expect, vi } from 'vitest';
import { createCostTracker } from '../src/costs/tracker.js';
import type { CostEntry } from '../src/types.js';

describe('Cost tracker', () => {
  it('should create tracker instance', () => {
    const tracker = createCostTracker();
    expect(tracker).toBeDefined();
    expect(tracker.recordCost).toBeDefined();
    expect(tracker.getTotalCost).toBeDefined();
  });

  it('should initialize with zero cost', () => {
    const tracker = createCostTracker();
    expect(tracker.getTotalCost()).toBe(0);
  });

  it('should accumulate costs', () => {
    const tracker = createCostTracker();

    tracker.recordCost({
      model: 'gpt-4o',
      provider: 'openai',
      promptTokens: 100,
      completionTokens: 50,
      cost: 0.005,
      timestamp: new Date().toISOString(),
    });

    tracker.recordCost({
      model: 'gpt-4o',
      provider: 'openai',
      promptTokens: 100,
      completionTokens: 50,
      cost: 0.005,
      timestamp: new Date().toISOString(),
    });

    expect(tracker.getTotalCost()).toBe(0.01);
  });

  it('should filter entries by provider', () => {
    const tracker = createCostTracker();

    tracker.recordCost({
      model: 'gpt-4o',
      provider: 'openai',
      promptTokens: 100,
      completionTokens: 50,
      cost: 0.005,
      timestamp: new Date().toISOString(),
    });

    tracker.recordCost({
      model: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      promptTokens: 100,
      completionTokens: 50,
      cost: 0.006,
      timestamp: new Date().toISOString(),
    });

    const openaiEntries = tracker.getEntriesByProvider('openai');
    expect(openaiEntries).toHaveLength(1);
    expect(openaiEntries[0].provider).toBe('openai');
  });

  it('should track budget limit', () => {
    const tracker = createCostTracker(0.01);
    expect(tracker.getBudgetLimit()).toBe(0.01);
  });

  it('should detect budget exceeded', () => {
    const tracker = createCostTracker(0.01);
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    tracker.recordCost({
      model: 'gpt-4o',
      provider: 'openai',
      promptTokens: 100,
      completionTokens: 50,
      cost: 0.015,
      timestamp: new Date().toISOString(),
    });

    expect(tracker.hasExceededBudget()).toBe(true);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should not exceed budget when under limit', () => {
    const tracker = createCostTracker(1.0);

    tracker.recordCost({
      model: 'gpt-4o',
      provider: 'openai',
      promptTokens: 100,
      completionTokens: 50,
      cost: 0.005,
      timestamp: new Date().toISOString(),
    });

    expect(tracker.hasExceededBudget()).toBe(false);
  });

  it('should handle unlimited budget', () => {
    const tracker = createCostTracker();

    tracker.recordCost({
      model: 'gpt-4o',
      provider: 'openai',
      promptTokens: 1000000,
      completionTokens: 1000000,
      cost: 10000,
      timestamp: new Date().toISOString(),
    });

    expect(tracker.hasExceededBudget()).toBe(false);
  });

  it('should return Infinity as budget for unlimited tracker', () => {
    const tracker = createCostTracker();
    expect(tracker.getBudgetLimit()).toBe(Infinity);
  });
});
