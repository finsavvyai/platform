/**
 * Recording Page Object Model
 * Page object for test recording functionality
 */

import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { BrowserAutomationUtils, InteractionRecorder } from '../utils/BrowserAutomationUtils';

export class RecordingPage extends BasePage {
  private automationUtils: BrowserAutomationUtils;
  private recorder?: InteractionRecorder;

  // Selectors
  private readonly startRecordingButton = '[data-testid=start-recording]';
  private readonly stopRecordingButton = '[data-testid=stop-recording]';
  private readonly recordingIndicator = '[data-testid=recording-indicator]';
  private readonly testNameInput = '[data-testid=test-name]';
  private readonly saveTestButton = '[data-testid=save-test]';
  private readonly runTestButton = '[data-testid=run-test]';
  private readonly testResults = '[data-testid=test-results]';
  private readonly recordedActions = '[data-testid=recorded-actions]';
  private readonly actionsList = '[data-testid=actions-list]';
  private readonly assertionsList = '[data-testid=assertions-list]';
  private readonly addAssertionButton = '[data-testid=add-assertion]';
  private readonly parameterizeButton = '[data-testid=parameterize]';
  private readonly exportTestButton = '[data-testid=export-test]';

  constructor(page: Page) {
    super(page, '/recording');
    this.automationUtils = new BrowserAutomationUtils(page);
  }

  // Recording Controls
  async startRecording(): Promise<void> {
    await this.clickElement(this.startRecordingButton);
    await this.expectElementToBeVisible(this.recordingIndicator);
    this.recorder = await this.automationUtils.startRecording();
  }

  async stopRecording(): Promise<void> {
    await this.clickElement(this.stopRecordingButton);
    await this.expectElementToBeHidden(this.recordingIndicator);
    
    if (this.recorder) {
      const actions = await this.recorder.stop();
      console.log('Recorded actions:', actions);
    }
  }

  async isRecording(): Promise<boolean> {
    return await this.isElementVisible(this.recordingIndicator);
  }

  // Test Management
  async saveTest(testName: string): Promise<void> {
    await this.fillInput(this.testNameInput, testName);
    await this.clickElement(this.saveTestButton);
    await this.waitForResponse(/\/api\/tests/, 10000);
  }

  async runTest(): Promise<void> {
    await this.clickElement(this.runTestButton);
    await this.expectElementToBeVisible(this.testResults);
  }

  async getRecordedActions(): Promise<string[]> {
    const actionElements = await this.page.locator(`${this.actionsList} .action-item`).all();
    const actions: string[] = [];
    
    for (const element of actionElements) {
      const actionText = await element.textContent();
      if (actionText) {
        actions.push(actionText.trim());
      }
    }
    
    return actions;
  }

  async getAssertions(): Promise<string[]> {
    const assertionElements = await this.page.locator(`${this.assertionsList} .assertion-item`).all();
    const assertions: string[] = [];
    
    for (const element of assertionElements) {
      const assertionText = await element.textContent();
      if (assertionText) {
        assertions.push(assertionText.trim());
      }
    }
    
    return assertions;
  }

  // Assertion Management
  async addAssertion(type: 'text' | 'visibility' | 'value', selector: string, expected: string): Promise<void> {
    await this.clickElement(this.addAssertionButton);
    
    // Fill assertion form (assuming a modal opens)
    await this.selectOption('[data-testid=assertion-type]', type);
    await this.fillInput('[data-testid=assertion-selector]', selector);
    await this.fillInput('[data-testid=assertion-expected]', expected);
    await this.clickElement('[data-testid=save-assertion]');
  }

  async removeAssertion(index: number): Promise<void> {
    await this.clickElement(`[data-testid=remove-assertion-${index}]`);
  }

  // Parameterization
  async parameterizeInput(selector: string, parameterName: string): Promise<void> {
    // Select the input element
    await this.clickElement(`[data-testid=action-item][data-selector="${selector}"]`);
    await this.clickElement(this.parameterizeButton);
    
    // Set parameter name
    await this.fillInput('[data-testid=parameter-name]', parameterName);
    await this.clickElement('[data-testid=save-parameter]');
  }

  async setTestData(parameters: Record<string, string>): Promise<void> {
    await this.clickElement('[data-testid=test-data-tab]');
    
    for (const [paramName, value] of Object.entries(parameters)) {
      await this.fillInput(`[data-testid=param-${paramName}]`, value);
    }
  }

  // Test Export
  async exportTest(format: 'playwright' | 'cypress' | 'selenium'): Promise<void> {
    await this.clickElement(this.exportTestButton);
    await this.selectOption('[data-testid=export-format]', format);
    await this.clickElement('[data-testid=confirm-export]');
  }

  // Advanced Recording Features
  async recordWithScreenshots(): Promise<void> {
    await this.clickElement('[data-testid=enable-screenshots]');
    await this.startRecording();
  }

  async recordWithNetworkCapture(): Promise<void> {
    await this.clickElement('[data-testid=enable-network-capture]');
    await this.startRecording();
  }

  async pauseRecording(): Promise<void> {
    await this.clickElement('[data-testid=pause-recording]');
  }

  async resumeRecording(): Promise<void> {
    await this.clickElement('[data-testid=resume-recording]');
  }

  // Smart Selector Generation
  async generateSmartSelectors(element: Locator): Promise<string[]> {
    const strategies = await this.automationUtils.generateSelectorStrategies(element);
    return strategies.map(strategy => strategy.value);
  }

  // Test Validation
  async validateTest(): Promise<boolean> {
    await this.clickElement('[data-testid=validate-test]');
    
    // Wait for validation to complete
    await this.waitForElement('[data-testid=validation-results]');
    
    const validationStatus = await this.getElementText('[data-testid=validation-status]');
    return validationStatus === 'valid';
  }

  async getValidationErrors(): Promise<string[]> {
    const errorElements = await this.page.locator('[data-testid=validation-error]').all();
    const errors: string[] = [];
    
    for (const element of errorElements) {
      const errorText = await element.textContent();
      if (errorText) {
        errors.push(errorText.trim());
      }
    }
    
    return errors;
  }

  // Test Execution Results
  async getTestExecutionResults(): Promise<TestExecutionResult> {
    await this.waitForElement(this.testResults);
    
    const status = await this.getElementText('[data-testid=execution-status]');
    const duration = await this.getElementText('[data-testid=execution-duration]');
    const passedSteps = await this.getElementText('[data-testid=passed-steps]');
    const failedSteps = await this.getElementText('[data-testid=failed-steps]');
    
    return {
      status: status as 'passed' | 'failed' | 'running',
      duration: parseInt(duration) || 0,
      passedSteps: parseInt(passedSteps) || 0,
      failedSteps: parseInt(failedSteps) || 0
    };
  }

  async getExecutionLogs(): Promise<string[]> {
    const logElements = await this.page.locator('[data-testid=execution-log] .log-entry').all();
    const logs: string[] = [];
    
    for (const element of logElements) {
      const logText = await element.textContent();
      if (logText) {
        logs.push(logText.trim());
      }
    }
    
    return logs;
  }

  // Browser-specific Recording
  async recordInMultipleBrowsers(browsers: string[]): Promise<void> {
    await this.clickElement('[data-testid=multi-browser-recording]');
    
    for (const browser of browsers) {
      await this.clickElement(`[data-testid=browser-${browser}]`);
    }
    
    await this.clickElement('[data-testid=start-multi-browser-recording]');
  }

  // Mobile Recording
  async recordMobileInteractions(device: string): Promise<void> {
    await this.clickElement('[data-testid=mobile-recording]');
    await this.selectOption('[data-testid=device-selector]', device);
    await this.startRecording();
  }

  // Performance Recording
  async recordWithPerformanceMetrics(): Promise<void> {
    await this.clickElement('[data-testid=enable-performance-metrics]');
    await this.startRecording();
  }

  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const monitor = await this.automationUtils.startPerformanceMonitoring();
    return await monitor.getMetrics();
  }
}

// Types
export interface TestExecutionResult {
  status: 'passed' | 'failed' | 'running';
  duration: number;
  passedSteps: number;
  failedSteps: number;
}

export interface PerformanceMetrics {
  domContentLoaded: number;
  loadComplete: number;
  firstPaint: number;
  firstContentfulPaint: number;
  totalLoadTime: number;
}