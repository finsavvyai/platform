/**
 * Test Management Page Object Model
 * Page object for managing test suites and test execution
 */

import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { BrowserAutomationUtils } from '../utils/BrowserAutomationUtils';

export class TestManagementPage extends BasePage {
  private automationUtils: BrowserAutomationUtils;

  // Selectors
  private readonly createTestButton = '[data-testid=create-test]';
  private readonly testsList = '[data-testid=tests-list]';
  private readonly testItem = '[data-testid=test-item]';
  private readonly runAllTestsButton = '[data-testid=run-all-tests]';
  private readonly testSuiteSelector = '[data-testid=test-suite-selector]';
  private readonly filterInput = '[data-testid=filter-tests]';
  private readonly sortSelector = '[data-testid=sort-tests]';
  private readonly bulkActionsButton = '[data-testid=bulk-actions]';
  private readonly exportTestsButton = '[data-testid=export-tests]';
  private readonly importTestsButton = '[data-testid=import-tests]';
  private readonly testExecutionHistory = '[data-testid=execution-history]';
  private readonly testMetrics = '[data-testid=test-metrics]';

  constructor(page: Page) {
    super(page, '/tests');
    this.automationUtils = new BrowserAutomationUtils(page);
  }

  // Test Creation
  async createNewTest(): Promise<void> {
    await this.clickElement(this.createTestButton);
    await this.waitForUrl(/.*\/recording/);
  }

  async createTestFromTemplate(templateName: string): Promise<void> {
    await this.clickElement('[data-testid=create-from-template]');
    await this.selectOption('[data-testid=template-selector]', templateName);
    await this.clickElement('[data-testid=use-template]');
  }

  // Test Management
  async getTestsList(): Promise<TestInfo[]> {
    const testElements = await this.page.locator(`${this.testsList} ${this.testItem}`).all();
    const tests: TestInfo[] = [];

    for (const element of testElements) {
      const name = await element.locator('[data-testid=test-name]').textContent();
      const status = await element.locator('[data-testid=test-status]').textContent();
      const lastRun = await element.locator('[data-testid=last-run]').textContent();
      const duration = await element.locator('[data-testid=duration]').textContent();

      tests.push({
        name: name?.trim() || '',
        status: status?.trim() as TestStatus || 'unknown',
        lastRun: lastRun?.trim() || '',
        duration: duration?.trim() || ''
      });
    }

    return tests;
  }

  async selectTest(testName: string): Promise<void> {
    await this.clickElement(`[data-testid=test-item][data-test-name="${testName}"]`);
  }

  async selectMultipleTests(testNames: string[]): Promise<void> {
    for (const testName of testNames) {
      await this.clickElement(`[data-testid=test-checkbox][data-test-name="${testName}"]`);
    }
  }

  async deleteTest(testName: string): Promise<void> {
    await this.selectTest(testName);
    await this.clickElement('[data-testid=delete-test]');
    await this.clickElement('[data-testid=confirm-delete]');
  }

  async duplicateTest(testName: string, newName: string): Promise<void> {
    await this.selectTest(testName);
    await this.clickElement('[data-testid=duplicate-test]');
    await this.fillInput('[data-testid=new-test-name]', newName);
    await this.clickElement('[data-testid=confirm-duplicate]');
  }

  // Test Execution
  async runTest(testName: string): Promise<void> {
    await this.selectTest(testName);
    await this.clickElement('[data-testid=run-test]');
  }

  async runAllTests(): Promise<void> {
    await this.clickElement(this.runAllTestsButton);
  }

  async runTestSuite(suiteName: string): Promise<void> {
    await this.selectOption(this.testSuiteSelector, suiteName);
    await this.clickElement('[data-testid=run-suite]');
  }

  async runSelectedTests(): Promise<void> {
    await this.clickElement(this.bulkActionsButton);
    await this.clickElement('[data-testid=run-selected]');
  }

  async stopTestExecution(): Promise<void> {
    await this.clickElement('[data-testid=stop-execution]');
  }

  // Test Filtering and Sorting
  async filterTests(query: string): Promise<void> {
    await this.fillInput(this.filterInput, query);
    await this.waitForResponse(/\/api\/tests\?filter=/, 5000);
  }

  async sortTests(sortBy: 'name' | 'status' | 'lastRun' | 'duration'): Promise<void> {
    await this.selectOption(this.sortSelector, sortBy);
  }

  async filterByStatus(status: TestStatus): Promise<void> {
    await this.clickElement(`[data-testid=filter-status-${status}]`);
  }

  async filterByTag(tag: string): Promise<void> {
    await this.clickElement(`[data-testid=filter-tag-${tag}]`);
  }

  // Test Import/Export
  async exportTests(format: 'json' | 'csv' | 'xml'): Promise<void> {
    await this.clickElement(this.exportTestsButton);
    await this.selectOption('[data-testid=export-format]', format);
    await this.clickElement('[data-testid=confirm-export]');
  }

  async importTests(filePath: string): Promise<void> {
    await this.clickElement(this.importTestsButton);
    await this.uploadFile('[data-testid=import-file]', filePath);
    await this.clickElement('[data-testid=confirm-import]');
  }

  // Test Execution History
  async getExecutionHistory(testName: string): Promise<ExecutionHistoryItem[]> {
    await this.selectTest(testName);
    await this.clickElement('[data-testid=view-history]');
    
    const historyElements = await this.page.locator(`${this.testExecutionHistory} .history-item`).all();
    const history: ExecutionHistoryItem[] = [];

    for (const element of historyElements) {
      const timestamp = await element.locator('[data-testid=execution-timestamp]').textContent();
      const status = await element.locator('[data-testid=execution-status]').textContent();
      const duration = await element.locator('[data-testid=execution-duration]').textContent();
      const browser = await element.locator('[data-testid=execution-browser]').textContent();

      history.push({
        timestamp: timestamp?.trim() || '',
        status: status?.trim() as TestStatus || 'unknown',
        duration: duration?.trim() || '',
        browser: browser?.trim() || ''
      });
    }

    return history;
  }

  async viewExecutionDetails(executionId: string): Promise<void> {
    await this.clickElement(`[data-testid=execution-details-${executionId}]`);
  }

  // Test Metrics and Analytics
  async getTestMetrics(): Promise<TestMetrics> {
    await this.waitForElement(this.testMetrics);
    
    const totalTests = await this.getElementText('[data-testid=total-tests]');
    const passedTests = await this.getElementText('[data-testid=passed-tests]');
    const failedTests = await this.getElementText('[data-testid=failed-tests]');
    const averageDuration = await this.getElementText('[data-testid=average-duration]');
    const successRate = await this.getElementText('[data-testid=success-rate]');

    return {
      totalTests: parseInt(totalTests) || 0,
      passedTests: parseInt(passedTests) || 0,
      failedTests: parseInt(failedTests) || 0,
      averageDuration: parseFloat(averageDuration) || 0,
      successRate: parseFloat(successRate) || 0
    };
  }

  async getTestTrends(period: 'day' | 'week' | 'month'): Promise<TestTrend[]> {
    await this.selectOption('[data-testid=trend-period]', period);
    await this.waitForResponse(/\/api\/analytics\/trends/, 5000);
    
    const trendElements = await this.page.locator('[data-testid=trend-data] .trend-item').all();
    const trends: TestTrend[] = [];

    for (const element of trendElements) {
      const date = await element.locator('[data-testid=trend-date]').textContent();
      const passed = await element.locator('[data-testid=trend-passed]').textContent();
      const failed = await element.locator('[data-testid=trend-failed]').textContent();

      trends.push({
        date: date?.trim() || '',
        passed: parseInt(passed || '0'),
        failed: parseInt(failed || '0')
      });
    }

    return trends;
  }

  // Test Scheduling
  async scheduleTest(testName: string, schedule: TestSchedule): Promise<void> {
    await this.selectTest(testName);
    await this.clickElement('[data-testid=schedule-test]');
    
    await this.selectOption('[data-testid=schedule-frequency]', schedule.frequency);
    if (schedule.time) {
      await this.fillInput('[data-testid=schedule-time]', schedule.time);
    }
    if (schedule.days) {
      for (const day of schedule.days) {
        await this.clickElement(`[data-testid=schedule-day-${day}]`);
      }
    }
    
    await this.clickElement('[data-testid=save-schedule]');
  }

  async getScheduledTests(): Promise<ScheduledTest[]> {
    await this.clickElement('[data-testid=view-scheduled]');
    
    const scheduledElements = await this.page.locator('[data-testid=scheduled-test]').all();
    const scheduled: ScheduledTest[] = [];

    for (const element of scheduledElements) {
      const name = await element.locator('[data-testid=scheduled-test-name]').textContent();
      const frequency = await element.locator('[data-testid=scheduled-frequency]').textContent();
      const nextRun = await element.locator('[data-testid=next-run]').textContent();

      scheduled.push({
        name: name?.trim() || '',
        frequency: frequency?.trim() || '',
        nextRun: nextRun?.trim() || ''
      });
    }

    return scheduled;
  }

  // Test Environment Management
  async selectEnvironment(environment: string): Promise<void> {
    await this.selectOption('[data-testid=environment-selector]', environment);
  }

  async createEnvironment(name: string, config: EnvironmentConfig): Promise<void> {
    await this.clickElement('[data-testid=create-environment]');
    await this.fillInput('[data-testid=environment-name]', name);
    await this.fillInput('[data-testid=environment-url]', config.baseUrl);
    await this.fillInput('[data-testid=environment-api-url]', config.apiUrl);
    
    if (config.credentials) {
      await this.fillInput('[data-testid=environment-username]', config.credentials.username);
      await this.fillInput('[data-testid=environment-password]', config.credentials.password);
    }
    
    await this.clickElement('[data-testid=save-environment]');
  }

  // Parallel Execution
  async runTestsInParallel(testNames: string[], maxConcurrency: number = 3): Promise<void> {
    await this.selectMultipleTests(testNames);
    await this.clickElement(this.bulkActionsButton);
    await this.clickElement('[data-testid=run-parallel]');
    await this.fillInput('[data-testid=max-concurrency]', maxConcurrency.toString());
    await this.clickElement('[data-testid=start-parallel-execution]');
  }

  async getParallelExecutionStatus(): Promise<ParallelExecutionStatus> {
    const running = await this.getElementText('[data-testid=parallel-running]');
    const completed = await this.getElementText('[data-testid=parallel-completed]');
    const failed = await this.getElementText('[data-testid=parallel-failed]');
    const queued = await this.getElementText('[data-testid=parallel-queued]');

    return {
      running: parseInt(running) || 0,
      completed: parseInt(completed) || 0,
      failed: parseInt(failed) || 0,
      queued: parseInt(queued) || 0
    };
  }
}

// Types
export interface TestInfo {
  name: string;
  status: TestStatus;
  lastRun: string;
  duration: string;
}

export interface ExecutionHistoryItem {
  timestamp: string;
  status: TestStatus;
  duration: string;
  browser: string;
}

export interface TestMetrics {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  averageDuration: number;
  successRate: number;
}

export interface TestTrend {
  date: string;
  passed: number;
  failed: number;
}

export interface TestSchedule {
  frequency: 'daily' | 'weekly' | 'monthly';
  time?: string;
  days?: string[];
}

export interface ScheduledTest {
  name: string;
  frequency: string;
  nextRun: string;
}

export interface EnvironmentConfig {
  baseUrl: string;
  apiUrl: string;
  credentials?: {
    username: string;
    password: string;
  };
}

export interface ParallelExecutionStatus {
  running: number;
  completed: number;
  failed: number;
  queued: number;
}

export type TestStatus = 'passed' | 'failed' | 'running' | 'pending' | 'skipped' | 'unknown';