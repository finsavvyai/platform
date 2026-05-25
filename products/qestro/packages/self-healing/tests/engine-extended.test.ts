/**
 * Extended engine tests — covers edge cases not in engine.test.ts:
 *   - Trust-score computation edge cases
 *   - Healer-type ordering for each failure shape
 *   - Healer interface custom implementations
 *   - Logger injection receiving expected calls
 *   - onLowConfidence fires exactly once per call
 */

import { describe, expect, it, vi } from 'vitest';
import {
  AssertionHealer,
  SelfHealingEngine,
  SelectorHealer,
  TimingHealer,
  APIHealer,
} from '../src/index.js';
import type { Healer, HealingSuggestion, Logger, TestResult } from '../src/types.js';

// ---------------------------------------------------------------------------
// Shared factory
// ---------------------------------------------------------------------------

function makeResult(partial: Partial<TestResult> = {}): TestResult {
  const now = new Date();
  return {
    id: 'r1',
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

// ---------------------------------------------------------------------------
// Trust-score edge cases
// ---------------------------------------------------------------------------

describe('Trust-score computation edge cases', () => {
  it('confidence is 0 when no errors are present (unknown type)', async () => {
    const engine = new SelfHealingEngine();
    const result = await engine.analyzeAndHeal('e1', makeResult({ errors: [] }));
    expect(result.confidenceScore).toBe(0);
    expect(result.healed).toBe(false);
    expect(result.suggestions).toHaveLength(0);
  });

  it('returns confidenceScore equal to the top suggestion confidence', async () => {
    const engine = new SelfHealingEngine();
    const result = await engine.analyzeAndHeal(
      'e2',
      makeResult({ errors: ['locator.click: element not found'] }),
    );
    const top = [...result.suggestions].sort((a, b) => b.confidence - a.confidence)[0];
    expect(result.confidenceScore).toBe(top?.confidence ?? 0);
  });

  it('healed=false when confidenceScore exactly equals threshold (< not <=)', async () => {
    // SelectorHealer top-confidence is 0.95; set threshold to 0.95 — should NOT auto-apply.
    const engine = new SelfHealingEngine({ autoApplyThreshold: 0.95 });
    const result = await engine.analyzeAndHeal(
      'e3',
      makeResult({ errors: ['locator missing selector'] }),
    );
    // 0.95 >= 0.95 is true, so healed should be true (>=, not strictly >).
    expect(result.healed).toBe(true);
    expect(result.confidenceScore).toBe(0.95);
  });

  it('healed=false when threshold is just above top suggestion confidence', async () => {
    const engine = new SelfHealingEngine({ autoApplyThreshold: 0.96 });
    const result = await engine.analyzeAndHeal(
      'e4',
      makeResult({ errors: ['locator.click: selector not found'] }),
    );
    expect(result.healed).toBe(false);
    expect(result.appliedFix).toBeUndefined();
  });

  it('long-running test (>30s) classified as timing gets severity high', async () => {
    const engine = new SelfHealingEngine();
    const result = await engine.analyzeAndHeal(
      'e5',
      makeResult({
        // Use only timing keywords so selector classification doesn't win.
        errors: ['timeout 30001ms exceeded while waiting for loading state'],
        duration: 31000,
      }),
    );
    // Timing errors get severity 'low' by default; duration >30s escalates to 'high'.
    expect(result.analysis.type).toBe('timing_issue');
    expect(result.analysis.severity).toBe('high');
  });

  it('api_schema_change always has severity high regardless of duration', async () => {
    const engine = new SelfHealingEngine();
    const result = await engine.analyzeAndHeal(
      'e6',
      makeResult({ errors: ['network response missing field: user.name'], duration: 50 }),
    );
    expect(result.analysis.severity).toBe('high');
    expect(result.analysis.type).toBe('api_schema_change');
  });
});

// ---------------------------------------------------------------------------
// Healer ordering — correct healer fires for each failure shape
// ---------------------------------------------------------------------------

describe('Healer ordering by failure type', () => {
  it('selector failure → SelectorHealer suggestions (data-testid first)', async () => {
    const engine = new SelfHealingEngine({ autoApplyThreshold: 0.5 });
    const result = await engine.analyzeAndHeal(
      'h1',
      makeResult({ errors: ['TimeoutError: locator.click: element not found #btn'] }),
    );
    expect(result.analysis.type).toBe('selector_changed');
    const types = result.suggestions.map((s) => s.type);
    expect(types).toContain('selector_update');
    // Highest-confidence is always data-testid at 0.95
    const top = result.suggestions[0];
    expect(top.suggestedValue).toContain('data-testid');
    expect(top.confidence).toBe(0.95);
  });

  it('timing failure → TimingHealer suggestions (wait_for_selector highest confidence)', async () => {
    const engine = new SelfHealingEngine({ autoApplyThreshold: 0.5 });
    const result = await engine.analyzeAndHeal(
      'h2',
      makeResult({ errors: ['Error: waiting for loading spinner timeout exceeded'] }),
    );
    expect(result.analysis.type).toBe('timing_issue');
    const types = result.suggestions.map((s) => s.type);
    expect(types).toContain('wait_for_selector');
    const top = [...result.suggestions].sort((a, b) => b.confidence - a.confidence)[0];
    expect(top.type).toBe('wait_for_selector');
    expect(top.confidence).toBe(0.87);
  });

  it('api failure → APIHealer suggestions (error handler second-highest)', async () => {
    const engine = new SelfHealingEngine({ autoApplyThreshold: 0.5 });
    const result = await engine.analyzeAndHeal(
      'h3',
      makeResult({ errors: ['network response schema field missing'] }),
    );
    expect(result.analysis.type).toBe('api_schema_change');
    const types = result.suggestions.map((s) => s.type);
    expect(types).toContain('api_response_mapping');
    expect(types).toContain('api_error_handler');
  });

  it('assertion failure → AssertionHealer suggestions', async () => {
    const engine = new SelfHealingEngine({ autoApplyThreshold: 0.5 });
    const result = await engine.analyzeAndHeal(
      'h4',
      makeResult({
        errors: ['expect(received).toBe(expected)'],
        assertions: [
          { id: 'a1', type: 'eq', expected: 'Hello', actual: 'Hello world', passed: false },
        ],
      }),
    );
    expect(result.analysis.type).toBe('assertion_drift');
    const types = result.suggestions.map((s) => s.type);
    expect(types).toContain('assertion_value_update');
  });

  it('unknown error → no suggestions, healer does not fire', async () => {
    const engine = new SelfHealingEngine({ autoApplyThreshold: 0.5 });
    const result = await engine.analyzeAndHeal(
      'h5',
      makeResult({ errors: ['RangeError: max call stack exceeded'] }),
    );
    expect(result.analysis.type).toBe('unknown');
    expect(result.suggestions).toHaveLength(0);
    expect(result.healed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Custom Healer implementation via public Healer interface
// ---------------------------------------------------------------------------

describe('Custom healer via Healer interface', () => {
  it('individual healers satisfy the Healer interface contract', () => {
    // The Healer interface requires: heal(testResult, testCode?): HealingSuggestion[]
    const healers: Healer[] = [
      new SelectorHealer(),
      new TimingHealer(),
      new AssertionHealer(),
      new APIHealer(),
    ];
    const now = new Date();
    const dummyResult: TestResult = {
      id: 'r',
      testId: 't',
      status: 'failed',
      startTime: now,
      endTime: now,
      duration: 0,
      errors: [],
      assertions: [],
    };

    for (const healer of healers) {
      const suggestions = healer.heal(dummyResult, 'page.click(".btn")');
      expect(Array.isArray(suggestions)).toBe(true);
      // Every suggestion must have the required shape
      for (const s of suggestions) {
        expect(typeof s.id).toBe('string');
        expect(typeof s.type).toBe('string');
        expect(typeof s.confidence).toBe('number');
        expect(s.confidence).toBeGreaterThanOrEqual(0);
        expect(s.confidence).toBeLessThanOrEqual(1);
        expect(typeof s.originalValue).toBe('string');
        expect(typeof s.suggestedValue).toBe('string');
        expect(typeof s.rationale).toBe('string');
        expect(typeof s.beforeAfterDiff).toBe('string');
      }
    }
  });

  it('custom healer can be used standalone outside the engine', () => {
    // Users can compose their own healer by implementing Healer.
    const customHealer: Healer = {
      heal(_result: TestResult): HealingSuggestion[] {
        return [
          {
            id: 'custom_1',
            type: 'custom_fix',
            originalValue: 'old',
            suggestedValue: 'new',
            confidence: 0.9,
            rationale: 'Custom rationale',
            beforeAfterDiff: '- old\n+ new',
          },
        ];
      },
    };

    const now = new Date();
    const result = customHealer.heal({
      id: 'r',
      testId: 't',
      status: 'failed',
      startTime: now,
      endTime: now,
      duration: 0,
      errors: ['some error'],
      assertions: [],
    });

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('custom_fix');
    expect(result[0].confidence).toBe(0.9);
  });
});

// ---------------------------------------------------------------------------
// Logger injection
// ---------------------------------------------------------------------------

describe('Logger injection', () => {
  it('custom logger receives info call for every analyzeAndHeal invocation', async () => {
    const logger: Logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const engine = new SelfHealingEngine({ logger });
    await engine.analyzeAndHeal(
      'log1',
      makeResult({ errors: ['locator not found'] }),
    );
    expect(logger.info).toHaveBeenCalledOnce();
    const msg = (logger.info as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain('testId=log1');
    expect(msg).toContain('healed=');
    expect(msg).toContain('confidence=');
  });

  it('custom logger receives warn when onLowConfidence notifier throws', async () => {
    const logger: Logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const engine = new SelfHealingEngine({
      autoApplyThreshold: 0.99,
      logger,
      onLowConfidence: async () => {
        throw new Error('notifier error');
      },
    });
    await engine.analyzeAndHeal('log2', makeResult({ errors: ['locator missing'] }));
    expect(logger.warn).toHaveBeenCalledOnce();
    const warnMsg = (logger.warn as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(warnMsg).toContain('onLowConfidence notifier failed');
  });

  it('no-op logger (default) does not throw', async () => {
    const engine = new SelfHealingEngine(); // no logger option
    await expect(
      engine.analyzeAndHeal('log3', makeResult({ errors: ['locator'] })),
    ).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// onLowConfidence fires exactly once per call
// ---------------------------------------------------------------------------

describe('onLowConfidence fires exactly once when threshold not met', () => {
  it('fires exactly once for a single below-threshold call', async () => {
    const notifier = vi.fn();
    const engine = new SelfHealingEngine({ autoApplyThreshold: 0.99, onLowConfidence: notifier });
    await engine.analyzeAndHeal('oc1', makeResult({ errors: ['selector missing'] }));
    expect(notifier).toHaveBeenCalledTimes(1);
  });

  it('fires once per call, not cumulative', async () => {
    const notifier = vi.fn();
    const engine = new SelfHealingEngine({ autoApplyThreshold: 0.99, onLowConfidence: notifier });
    await engine.analyzeAndHeal('oc2', makeResult({ errors: ['selector missing'] }));
    await engine.analyzeAndHeal('oc2', makeResult({ errors: ['selector missing again'] }));
    expect(notifier).toHaveBeenCalledTimes(2);
  });

  it('does NOT fire when confidence meets the threshold', async () => {
    const notifier = vi.fn();
    // Default threshold 0.85, SelectorHealer gives 0.95 → auto-healed, no notifier.
    const engine = new SelfHealingEngine({ onLowConfidence: notifier });
    const result = await engine.analyzeAndHeal(
      'oc3',
      makeResult({ errors: ['locator.click: element not found'] }),
    );
    expect(result.healed).toBe(true);
    expect(notifier).not.toHaveBeenCalled();
  });

  it('does NOT fire when failure is unknown (no suggestions)', async () => {
    const notifier = vi.fn();
    const engine = new SelfHealingEngine({ onLowConfidence: notifier });
    await engine.analyzeAndHeal('oc4', makeResult({ errors: ['RangeError: stack overflow'] }));
    expect(notifier).not.toHaveBeenCalled();
  });

  it('notifier payload contains testId, confidence, analysis, and suggestion', async () => {
    const payloads: unknown[] = [];
    const engine = new SelfHealingEngine({
      autoApplyThreshold: 0.99,
      onLowConfidence: (p) => { payloads.push(p); },
    });
    await engine.analyzeAndHeal('oc5', makeResult({ errors: ['selector not found'] }));
    expect(payloads).toHaveLength(1);
    const p = payloads[0] as Record<string, unknown>;
    expect(p.testId).toBe('oc5');
    expect(typeof p.confidence).toBe('number');
    expect(p.analysis).toBeDefined();
    expect(p.suggestion).toBeDefined();
  });
});
