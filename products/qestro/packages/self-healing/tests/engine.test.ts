import { describe, expect, it, vi } from 'vitest';
import { SelfHealingEngine, type TestResult } from '../src/index.js';

function makeResult(partial: Partial<TestResult> = {}): TestResult {
  const now = new Date();
  return {
    id: 'run_1',
    testId: 't1',
    status: 'failed',
    startTime: now,
    endTime: now,
    duration: 100,
    errors: [],
    assertions: [],
    ...partial,
  };
}

describe('SelfHealingEngine', () => {
  it('classifies selector failures and surfaces data-testid as highest-confidence fix', async () => {
    const engine = new SelfHealingEngine();
    const result = await engine.analyzeAndHeal(
      't1',
      makeResult({ errors: ['TimeoutError: locator.click: selector not found #btn'] }),
    );

    expect(result.analysis.type).toBe('selector_changed');
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0].confidence).toBeGreaterThanOrEqual(0.95);
    expect(result.healed).toBe(true);
    expect(result.appliedFix?.type).toBe('selector_update');
  });

  it('classifies timing failures and applies the wait_for_selector fix', async () => {
    const engine = new SelfHealingEngine();
    const result = await engine.analyzeAndHeal(
      't2',
      makeResult({ errors: ['Error: waiting for loading spinner timeout 30000ms exceeded'] }),
    );

    expect(result.analysis.type).toBe('timing_issue');
    expect(result.suggestions.map((s) => s.type)).toContain('wait_for_selector');
    expect(result.healed).toBe(true);
  });

  it('classifies API schema failures (severity: high)', async () => {
    const engine = new SelfHealingEngine();
    const result = await engine.analyzeAndHeal(
      't3',
      makeResult({ errors: ['Network response missing field: user.name'] }),
    );

    expect(result.analysis.type).toBe('api_schema_change');
    expect(result.analysis.severity).toBe('high');
  });

  it('classifies assertion drift using failed assertions from the test result', async () => {
    const engine = new SelfHealingEngine();
    const result = await engine.analyzeAndHeal(
      't4',
      makeResult({
        errors: ['expect(received).toBe(expected) — values differ'],
        assertions: [
          {
            id: 'a1',
            type: 'equality',
            expected: 'Welcome',
            actual: 'Welcome, friend!',
            passed: false,
          },
        ],
      }),
    );

    expect(result.analysis.type).toBe('assertion_drift');
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0].originalValue).toBe('Welcome');
    expect(result.suggestions[0].suggestedValue).toBe('Welcome, friend!');
  });

  it('returns no suggestions and healed=false for unrecognized errors', async () => {
    const engine = new SelfHealingEngine();
    const result = await engine.analyzeAndHeal(
      't5',
      makeResult({ errors: ['completely novel failure with no signal'] }),
    );

    expect(result.analysis.type).toBe('unknown');
    expect(result.suggestions).toEqual([]);
    expect(result.healed).toBe(false);
    expect(result.confidenceScore).toBe(0);
  });

  it('fires the onLowConfidence notifier when below threshold', async () => {
    const notifier = vi.fn();
    // Raise threshold above the highest selector suggestion (0.95) so nothing auto-applies.
    const engine = new SelfHealingEngine({ autoApplyThreshold: 0.99, onLowConfidence: notifier });
    await engine.analyzeAndHeal(
      't6',
      makeResult({ errors: ['locator not found'] }),
    );

    expect(notifier).toHaveBeenCalledOnce();
    const payload = notifier.mock.calls[0][0];
    expect(payload.testId).toBe('t6');
    expect(payload.confidence).toBeGreaterThan(0);
  });

  it('tracks healing history and exposes stats', async () => {
    const engine = new SelfHealingEngine();
    await engine.analyzeAndHeal('t7', makeResult({ errors: ['selector missing'] }));
    await engine.analyzeAndHeal('t7', makeResult({ errors: ['selector missing again'] }));

    const stats = engine.getHealingStats('t7');
    expect(stats.totalAttempted).toBe(2);
    expect(stats.totalHealed).toBe(2);
    expect(stats.successRate).toBe(1);
    expect(stats.byType.selector_update).toBe(2);

    engine.clearHistory('t7');
    expect(engine.getHealingStats('t7').totalAttempted).toBe(0);
  });

  it('respects a custom autoApplyThreshold', async () => {
    const strict = new SelfHealingEngine({ autoApplyThreshold: 0.999 });
    const result = await strict.analyzeAndHeal('t8', makeResult({ errors: ['locator timeout'] }));
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.healed).toBe(false);
  });
});
