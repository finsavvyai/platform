'use strict';

/**
 * API Assertion Validator
 * Validates API response assertions
 */

interface APIAssertion {
  type: 'statusCode' | 'bodyMatch' | 'headerExists' | 'responseTime';
  target?: string;
  expected: any;
  operator?: 'equals' | 'contains' | 'greaterThan' | 'lessThan';
  stepIndex?: number;
}

export class APIAssertionValidator {
  /**
   * Validate all assertions against responses
   */
  async validate(assertions: APIAssertion[], responses: any[]): Promise<void> {
    for (const assertion of assertions) {
      const stepIndex = assertion.stepIndex ?? responses.length - 1;
      const response = responses[stepIndex];

      if (!response) {
        throw new Error(`No response available for assertion step ${stepIndex}`);
      }

      const passed = this.checkAssertion(assertion, response);

      if (!passed) {
        throw new Error(
          `Assertion failed: ${assertion.type} ${assertion.target || ''} ` +
          `expected ${JSON.stringify(assertion.expected)}`
        );
      }
    }
  }

  /**
   * Check a single assertion
   */
  private checkAssertion(assertion: APIAssertion, response: any): boolean {
    switch (assertion.type) {
      case 'statusCode':
        return response.status === assertion.expected;

      case 'bodyMatch': {
        if (!assertion.target) return false;
        const value = this.getNestedValue(response.body, assertion.target);

        if (assertion.operator === 'contains') {
          return String(value).includes(String(assertion.expected));
        }
        return value === assertion.expected;
      }

      case 'headerExists': {
        if (!assertion.target) return false;
        const headerValue = response.headers[assertion.target.toLowerCase()];

        if (assertion.expected === undefined) {
          return headerValue !== undefined;
        }
        return headerValue === assertion.expected;
      }

      case 'responseTime': {
        switch (assertion.operator) {
          case 'lessThan':
            return response.responseTime < assertion.expected;
          case 'greaterThan':
            return response.responseTime > assertion.expected;
          default:
            return response.responseTime === assertion.expected;
        }
      }

      default:
        return false;
    }
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      if (current === null || current === undefined) return undefined;
      return current[key];
    }, obj);
  }
}
