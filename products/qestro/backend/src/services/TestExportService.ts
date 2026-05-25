import { RecordedAction, WebRecordingSession } from '../types/recording.js';
import yaml from 'js-yaml';

export interface ExportOptions {
  format: 'puppeteer' | 'playwright' | 'cypress' | 'selenium' | 'yaml' | 'workflow-use';
  url?: string;
  viewport?: { width: number; height: number };
  name?: string;
  waitStrategy?: 'fixed' | 'smart' | 'none';
  includeAssertions?: boolean;
}

export class TestExportService {

  exportRecording(session: WebRecordingSession, options: ExportOptions): string {
    const { format } = options;
    const actions = this.optimizeActions(session.actions, options);

    switch (format) {
      case 'puppeteer':
        return this.exportToPuppeteer(actions, options);
      case 'playwright':
        return this.exportToPlaywright(actions, options);
      case 'cypress':
        return this.exportToCypress(actions, options);
      case 'selenium':
        return this.exportToSelenium(actions, options);
      case 'yaml':
      case 'workflow-use':
        return this.exportToWorkflowYAML(actions, options);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private optimizeActions(actions: RecordedAction[], options: ExportOptions): RecordedAction[] {
    let optimized = [...actions];

    // Remove duplicate actions
    optimized = this.removeDuplicateActions(optimized);

    // Add smart waits if enabled
    if (options.waitStrategy === 'smart') {
      optimized = this.addSmartWaits(optimized);
    }

    // Add assertions if enabled
    if (options.includeAssertions) {
      optimized = this.addSmartAssertions(optimized);
    }

    return optimized;
  }

  private removeDuplicateActions(actions: RecordedAction[]): RecordedAction[] {
    const filtered: RecordedAction[] = [];
    let lastAction: RecordedAction | null = null;

    for (const action of actions) {
      // Skip rapid duplicate clicks on same element
      if (
        lastAction &&
        action.type === 'click' &&
        lastAction.type === 'click' &&
        action.selector === lastAction.selector &&
        action.timestamp - lastAction.timestamp < 500
      ) {
        continue;
      }

      // Skip rapid input events on same element (keep only the last one)
      if (
        lastAction &&
        action.type === 'input' &&
        lastAction.type === 'input' &&
        action.selector === lastAction.selector &&
        action.timestamp - lastAction.timestamp < 1000
      ) {
        filtered.pop(); // Remove previous input
      }

      filtered.push(action);
      lastAction = action;
    }

    return filtered;
  }

  private addSmartWaits(actions: RecordedAction[]): RecordedAction[] {
    const result: RecordedAction[] = [];

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const nextAction = actions[i + 1];

      result.push(action);

      // Add wait after navigation
      if (action.type === 'navigation') {
        result.push({
          id: `wait_${Date.now()}`,
          type: 'wait',
          timestamp: action.timestamp + 1,
          duration: 2000,
          reason: 'page_load'
        });
      }

      // Add wait after form submission
      if (action.type === 'submit') {
        result.push({
          id: `wait_${Date.now()}`,
          type: 'wait',
          timestamp: action.timestamp + 1,
          duration: 3000,
          reason: 'form_submission'
        });
      }

      // Add wait if there's a long gap between actions
      if (nextAction && nextAction.timestamp - action.timestamp > 2000) {
        result.push({
          id: `wait_${Date.now()}`,
          type: 'wait',
          timestamp: action.timestamp + 1,
          duration: Math.min(nextAction.timestamp - action.timestamp, 5000),
          reason: 'user_pause'
        });
      }
    }

    return result;
  }

  private addSmartAssertions(actions: RecordedAction[]): RecordedAction[] {
    const result: RecordedAction[] = [];

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      result.push(action);

      // Add assertion after navigation
      if (action.type === 'navigation') {
        result.push({
          id: `assert_${Date.now()}`,
          type: 'assert',
          timestamp: action.timestamp + 1,
          selector: 'body',
          assertion: { type: 'visible', value: true },
          reason: 'page_loaded'
        });
      }

      // Add assertion after form submission
      if (action.type === 'submit') {
        result.push({
          id: `assert_${Date.now()}`,
          type: 'assert',
          timestamp: action.timestamp + 1,
          selector: 'body',
          assertion: { type: 'url_contains', value: 'success' },
          reason: 'form_submitted'
        });
      }

      // Add assertion after important clicks (buttons)
      if (action.type === 'click' && typeof action.element === 'string' && action.element.includes('BUTTON')) {
        result.push({
          id: `assert_${Date.now()}`,
          type: 'assert',
          timestamp: action.timestamp + 1,
          selector: action.selector as string,
          assertion: { type: 'visible', value: true },
          reason: 'element_interaction'
        });
      }
    }

    return result;
  }

  private exportToPuppeteer(actions: RecordedAction[], options: ExportOptions): string {
    const { url, viewport = { width: 1920, height: 1080 }, name = 'Recorded Test' } = options;

    let script = `// ${name} - Generated by Questro
// Recorded: ${new Date().toISOString()}

const puppeteer = require('puppeteer');

(async () => {
  console.log('Starting ${name}...');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });
  
  const page = await browser.newPage();
  await page.setViewport(${JSON.stringify(viewport)});
  
  try {
`;

    if (url) {
      script += `    // Navigate to initial URL\n`;
      script += `    console.log('Navigating to ${url}');\n`;
      script += `    await page.goto('${url}', { waitUntil: 'networkidle2' });\n\n`;
    }

    actions.forEach((action, index) => {
      script += `    // Step ${index + 1}: ${this.getActionDescription(action)}\n`;

      switch (action.type) {
        case 'click':
          const selector = this.getSelectorString(action.selector);
          script += `    console.log('Clicking: ${selector}');\n`;
          script += `    await page.waitForSelector('${selector}', { visible: true });\n`;
          script += `    await page.click('${selector}');\n`;
          break;

        case 'input':
          const inputSelector = this.getSelectorString(action.selector);
          script += `    console.log('Typing in: ${inputSelector}');\n`;
          script += `    await page.waitForSelector('${inputSelector}', { visible: true });\n`;
          script += `    await page.click('${inputSelector}');\n`;
          script += `    await page.keyboard.down('Control');\n`;
          script += `    await page.keyboard.press('KeyA');\n`;
          script += `    await page.keyboard.up('Control');\n`;
          script += `    await page.type('${inputSelector}', '${action.text?.replace(/'/g, "\\'")}');\n`;
          break;

        case 'navigation':
          script += `    console.log('Navigating to: ${action.url}');\n`;
          script += `    await page.goto('${action.url}', { waitUntil: 'networkidle2' });\n`;
          break;

        case 'scroll':
          script += `    console.log('Scrolling page');\n`;
          script += `    await page.evaluate(() => window.scrollTo(${action.scrollX || 0}, ${action.scrollY || 0}));\n`;
          break;

        case 'wait':
          script += `    console.log('Waiting ${action.duration}ms');\n`;
          script += `    await page.waitForTimeout(${action.duration});\n`;
          break;

        case 'assert':
          const assertSelector = this.getSelectorString(action.selector);
          script += `    console.log('Asserting: ${assertSelector}');\n`;
          if (action.assertion?.type === 'visible') {
            script += `    await page.waitForSelector('${assertSelector}', { visible: true });\n`;
          } else if (action.assertion?.type === 'text_contains') {
            script += `    const element = await page.waitForSelector('${assertSelector}');\n`;
            script += `    const text = await element.textContent();\n`;
            script += `    if (!text.includes('${action.assertion.value}')) throw new Error('Text assertion failed');\n`;
          }
          break;

        case 'submit':
          const formSelector = this.getSelectorString(action.selector);
          script += `    console.log('Submitting form: ${formSelector}');\n`;
          script += `    await page.click('${formSelector} [type="submit"], ${formSelector} button[type="submit"]');\n`;
          break;
      }

      script += '\n';
    });

    script += `    console.log('${name} completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error);
    await page.screenshot({ path: 'error-screenshot.png' });
    throw error;
  } finally {
    await browser.close();
  }
})();`;

    return script;
  }

  private exportToPlaywright(actions: RecordedAction[], options: ExportOptions): string {
    const { url, viewport = { width: 1920, height: 1080 }, name = 'Recorded Test' } = options;

    let script = `// ${name} - Generated by Questro
// Recorded: ${new Date().toISOString()}

const { chromium } = require('playwright');

(async () => {
  console.log('Starting ${name}...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: ${JSON.stringify(viewport)}
  });
  const page = await context.newPage();
  
  try {
`;

    if (url) {
      script += `    // Navigate to initial URL\n`;
      script += `    console.log('Navigating to ${url}');\n`;
      script += `    await page.goto('${url}');\n\n`;
    }

    actions.forEach((action, index) => {
      script += `    // Step ${index + 1}: ${this.getActionDescription(action)}\n`;

      switch (action.type) {
        case 'click':
          const selector = this.getSelectorString(action.selector);
          script += `    console.log('Clicking: ${selector}');\n`;
          script += `    await page.click('${selector}');\n`;
          break;

        case 'input':
          const inputSelector = this.getSelectorString(action.selector);
          script += `    console.log('Filling: ${inputSelector}');\n`;
          script += `    await page.fill('${inputSelector}', '${action.text?.replace(/'/g, "\\'")}');\n`;
          break;

        case 'navigation':
          script += `    console.log('Navigating to: ${action.url}');\n`;
          script += `    await page.goto('${action.url}');\n`;
          break;

        case 'scroll':
          script += `    console.log('Scrolling page');\n`;
          script += `    await page.evaluate(() => window.scrollTo(${action.scrollX || 0}, ${action.scrollY || 0}));\n`;
          break;

        case 'wait':
          script += `    console.log('Waiting ${action.duration}ms');\n`;
          script += `    await page.waitForTimeout(${action.duration});\n`;
          break;

        case 'assert':
          const assertSelector = this.getSelectorString(action.selector);
          script += `    console.log('Asserting: ${assertSelector}');\n`;
          if (action.assertion?.type === 'visible') {
            script += `    await expect(page.locator('${assertSelector}')).toBeVisible();\n`;
          } else if (action.assertion?.type === 'text_contains') {
            script += `    await expect(page.locator('${assertSelector}')).toContainText('${action.assertion.value}');\n`;
          }
          break;
      }

      script += '\n';
    });

    script += `    console.log('${name} completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error);
    await page.screenshot({ path: 'error-screenshot.png' });
    throw error;
  } finally {
    await browser.close();
  }
})();`;

    return script;
  }

  private exportToCypress(actions: RecordedAction[], options: ExportOptions): string {
    const { url, name = 'Recorded Test' } = options;

    let script = `// ${name} - Generated by Questro
// Recorded: ${new Date().toISOString()}

describe('${name}', () => {
  it('should complete recorded user flow', () => {
`;

    if (url) {
      script += `    // Navigate to initial URL\n`;
      script += `    cy.visit('${url}');\n\n`;
    }

    actions.forEach((action, index) => {
      script += `    // Step ${index + 1}: ${this.getActionDescription(action)}\n`;

      switch (action.type) {
        case 'click':
          const selector = this.getSelectorString(action.selector);
          script += `    cy.get('${selector}').click();\n`;
          break;

        case 'input':
          const inputSelector = this.getSelectorString(action.selector);
          script += `    cy.get('${inputSelector}').clear().type('${action.text?.replace(/'/g, "\\'")}');\n`;
          break;

        case 'navigation':
          script += `    cy.visit('${action.url}');\n`;
          break;

        case 'scroll':
          script += `    cy.scrollTo(${action.scrollX || 0}, ${action.scrollY || 0});\n`;
          break;

        case 'wait':
          script += `    cy.wait(${action.duration});\n`;
          break;

        case 'assert':
          const assertSelector = this.getSelectorString(action.selector);
          if (action.assertion?.type === 'visible') {
            script += `    cy.get('${assertSelector}').should('be.visible');\n`;
          } else if (action.assertion?.type === 'text_contains') {
            script += `    cy.get('${assertSelector}').should('contain.text', '${action.assertion.value}');\n`;
          }
          break;
      }

      script += '\n';
    });

    script += `  });
});`;

    return script;
  }

  private exportToSelenium(actions: RecordedAction[], options: ExportOptions): string {
    const { url, name = 'Recorded Test' } = options;

    let script = `// ${name} - Generated by Questro
// Recorded: ${new Date().toISOString()}

const { Builder, By, until } = require('selenium-webdriver');

(async function example() {
  let driver = await new Builder().forBrowser('chrome').build();
  
  try {
`;

    if (url) {
      script += `    // Navigate to initial URL\n`;
      script += `    await driver.get('${url}');\n\n`;
    }

    actions.forEach((action, index) => {
      script += `    // Step ${index + 1}: ${this.getActionDescription(action)}\n`;

      switch (action.type) {
        case 'click':
          const selector = this.getSelectorString(action.selector);
          script += `    await driver.wait(until.elementLocated(By.css('${selector}')), 10000);\n`;
          script += `    await driver.findElement(By.css('${selector}')).click();\n`;
          break;

        case 'input':
          const inputSelector = this.getSelectorString(action.selector);
          script += `    await driver.wait(until.elementLocated(By.css('${inputSelector}')), 10000);\n`;
          script += `    await driver.findElement(By.css('${inputSelector}')).clear();\n`;
          script += `    await driver.findElement(By.css('${inputSelector}')).sendKeys('${action.text?.replace(/'/g, "\\'")}');\n`;
          break;

        case 'navigation':
          script += `    await driver.get('${action.url}');\n`;
          break;

        case 'wait':
          script += `    await driver.sleep(${action.duration});\n`;
          break;
      }

      script += '\n';
    });

    script += `  } finally {
    await driver.quit();
  }
})();`;

    return script;
  }

  private exportToWorkflowYAML(actions: RecordedAction[], options: ExportOptions): string {
    const { url, name = 'Recorded Test', viewport = { width: 1920, height: 1080 } } = options;

    const yamlData = {
      name,
      description: `Generated by Questro on ${new Date().toISOString()}`,
      ...(url && { url }),
      viewport,
      steps: actions.map((action, index) => {
        const step: any = {
          name: `Step ${index + 1}: ${this.getActionDescription(action)}`,
        };

        switch (action.type) {
          case 'click':
            step.click = {
              selector: this.getSelectorString(action.selector),
              ...(typeof action.element === 'object' && action.element?.text && { text: action.element.text }),
              coordinates: action.coordinates
            };
            break;

          case 'input':
            step.type = {
              selector: this.getSelectorString(action.selector),
              text: action.text,
              ...(typeof action.element === 'object' && action.element?.placeholder && { placeholder: action.element.placeholder })
            };
            break;

          case 'navigation':
            step.navigate = {
              url: action.url
            };
            break;

          case 'scroll':
            step.scroll = {
              x: action.scrollX,
              y: action.scrollY
            };
            break;

          case 'wait':
            step.wait = {
              duration: action.duration,
              ...(action.reason && { reason: action.reason })
            };
            break;

          case 'assert':
            step.assert = {
              selector: this.getSelectorString(action.selector),
              condition: action.assertion?.type,
              value: action.assertion?.value
            };
            break;

          case 'submit':
            step.submit = {
              selector: this.getSelectorString(action.selector)
            };
            break;
        }

        return step;
      })
    };

    return yaml.dump(yamlData, {
      indent: 2,
      lineWidth: 120,
      noRefs: true
    });
  }

  private getSelectorString(selector: any): string {
    if (typeof selector === 'string') return selector;
    if (selector?.primary) return selector.primary;
    return 'body'; // fallback
  }

  private getActionDescription(action: RecordedAction): string {
    switch (action.type) {
      case 'click':
        const elementText = typeof action.element === 'object' ? action.element?.text : action.element;
        return `Click ${elementText ? `"${elementText}"` : 'element'}`;
      case 'input':
        return `Type "${action.text}" in input field`;
      case 'navigation':
        return `Navigate to ${action.url}`;
      case 'scroll':
        return 'Scroll page';
      case 'wait':
        return `Wait ${action.duration}ms`;
      case 'assert':
        return `Assert element ${action.assertion?.type}`;
      case 'submit':
        return 'Submit form';
      default:
        return action.type;
    }
  }
}

export const testExportService = new TestExportService();