/**
 * Auto Fix Engine
 * AI-powered automatic fix suggestions for test failures
 */

import {
  AutoFixSuggestion,
  ApplyResult,
  ValidationResult,
  TestFailure,
  FixCategory,
} from './types.js';

export class AutoFixEngine {
  /**
   * Suggest fixes for a test failure
   * @param testId Test identifier
   * @param testCode Current test code
   * @param failure Test failure details
   * @returns Array of fix suggestions with confidence scores
   */
  async suggestFixes(
    testId: string,
    testCode: string,
    failure: TestFailure
  ): Promise<AutoFixSuggestion[]> {
    const suggestions: AutoFixSuggestion[] = [];

    // Analyze failure message and generate suggestions
    if (this.isSelectorError(failure)) {
      suggestions.push(
        ...(await this.suggestSelectorFix(testId, testCode, failure))
      );
    }

    if (this.isTimingError(failure)) {
      suggestions.push(
        ...(await this.suggestTimingFix(testId, testCode, failure))
      );
    }

    if (this.isAssertionError(failure)) {
      suggestions.push(
        ...(await this.suggestAssertionFix(testId, testCode, failure))
      );
    }

    if (this.isEnvironmentError(failure)) {
      suggestions.push(
        ...(await this.suggestEnvironmentFix(testId, testCode, failure))
      );
    }

    if (this.isRetryableError(failure)) {
      suggestions.push(
        ...(await this.suggestRetryFix(testId, testCode, failure))
      );
    }

    // Sort by confidence descending
    suggestions.sort((a, b) => b.confidence - a.confidence);

    return suggestions;
  }

  /**
   * Check if error is selector-related
   */
  private isSelectorError(failure: TestFailure): boolean {
    const msg = failure.failureMessage.toLowerCase();
    return (
      msg.includes('selector') ||
      msg.includes('not found') ||
      msg.includes('no element matches') ||
      msg.includes('timed out waiting')
    );
  }

  /**
   * Suggest selector fix
   */
  private async suggestSelectorFix(
    testId: string,
    testCode: string,
    failure: TestFailure
  ): Promise<AutoFixSuggestion[]> {
    const suggestions: AutoFixSuggestion[] = [];

    // Extract selector from error message
    const selectorMatch = failure.failureMessage.match(/['"]([^'"]+)['"]/);
    const failingSelector = selectorMatch ? selectorMatch[1] : null;

    if (failingSelector) {
      // Suggest more stable selectors
      const alternatives = this.generateSelectorAlternatives(failingSelector);

      alternatives.forEach((alt, index) => {
        suggestions.push({
          fixId: `selector-fix-${index}`,
          category: 'selector_update',
          description: `Update selector from "${failingSelector}" to "${alt.selector}"`,
          confidence: alt.confidence,
          suggestedCode: testCode.replace(failingSelector, alt.selector),
          currentCode: testCode,
          rationale: alt.rationale,
          riskLevel: 'low',
          estimatedSuccessRate: alt.confidence,
        });
      });
    }

    return suggestions;
  }

  /**
   * Generate alternative selectors
   */
  private generateSelectorAlternatives(
    selector: string
  ): { selector: string; confidence: number; rationale: string }[] {
    const alternatives: { selector: string; confidence: number; rationale: string }[] = [];

    // Use aria-label if selector is class-based
    if (selector.includes('.')) {
      alternatives.push({
        selector: `[aria-label="${selector}"]`,
        confidence: 0.75,
        rationale: 'Use aria-label for accessibility and stability',
      });
    }

    // Use data-testid
    if (!selector.includes('data-testid')) {
      alternatives.push({
        selector: `[data-testid="${selector}"]`,
        confidence: 0.8,
        rationale: 'data-testid is the most stable selector approach',
      });
    }

    // Use text content
    alternatives.push({
      selector: `:has-text("${selector}")`,
      confidence: 0.65,
      rationale: 'Match by visible text content',
    });

    // Use role + label
    alternatives.push({
      selector: `[role="button"][aria-label="${selector}"]`,
      confidence: 0.7,
      rationale: 'Use semantic HTML roles for better stability',
    });

    return alternatives;
  }

  /**
   * Check if error is timing-related
   */
  private isTimingError(failure: TestFailure): boolean {
    const msg = failure.failureMessage.toLowerCase();
    return (
      msg.includes('timeout') ||
      msg.includes('waited') ||
      msg.includes('not ready') ||
      msg.includes('element is not visible')
    );
  }

  /**
   * Suggest timing fix
   */
  private async suggestTimingFix(
    testId: string,
    testCode: string,
    failure: TestFailure
  ): Promise<AutoFixSuggestion[]> {
    const suggestions: AutoFixSuggestion[] = [];

    // Increase timeout
    const timeoutMatch = testCode.match(/timeout:\s*(\d+)/);
    const currentTimeout = timeoutMatch ? parseInt(timeoutMatch[1]) : 30000;
    const newTimeout = Math.min(currentTimeout * 1.5, 60000);

    suggestions.push({
      fixId: 'timing-fix-increase-timeout',
      category: 'timing_adjustment',
      description: `Increase timeout from ${currentTimeout}ms to ${newTimeout}ms`,
      confidence: 0.7,
      suggestedCode: testCode.replace(
        `timeout: ${currentTimeout}`,
        `timeout: ${newTimeout}`
      ),
      currentCode: testCode,
      rationale: 'Increase timeout to account for slower environments',
      riskLevel: 'low',
      estimatedSuccessRate: 0.7,
    });

    // Add explicit wait
    if (!testCode.includes('waitFor')) {
      suggestions.push({
        fixId: 'timing-fix-add-wait',
        category: 'wait_strategy',
        description: 'Add explicit wait for element visibility',
        confidence: 0.75,
        suggestedCode: testCode.replace(
          /click\(/g,
          'waitForVisible(); click('
        ),
        currentCode: testCode,
        rationale: 'Explicit waits are more reliable than implicit timeouts',
        riskLevel: 'medium',
        estimatedSuccessRate: 0.75,
      });
    }

    return suggestions;
  }

  /**
   * Check if error is assertion-related
   */
  private isAssertionError(failure: TestFailure): boolean {
    const msg = failure.failureMessage.toLowerCase();
    return (
      msg.includes('assertion') ||
      msg.includes('expected') ||
      msg.includes('equal') ||
      msg.includes('match')
    );
  }

  /**
   * Suggest assertion fix
   */
  private async suggestAssertionFix(
    testId: string,
    testCode: string,
    failure: TestFailure
  ): Promise<AutoFixSuggestion[]> {
    const suggestions: AutoFixSuggestion[] = [];

    // Extract expected vs actual from error
    const expectedMatch = failure.failureMessage.match(/expected:\s*([^\n]+)/i);
    const actualMatch = failure.failureMessage.match(/actual:\s*([^\n]+)/i);

    if (expectedMatch && actualMatch) {
      const expected = expectedMatch[1];
      const actual = actualMatch[1];

      suggestions.push({
        fixId: 'assertion-fix-update-value',
        category: 'assertion_correction',
        description: `Update assertion from "${expected}" to "${actual}"`,
        confidence: 0.85,
        suggestedCode: testCode.replace(expected, actual),
        currentCode: testCode,
        rationale: 'Update expected value to match actual application behavior',
        riskLevel: 'medium',
        estimatedSuccessRate: 0.85,
      });
    }

    // Suggest partial match instead of exact match
    suggestions.push({
      fixId: 'assertion-fix-partial-match',
      category: 'assertion_correction',
      description: 'Use partial match instead of exact match',
      confidence: 0.6,
      suggestedCode: testCode.replace(
        /expect\(([^)]+)\)\.toBe\(/g,
        'expect($1).toContain('
      ),
      currentCode: testCode,
      rationale: 'Partial matching is more resilient to UI changes',
      riskLevel: 'low',
      estimatedSuccessRate: 0.6,
    });

    return suggestions;
  }

  /**
   * Check if error is environment-related
   */
  private isEnvironmentError(failure: TestFailure): boolean {
    const msg = failure.failureMessage.toLowerCase();
    return (
      msg.includes('browser') ||
      msg.includes('mobile') ||
      msg.includes('os') ||
      msg.includes('platform') ||
      msg.includes('not supported')
    );
  }

  /**
   * Suggest environment fix
   */
  private async suggestEnvironmentFix(
    testId: string,
    testCode: string,
    failure: TestFailure
  ): Promise<AutoFixSuggestion[]> {
    const suggestions: AutoFixSuggestion[] = [];

    const osInfo = failure.environment.os.toLowerCase();
    const browserInfo = failure.environment.browser?.toLowerCase() || '';

    // Suggest platform-specific handling
    suggestions.push({
      fixId: 'env-fix-platform-check',
      category: 'environment_config',
      description: `Add platform-specific handling for ${osInfo}`,
      confidence: 0.75,
      suggestedCode: `if (isOS('${osInfo}')) { /* platform-specific code */ } else { /* fallback */ }`,
      currentCode: testCode,
      rationale: `Test needs special handling for ${osInfo} environment`,
      riskLevel: 'medium',
      estimatedSuccessRate: 0.75,
    });

    return suggestions;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(failure: TestFailure): boolean {
    const msg = failure.failureMessage.toLowerCase();
    return (
      msg.includes('network') ||
      msg.includes('connection') ||
      msg.includes('econnrefused') ||
      msg.includes('temporary')
    );
  }

  /**
   * Suggest retry fix
   */
  private async suggestRetryFix(
    testId: string,
    testCode: string,
    failure: TestFailure
  ): Promise<AutoFixSuggestion[]> {
    const suggestions: AutoFixSuggestion[] = [];

    suggestions.push({
      fixId: 'retry-fix-add-retry',
      category: 'retry_logic',
      description: 'Add retry logic for transient failures',
      confidence: 0.8,
      suggestedCode: `retry(3, async () => { ${testCode} })`,
      currentCode: testCode,
      rationale: 'Network and transient errors often succeed on retry',
      riskLevel: 'low',
      estimatedSuccessRate: 0.8,
    });

    return suggestions;
  }

  /**
   * Apply a fix to a test
   * @param testId Test identifier
   * @param fixedCode The fixed test code
   * @param originalCode The original test code
   * @returns Result of applying the fix
   */
  async applyFix(
    testId: string,
    fixedCode: string,
    originalCode: string
  ): Promise<ApplyResult> {
    const validation = await this.validateFix(testId, fixedCode);

    if (!validation.valid) {
      return {
        success: false,
        testId,
        fixedCode,
        previousCode: originalCode,
        appliedAt: new Date(),
        message: `Validation failed: ${validation.errors.join(', ')}`,
      };
    }

    return {
      success: true,
      testId,
      fixedCode,
      previousCode: originalCode,
      appliedAt: new Date(),
      message: 'Fix applied successfully',
    };
  }

  /**
   * Validate fixed code
   * @param testId Test identifier
   * @param fixedCode Code to validate
   * @returns Validation result
   */
  async validateFix(testId: string, fixedCode: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check syntax validity + code safety
    let syntaxValid = true;
    try {
      const { validateCode } = require('../../lib/code-sandbox.js');
      const validation = validateCode(fixedCode);
      if (!validation.safe) {
        syntaxValid = false;
        errors.push(...validation.violations.map((v: string) => `Unsafe pattern: ${v}`));
      }
      new Function(fixedCode);
    } catch (e) {
      syntaxValid = false;
      errors.push(`Syntax error: ${e instanceof Error ? e.message : 'Unknown'}`);
    }

    // Check semantic validity
    let semanticValid = true;
    if (!fixedCode.includes('describe') && !fixedCode.includes('test')) {
      semanticValid = false;
      errors.push('Test must contain describe() or test() block');
    }

    // Warnings
    if (!fixedCode.includes('await')) {
      warnings.push('Test contains no await statements - may have race conditions');
    }

    if (fixedCode.includes('any')) {
      warnings.push('Test contains "any" type - consider adding proper types');
    }

    return {
      valid: syntaxValid && semanticValid,
      errors,
      warnings,
      syntaxValid,
      semanticValid,
    };
  }

  /**
   * Estimate success rate for a fix
   * @param fixCategory Fix category
   * @param failureType Type of failure
   * @returns Estimated success rate (0-1)
   */
  estimateSuccessRate(fixCategory: FixCategory, failureType: string): number {
    const rates: Record<FixCategory, number> = {
      selector_update: 0.85,
      timing_adjustment: 0.7,
      assertion_correction: 0.75,
      data_refresh: 0.6,
      environment_config: 0.65,
      retry_logic: 0.8,
      wait_strategy: 0.75,
    };

    return rates[fixCategory] || 0.5;
  }
}
