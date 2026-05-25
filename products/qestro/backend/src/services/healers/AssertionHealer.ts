/**
 * AssertionHealer - Fixes assertion drift (value changes)
 *
 * Detects when expected values differ from actual and suggests updates
 */

import type { TestResult } from '../../types/TestingTypes.js';
import type { HealingSuggestion } from '../SelfHealingEngine.js';

export class AssertionHealer {
  heal(testResult: TestResult, testCode?: string): HealingSuggestion[] {
    const suggestions: HealingSuggestion[] = [];

    testResult.assertions.forEach((assertion, idx) => {
      if (!assertion.passed) {
        suggestions.push({
          id: `assertion_${idx}`,
          type: 'assertion_value_update',
          originalValue: String(assertion.expected),
          suggestedValue: String(assertion.actual),
          confidence: 0.60,
          rationale: `Update assertion to match current page state. Actual: "${assertion.actual}"`,
          beforeAfterDiff: `- expect(value).toBe('${assertion.expected}')\n+ expect(value).toBe('${assertion.actual}')`,
        });

        // Add alternative: use contains/includes for partial matches
        if (typeof assertion.actual === 'string') {
          suggestions.push({
            id: `assertion_contains_${idx}`,
            type: 'assertion_flexible_match',
            originalValue: `expect().toBe('${assertion.expected}')`,
            suggestedValue: `expect().toContain('${assertion.actual.substring(0, 20)}')`,
            confidence: 0.65,
            rationale: 'Use flexible matching (contains) instead of exact match to handle dynamic content',
            beforeAfterDiff: `- expect(value).toBe('${assertion.expected}')\n+ expect(value).toContain('${assertion.actual.substring(0, 20)}')`,
          });
        }
      }
    });

    return suggestions;
  }
}
