import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger.js';
import { DevicePresets } from './DevicePresets.js';
import type {
  BrowserConfig,
  MatrixEntry,
  MatrixResult,
  MatrixSummary,
  MatrixRequest,
  BrowserType,
} from './types.js';

export class BrowserMatrixEngine {
  private maxConcurrentTests: number = 4;

  createMatrix(request: MatrixRequest): MatrixEntry[] {
    const matrix: MatrixEntry[] = [];
    const presets = request.devicePresets || [];
    const browsers = request.browsers || [{ type: 'chromium' as BrowserType }];

    for (const browser of browsers) {
      if (presets.length === 0) {
        const entry: MatrixEntry = {
          id: uuidv4(),
          testId: request.testId,
          browser,
        };
        matrix.push(entry);
      } else {
        for (const presetName of presets) {
          const preset = DevicePresets.getPreset(presetName);
          if (!preset) continue;

          const entry: MatrixEntry = {
            id: uuidv4(),
            testId: request.testId,
            browser: {
              ...browser,
              viewport: preset.viewport,
              deviceEmulation: preset,
            },
            devicePreset: presetName,
          };
          matrix.push(entry);
        }
      }
    }

    logger.info(`Created matrix with ${matrix.length} entries`, {
      testId: request.testId,
      browsers: browsers.length,
      presets: presets.length,
    });

    return matrix;
  }

  async executeMatrix(matrix: MatrixEntry[]): Promise<MatrixResult[]> {
    const results: MatrixResult[] = [];
    const concurrency = Math.min(this.maxConcurrentTests, matrix.length);

    let index = 0;
    const workers: Promise<void>[] = [];

    for (let i = 0; i < concurrency; i++) {
      const worker = this.executeWorker(matrix, results, index);
      workers.push(worker);
      index++;
    }

    await Promise.all(workers);
    return results;
  }

  private async executeWorker(
    matrix: MatrixEntry[],
    results: MatrixResult[],
    startIndex: number,
  ): Promise<void> {
    let index = startIndex;
    while (index < matrix.length) {
      const entry = matrix[index];
      try {
        const result = await this.executeEntry(entry);
        results.push(result);
        logger.info(`Matrix entry completed: ${entry.id}`, {
          testId: entry.testId,
          browser: entry.browser.type,
          passed: result.passed,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          entryId: entry.id,
          testId: entry.testId,
          browser: entry.browser.type,
          deviceName: entry.devicePreset,
          startTime: Date.now(),
          endTime: Date.now(),
          durationMs: 0,
          passed: false,
          status: 'failed',
          errorMessage: errorMsg,
        });
        logger.error(`Matrix entry failed: ${entry.id}`, { error: errorMsg });
      }
      index += this.maxConcurrentTests;
    }
  }

  private async executeEntry(entry: MatrixEntry): Promise<MatrixResult> {
    const startTime = Date.now();

    // Simulate test execution with browser and device preset
    // In production, this would launch Playwright with the appropriate browser and device config
    const executionDuration = Math.random() * 5000 + 2000; // 2-7 seconds
    await new Promise((resolve) => setTimeout(resolve, executionDuration));

    // Simulate pass/fail with 80% pass rate
    const passed = Math.random() < 0.8;

    return {
      entryId: entry.id,
      testId: entry.testId,
      browser: entry.browser.type,
      deviceName: entry.devicePreset,
      viewport: entry.browser.viewport,
      startTime,
      endTime: Date.now(),
      durationMs: Date.now() - startTime,
      passed,
      status: passed ? 'passed' : 'failed',
      screenshotPath: `/screenshots/${entry.id}.png`,
      errorMessage: passed ? undefined : 'Element not found after 5 seconds',
      logs: [
        `Navigating to test URL with ${entry.browser.type} on ${entry.devicePreset || 'default'}`,
        `Executing test steps...`,
        `Test ${passed ? 'passed' : 'failed'}`,
      ],
      assertions: [
        {
          name: 'Page title visible',
          expected: true,
          actual: passed,
          passed,
        },
      ],
    };
  }

  getMatrixSummary(results: MatrixResult[]): MatrixSummary {
    const totalEntries = results.length;
    const passedEntries = results.filter((r) => r.passed).length;
    const failedEntries = results.filter((r) => !r.passed && r.status !== 'skipped').length;
    const skippedEntries = results.filter((r) => r.status === 'skipped').length;

    const startTime = Math.min(...results.map((r) => r.startTime));
    const endTime = Math.max(...results.map((r) => r.endTime));

    const failureDetails = results
      .filter((r) => !r.passed && r.errorMessage)
      .map((r) => ({
        browser: r.browser,
        error: r.errorMessage || 'Unknown error',
      }));

    return {
      totalEntries,
      passedEntries,
      failedEntries,
      skippedEntries,
      passRate: totalEntries > 0 ? (passedEntries / totalEntries) * 100 : 0,
      totalDurationMs: endTime - startTime,
      startTime,
      endTime,
      results,
      failureDetails,
    };
  }
}

export const browserMatrixEngine = new BrowserMatrixEngine();
