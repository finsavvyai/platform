'use strict';

import {
  chromium,
  firefox,
  webkit,
  Browser,
  BrowserContext,
  Page,
} from 'playwright';
import { TestCase, TestResult } from './TestExecutionEngine';
import {
  attachConsoleListener,
  attachNetworkListener,
  compileTestCode,
  captureFailureScreenshot,
  ensureScreenshotsDir,
  captureScreenshot as utilCaptureScreenshot,
} from './playwright-runner-utils';
import { TraceBuilder, traced } from '../lib/tracing.js';

export interface ITestRunner {
  execute(testCase: TestCase): Promise<TestResult>;
  validateEnvironment(): Promise<void>;
  captureScreenshot(name: string): Promise<Buffer>;
}

export interface RunnerConfig {
  headless?: boolean;
  screenshotsDir?: string;
  slowMo?: number;
  timeout?: number;
}

/**
 * Playwright Test Runner - executes real browser automation tests
 */
export class PlaywrightRunnerService implements ITestRunner {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private consoleLogs: string[] = [];
  private networkRequests: Array<{ url: string; method: string; status?: number }> = [];
  private startMemory: number = 0;
  private trace: TraceBuilder | null = null;

  constructor(private config: RunnerConfig = {}) {
    this.config = {
      headless: config.headless ?? true,
      screenshotsDir: config.screenshotsDir ?? './screenshots',
      slowMo: config.slowMo ?? 0,
      timeout: config.timeout ?? 30000,
    };
    ensureScreenshotsDir(this.config.screenshotsDir!);
  }

  async validateEnvironment(): Promise<void> {
    try {
      const browser = await chromium.launch();
      await browser.close();
    } catch (error) {
      throw new Error(`Playwright validation failed: ${error}`);
    }
  }

  async execute(testCase: TestCase): Promise<TestResult> {
    const startTime = new Date();
    this.startMemory = process.memoryUsage().heapUsed;
    this.consoleLogs = [];
    this.networkRequests = [];
    this.trace = new TraceBuilder(`test:${testCase.id}`);

    try {
      const browserType = testCase.config?.browserType || 'chromium';

      await traced(this.trace, 'browser:launch', 'browser',
        () => this.launchBrowser(browserType as string),
        { browserType });

      await traced(this.trace, 'context:create', 'browser', async () => {
        this.context = await this.browser!.newContext();
        this.page = await this.context.newPage();
      });

      attachConsoleListener(this.page!, this.consoleLogs);
      attachNetworkListener(this.page!, this.networkRequests);
      this.page!.setDefaultTimeout(testCase.timeout || this.config.timeout);

      await traced(this.trace, 'test:execute', 'test', async () => {
        const testFn = compileTestCode(testCase.code);
        await testFn(this.page!);
      }, { testId: testCase.id });

      return this.buildResult(testCase.id, 'passed', startTime);
    } catch (error: unknown) {
      this.trace?.instant('test:failed', 'test', {
        error: error instanceof Error ? error.message : String(error),
      });
      const screenshots = await captureFailureScreenshot(
        this.page,
        testCase.id,
        this.config.screenshotsDir!,
        this.consoleLogs
      );
      return this.buildResult(testCase.id, 'failed', startTime, error, screenshots);
    } finally {
      await this.cleanup();
    }
  }

  /** Get the last execution trace as Perfetto-compatible JSON */
  getTrace(): string | null {
    return this.trace?.toString() || null;
  }

  private buildResult(
    testId: string,
    status: 'passed' | 'failed',
    startTime: Date,
    error?: unknown,
    screenshots?: string[]
  ): TestResult {
    const endTime = new Date();
    const endMemory = process.memoryUsage().heapUsed;
    const result: TestResult = {
      testId,
      status,
      duration: endTime.getTime() - startTime.getTime(),
      startTime,
      endTime,
      logs: this.consoleLogs,
      metrics: {
        memory: endMemory - this.startMemory,
        cpu: process.cpuUsage().user,
        network: this.networkRequests.length,
      },
    };

    if (error) {
      result.error = error instanceof Error ? error.message : String(error);
      result.stackTrace = error instanceof Error ? error.stack : undefined;
      result.screenshots = screenshots;
    }

    return result;
  }

  private async launchBrowser(browserType: string): Promise<void> {
    const opts = { headless: this.config.headless, slowMo: this.config.slowMo };

    switch (browserType.toLowerCase()) {
      case 'firefox':
        this.browser = await firefox.launch(opts);
        break;
      case 'webkit':
        this.browser = await webkit.launch(opts);
        break;
      default:
        this.browser = await chromium.launch(opts);
    }
  }

  async captureScreenshot(name: string): Promise<Buffer> {
    return utilCaptureScreenshot(this.page, name, this.config.screenshotsDir!);
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      this.page = null;
    } catch (error) {
      this.consoleLogs.push(`Cleanup error: ${error}`);
    }
  }
}

let instance: PlaywrightRunnerService;

export function getPlaywrightRunner(config?: RunnerConfig): PlaywrightRunnerService {
  if (!instance) instance = new PlaywrightRunnerService(config);
  return instance;
}

export default getPlaywrightRunner();
