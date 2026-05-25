/**
 * CodeTemplates - Code generation templates for test steps and assertions
 */

import type { TestStep, Assertion } from './types.js';

export class CodeTemplates {
  /**
   * Generate code for a single test step
   */
  generateStepCode(step: TestStep, index: number): string {
    const comment = step.description ? `// ${step.description}` : '';

    switch (step.action) {
      case 'goto':
        return `${comment}\nawait page.goto('${this.escapeString(step.target || '')}');`;

      case 'click':
        return `${comment}\nawait page.locator('${this.escapeString(step.target || '')}').click();`;

      case 'fill':
        return `${comment}\nawait page.locator('${this.escapeString(step.target || '')}').fill('${this.escapeString(step.value || '')}');`;

      case 'select':
        return `${comment}\nawait page.locator('${this.escapeString(step.target || '')}').selectOption('${this.escapeString(step.value || '')}');`;

      case 'wait':
        const timeout = step.timeout || 3000;
        return `${comment}\nawait page.waitForTimeout(${timeout});`;

      case 'screenshot':
        const filename = `screenshot-${index}.png`;
        return `${comment}\nawait page.screenshot({ path: '${filename}' });`;

      case 'hover':
        return `${comment}\nawait page.locator('${this.escapeString(step.target || '')}').hover();`;

      case 'press':
        return `${comment}\nawait page.keyboard.press('${this.escapeString(step.value || 'Enter')}');`;

      default:
        return `// Unknown action: ${step.action}`;
    }
  }

  /**
   * Generate code for an assertion
   */
  generateAssertionCode(assertion: Assertion): string {
    const selector = `page.locator('${this.escapeString(assertion.target)}')`;

    switch (assertion.type) {
      case 'visible':
        return `await expect(${selector}).toBeVisible();`;

      case 'hidden':
        return `await expect(${selector}).toBeHidden();`;

      case 'text':
        return `await expect(${selector}).toContainText('${this.escapeString(assertion.expected as string)}');`;

      case 'enabled':
        return `await expect(${selector}).toBeEnabled();`;

      case 'disabled':
        return `await expect(${selector}).toBeDisabled();`;

      case 'url':
        return `await expect(page).toHaveURL('${this.escapeString(assertion.expected as string)}');`;

      case 'title':
        return `await expect(page).toHaveTitle('${this.escapeString(assertion.expected as string)}');`;

      case 'attribute':
        return `await expect(${selector}).toHaveAttribute('${assertion.target}', '${this.escapeString(assertion.expected as string)}');`;

      case 'count':
        return `await expect(${selector}).toHaveCount(${assertion.expected});`;

      default:
        return `// Unknown assertion: ${assertion.type}`;
    }
  }

  /**
   * Escape strings for code generation
   */
  escapeString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  /**
   * Indent code block
   */
  indent(code: string, spaces: number): string {
    const indent = ' '.repeat(spaces);
    return code.split('\n').map(line => (line.trim() ? indent + line : line)).join('\n');
  }
}

export const codeTemplates = new CodeTemplates();
