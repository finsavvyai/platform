"use strict";
/**
 * AssertionHealer — fixes for assertion drift.
 *
 * Looks at failed assertions and suggests updated expected values plus a
 * flexible (contains) fallback for dynamic strings.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssertionHealer = void 0;
class AssertionHealer {
    heal(testResult, _testCode) {
        const suggestions = [];
        testResult.assertions.forEach((assertion, idx) => {
            if (assertion.passed)
                return;
            suggestions.push({
                id: `assertion_${idx}`,
                type: 'assertion_value_update',
                originalValue: String(assertion.expected),
                suggestedValue: String(assertion.actual),
                confidence: 0.6,
                rationale: `Update assertion to match current page state. Actual: "${String(assertion.actual)}"`,
                beforeAfterDiff: `- expect(value).toBe('${String(assertion.expected)}')\n+ expect(value).toBe('${String(assertion.actual)}')`,
            });
            if (typeof assertion.actual === 'string') {
                const snippet = assertion.actual.substring(0, 20);
                suggestions.push({
                    id: `assertion_contains_${idx}`,
                    type: 'assertion_flexible_match',
                    originalValue: `expect().toBe('${String(assertion.expected)}')`,
                    suggestedValue: `expect().toContain('${snippet}')`,
                    confidence: 0.65,
                    rationale: 'Use flexible matching (contains) instead of exact match to handle dynamic content',
                    beforeAfterDiff: `- expect(value).toBe('${String(assertion.expected)}')\n+ expect(value).toContain('${snippet}')`,
                });
            }
        });
        return suggestions;
    }
}
exports.AssertionHealer = AssertionHealer;
//# sourceMappingURL=AssertionHealer.js.map