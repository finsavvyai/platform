/**
 * TestCodeGenerator - Converts AI scenarios into executable Playwright code
 */

import { logger } from '../../utils/logger.js';
import { codeTemplates } from './CodeTemplates.js';
import type {
  TestScenario,
  ValidationResult,
  APIEndpoint,
} from './types.js';

export class TestCodeGenerator {
  generatePlaywrightCode(scenarios: TestScenario[]): string[] {
    const codes: string[] = [];

    for (const scenario of scenarios) {
      try {
        const code = this.generatePlaywrightScenarioCode(scenario);
        codes.push(code);
        logger.info(`Generated Playwright code for: ${scenario.name}`);
      } catch (error) {
        logger.error(`Failed to generate code for scenario ${scenario.name}`, error);
      }
    }

    return codes;
  }

  generateAPITestCode(endpoints: APIEndpoint[]): string[] {
    const codes: string[] = [];

    for (const endpoint of endpoints) {
      try {
        const code = this.generateAPIEndpointCode(endpoint);
        codes.push(code);
        logger.info(`Generated API test code for: ${endpoint.method} ${endpoint.path}`);
      } catch (error) {
        logger.error(`Failed to generate API code for ${endpoint.path}`, error);
      }
    }

    return codes;
  }

  validateGeneratedCode(code: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      this.validatePlaywrightSyntax(code);

      if (!code.includes('import') && !code.includes('require')) {
        warnings.push('No imports found in code');
      }

      if (!code.includes('test(') && !code.includes('describe(')) {
        warnings.push('No test or describe block found');
      }

      const selectorMatches = code.match(/page\.(locator|goto|click|fill)/g);
      if (!selectorMatches || selectorMatches.length === 0) {
        warnings.push('No page interactions found');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        syntax: {
          hasParseErrors: errors.length > 0,
          parseErrors: errors,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        isValid: false,
        errors: [message],
        warnings,
        syntax: {
          hasParseErrors: true,
          parseErrors: [message],
        },
      };
    }
  }

  private generatePlaywrightScenarioCode(scenario: TestScenario): string {
    const steps = scenario.steps.map((step, idx) => codeTemplates.generateStepCode(step, idx)).join('\n  ');
    const assertions = scenario.assertions
      .map(assertion => codeTemplates.generateAssertionCode(assertion))
      .join('\n  ');

    const escapedName = codeTemplates.escapeString(scenario.name);
    const escapedDesc = codeTemplates.escapeString(scenario.description);

    return `
import { test, expect } from '@playwright/test';

test.describe('${escapedName}', () => {
  test('${escapedDesc}', async ({ page }) => {
    // Steps
${codeTemplates.indent(steps, 4)}

    // Assertions
${codeTemplates.indent(assertions, 4)}
  });
});
`.trim();
  }

  private generateAPIEndpointCode(endpoint: APIEndpoint): string {
    const method = endpoint.method.toLowerCase();
    const url = `${endpoint.baseUrl}${endpoint.path}`;
    const headers = endpoint.headers
      ? `, headers: ${JSON.stringify(endpoint.headers)}`
      : '';
    const body = endpoint.body ? `, body: ${JSON.stringify(endpoint.body)}` : '';

    return `
import { test, expect } from '@playwright/test';

test('${endpoint.method} ${endpoint.path}', async ({ request }) => {
  const response = await request.${method}('${url}'${headers}${body});

  expect(response.status()).toBeLessThan(400);
  expect(response.ok()).toBeTruthy();

  const data = await response.json();
  expect(data).toBeDefined();
});
`.trim();
  }

  private validatePlaywrightSyntax(code: string): void {
    const stringRegex = /['"`]/g;
    let match;
    let count = 0;

    while ((match = stringRegex.exec(code)) !== null) {
      count++;
    }

    if (count % 2 !== 0) {
      throw new Error('Unclosed string literal detected');
    }

    let parenCount = 0;
    for (const char of code) {
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
    }

    if (parenCount !== 0) {
      throw new Error('Unbalanced parentheses detected');
    }
  }
}

export const testCodeGenerator = new TestCodeGenerator();
