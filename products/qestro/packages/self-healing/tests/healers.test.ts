import { describe, expect, it } from 'vitest';
import {
  APIHealer,
  AssertionHealer,
  SelectorHealer,
  TimingHealer,
  type TestResult,
} from '../src/index.js';

function emptyResult(overrides: Partial<TestResult> = {}): TestResult {
  const now = new Date();
  return {
    id: 'r',
    testId: 't',
    status: 'failed',
    startTime: now,
    endTime: now,
    duration: 0,
    errors: [],
    assertions: [],
    ...overrides,
  };
}

describe('SelectorHealer', () => {
  it('returns five strategies ranked by confidence', () => {
    const suggestions = new SelectorHealer().heal(emptyResult());
    expect(suggestions).toHaveLength(5);
    const types = suggestions.map((s) => s.suggestedValue);
    expect(types[0]).toContain('data-testid');
    expect(suggestions.every((s) => s.confidence >= 0.7 && s.confidence <= 0.95)).toBe(true);
  });
});

describe('TimingHealer', () => {
  it('returns four timing strategies with before/after diffs', () => {
    const suggestions = new TimingHealer().heal(emptyResult());
    expect(suggestions).toHaveLength(4);
    expect(suggestions.every((s) => s.beforeAfterDiff.includes('+'))).toBe(true);
  });
});

describe('AssertionHealer', () => {
  it('produces two suggestions per failed string assertion (exact + contains)', () => {
    const suggestions = new AssertionHealer().heal(
      emptyResult({
        assertions: [
          { id: 'a', type: 'eq', expected: 'hi', actual: 'hi there', passed: false },
        ],
      }),
    );
    expect(suggestions).toHaveLength(2);
    expect(suggestions[0].type).toBe('assertion_value_update');
    expect(suggestions[1].type).toBe('assertion_flexible_match');
  });

  it('produces a single suggestion for non-string actuals', () => {
    const suggestions = new AssertionHealer().heal(
      emptyResult({
        assertions: [{ id: 'a', type: 'eq', expected: 1, actual: 2, passed: false }],
      }),
    );
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].suggestedValue).toBe('2');
  });

  it('ignores passing assertions', () => {
    const suggestions = new AssertionHealer().heal(
      emptyResult({
        assertions: [{ id: 'a', type: 'eq', expected: 'x', actual: 'x', passed: true }],
      }),
    );
    expect(suggestions).toHaveLength(0);
  });
});

describe('APIHealer', () => {
  it('returns four API-schema migration suggestions', () => {
    const suggestions = new APIHealer().heal(emptyResult());
    expect(suggestions).toHaveLength(4);
    expect(suggestions.map((s) => s.type)).toEqual([
      'api_response_mapping',
      'api_error_handler',
      'api_null_check',
      'api_status_code',
    ]);
  });
});
