/**
 * Playwright Code Generator
 * Converts recorded test steps into executable Playwright test code
 */

import { logger } from '../../utils/logger.js';
import {
  RecordedStep,
  Selector,
  CodegenOptions,
  CodegenResult,
} from './types.js';

export class PlaywrightCodegen {
  private indent: number = 2;

  /**
   * Generate Playwright test code from recorded steps
   */
  generateCode(steps: RecordedStep[], options: CodegenOptions = {}): CodegenResult {
    this.indent = options.indent || 2;

    const testName = options.testName || 'Recorded Test';
    const indentStr = ' '.repeat(this.indent);

    let code = this.generateHeader(testName);
    let assertionCount = 0;
    let estimatedRunTime = 1000; // minimum 1s

    for (const step of steps) {
      const stepCode = this.generateStepCode(step, indentStr, options);
      code += stepCode.code;
      if (stepCode.hasAssertion) assertionCount++;
      estimatedRunTime += stepCode.estimatedTime;
    }

    code += this.generateFooter();

    logger.info('Code generated', {
      testName,
      steps: steps.length,
      assertions: assertionCount,
    });

    return {
      code,
      steps,
      language: 'playwright',
      assertions: assertionCount,
      estimatedRunTime,
    };
  }

  /**
   * Generate test header
   */
  private generateHeader(testName: string): string {
    return `import { test, expect } from '@playwright/test';

test('${testName}', async ({ page }) => {
`;
  }

  /**
   * Generate test footer
   */
  private generateFooter(): string {
    return `});
`;
  }

  /**
   * Generate code for a single step
   */
  private generateStepCode(
    step: RecordedStep,
    indent: string,
    options: CodegenOptions
  ): { code: string; hasAssertion: boolean; estimatedTime: number } {
    const i = indent;
    const i2 = indent + ' '.repeat(this.indent);
    let code = '';
    let hasAssertion = false;
    let estimatedTime = 100;

    switch (step.actionType) {
      case 'navigate': {
        const url = this.escapeString(step.url || '');
        code = `${i}// Navigate to page\n${i}await page.goto('${url}');\n`;
        estimatedTime = 2000;
        break;
      }

      case 'click': {
        const selector = this.generateSelector(step.selector);
        code = `${i}// ${step.description}\n${i}await page.click('${selector}');\n`;
        break;
      }

      case 'fill': {
        const selector = this.generateSelector(step.selector);
        const value = this.escapeString(step.text || step.value || '');
        code = `${i}// ${step.description}\n${i}await page.fill('${selector}', '${value}');\n`;
        break;
      }

      case 'type': {
        const selector = this.generateSelector(step.selector);
        const value = this.escapeString(step.text || '');
        code = `${i}// Type text\n${i}await page.locator('${selector}').type('${value}');\n`;
        break;
      }

      case 'scroll': {
        if (step.scrollY !== undefined) {
          code = `${i}// Scroll\n${i}await page.evaluate(() => window.scrollBy(0, ${step.scrollY}));\n`;
        }
        estimatedTime = 500;
        break;
      }

      case 'hover': {
        const selector = this.generateSelector(step.selector);
        code = `${i}// Hover over element\n${i}await page.hover('${selector}');\n`;
        break;
      }

      case 'select': {
        const selector = this.generateSelector(step.selector);
        const value = this.escapeString(step.value || '');
        code = `${i}// Select option\n${i}await page.selectOption('${selector}', '${value}');\n`;
        break;
      }

      case 'wait': {
        const ms = step.waitMs || 1000;
        code = `${i}// Wait\n${i}await page.waitForTimeout(${ms});\n`;
        estimatedTime = ms;
        break;
      }

      case 'assert': {
        hasAssertion = true;
        const selector = this.generateSelector(step.selector);

        if (step.assertion?.type === 'visible') {
          code = `${i}// Verify element is visible\n${i}await expect(page.locator('${selector}')).toBeVisible();\n`;
        } else if (step.assertion?.type === 'text') {
          const value = this.escapeString(step.assertion.value);
          code = `${i}// Verify text content\n${i}await expect(page.locator('${selector}')).toContainText('${value}');\n`;
        } else if (step.assertion?.type === 'value') {
          const value = this.escapeString(step.assertion.value);
          code = `${i}// Verify input value\n${i}await expect(page.locator('${selector}')).toHaveValue('${value}');\n`;
        } else if (step.assertion?.type === 'exists') {
          code = `${i}// Verify element exists\n${i}await expect(page.locator('${selector}')).toBeTruthy();\n`;
        } else if (step.assertion?.type === 'url') {
          const url = this.escapeString(step.assertion.value);
          code = `${i}// Verify URL\n${i}await expect(page).toHaveURL('${url}');\n`;
        }
        estimatedTime = 200;
        break;
      }

      case 'screenshot': {
        const filename = this.escapeString(step.screenshot || 'screenshot');
        code = `${i}// Take screenshot\n${i}await page.screenshot({ path: './screenshots/${filename}.png' });\n`;
        estimatedTime = 500;
        break;
      }

      case 'focus': {
        const selector = this.generateSelector(step.selector);
        code = `${i}// Focus on element\n${i}await page.focus('${selector}');\n`;
        break;
      }

      case 'blur': {
        const selector = this.generateSelector(step.selector);
        code = `${i}// Blur element\n${i}await page.locator('${selector}').blur();\n`;
        break;
      }

      case 'check': {
        const selector = this.generateSelector(step.selector);
        code = `${i}// Check checkbox\n${i}await page.check('${selector}');\n`;
        break;
      }

      case 'uncheck': {
        const selector = this.generateSelector(step.selector);
        code = `${i}// Uncheck checkbox\n${i}await page.uncheck('${selector}');\n`;
        break;
      }

      default:
        code = `${i}// Unknown action: ${step.actionType}\n`;
    }

    return { code, hasAssertion, estimatedTime };
  }

  /**
   * Generate selector string with smart strategy
   */
  private generateSelector(selector?: Selector): string {
    if (!selector) return '*';

    // Prefer data-testid, then role, then xpath, then css
    switch (selector.type) {
      case 'testid':
        return `[data-testid="${this.escapeString(selector.value)}"]`;
      case 'role':
        return `[role="${this.escapeString(selector.value)}"]`;
      case 'text':
        return `text=${this.escapeString(selector.value)}`;
      case 'label':
        return `text=${this.escapeString(selector.value)}`;
      case 'xpath':
        return this.escapeString(selector.value);
      case 'css':
      default:
        return this.escapeString(selector.value);
    }
  }

  /**
   * Escape string for code generation
   */
  private escapeString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }
}

export const playwrightCodegen = new PlaywrightCodegen();
