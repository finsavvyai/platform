'use strict';

import { v4 as uuidv4 } from 'uuid';
import { ScreenshotService } from './ScreenshotService.js';
import { ImageComparator } from './ImageComparator.js';
import { BaselineManager } from './BaselineManager.js';
import {
  VisualTestOptions,
  VisualTestResult,
  CaptureOptions,
  ComparisonOptions,
} from './types.js';
import { logger } from '../../utils/logger.js';

/**
 * Visual Regression Engine - Main orchestrator for visual testing
 */

class VisualRegressionEngine {
  private screenshotService: ScreenshotService;
  private imageComparator: ImageComparator;
  private baselineManager: BaselineManager;
  private results: Map<string, VisualTestResult> = new Map();

  constructor() {
    this.screenshotService = new ScreenshotService();
    this.imageComparator = new ImageComparator();
    this.baselineManager = new BaselineManager();
  }

  /**
   * Run a single visual test
   */
  async runVisualTest(options: VisualTestOptions): Promise<VisualTestResult> {
    const testId = uuidv4();
    const startTime = Date.now();

    try {
      logger.info('Starting visual test', {
        projectId: options.projectId,
        testName: options.baselineName,
        url: options.url,
      });

      // Capture current screenshot
      const captureOpts: CaptureOptions = {
        ...options.captureOptions,
        url: options.url,
      };
      const currentScreenshot = await this.screenshotService.captureScreenshot(captureOpts);

      // Try to get baseline
      const baselineScreenshot = await this.baselineManager.getBaseline(
        options.projectId,
        options.baselineName
      );

      let result: VisualTestResult;

      if (!baselineScreenshot) {
        // No baseline exists
        if (options.createIfMissing !== false) {
          // Create baseline
          await this.baselineManager.saveBaseline(
            options.projectId,
            options.baselineName,
            currentScreenshot
          );

          result = {
            id: testId,
            projectId: options.projectId,
            testName: options.baselineName,
            status: 'baseline-created',
            currentScreenshot,
            executedAt: new Date(),
            duration: Date.now() - startTime,
          };

          logger.info('Visual baseline created', {
            projectId: options.projectId,
            testName: options.baselineName,
            duration: result.duration,
          });
        } else {
          result = {
            id: testId,
            projectId: options.projectId,
            testName: options.baselineName,
            status: 'failed',
            currentScreenshot,
            error: 'Baseline not found and createIfMissing is false',
            executedAt: new Date(),
            duration: Date.now() - startTime,
          };
        }
      } else {
        // Compare against baseline
        const comparisonOpts: ComparisonOptions = options.comparisonOptions || {
          threshold: 0.1,
        };

        const comparison = await this.imageComparator.compareImages(
          baselineScreenshot,
          currentScreenshot,
          comparisonOpts
        );

        result = {
          id: testId,
          projectId: options.projectId,
          testName: options.baselineName,
          status: comparison.passed ? 'passed' : 'failed',
          comparison,
          currentScreenshot,
          baselineScreenshot,
          diffImage: comparison.diffImage,
          executedAt: new Date(),
          duration: Date.now() - startTime,
        };

        const status = comparison.passed ? 'passed' : 'FAILED';
        logger.info(`Visual test ${status}`, {
          projectId: options.projectId,
          testName: options.baselineName,
          mismatchPercentage: comparison.mismatchPercentage.toFixed(2),
          duration: result.duration,
        });
      }

      this.results.set(testId, result);
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const result: VisualTestResult = {
        id: testId,
        projectId: options.projectId,
        testName: options.baselineName,
        status: 'failed',
        currentScreenshot: Buffer.from(''),
        error: errorMsg,
        executedAt: new Date(),
        duration: Date.now() - startTime,
      };

      this.results.set(testId, result);
      logger.error('Visual test error', {
        projectId: options.projectId,
        testName: options.baselineName,
        error: errorMsg,
      });

      throw error;
    }
  }

  /**
   * Run batch visual tests
   */
  async runBatchVisualTests(
    projectId: string,
    tests: Array<{ url: string; name: string }>
  ): Promise<VisualTestResult[]> {
    logger.info('Starting batch visual tests', { projectId, testCount: tests.length });

    const results = await Promise.all(
      tests.map((test) =>
        this.runVisualTest({
          projectId,
          url: test.url,
          baselineName: test.name,
        }).catch((error) => {
          logger.error('Batch test error', { testName: test.name, error });
          return {
            id: uuidv4(),
            projectId,
            testName: test.name,
            status: 'failed' as const,
            currentScreenshot: Buffer.from(''),
            error: error instanceof Error ? error.message : String(error),
            executedAt: new Date(),
            duration: 0,
          };
        })
      )
    );

    logger.info('Batch visual tests completed', {
      projectId,
      total: results.length,
      passed: results.filter((r) => r.status === 'passed').length,
      failed: results.filter((r) => r.status === 'failed').length,
    });

    return results;
  }

  /**
   * Approve a test result (save current as new baseline)
   */
  async approveChange(resultId: string): Promise<void> {
    const result = this.results.get(resultId);

    if (!result) {
      throw new Error(`Result not found: ${resultId}`);
    }

    if (!result.currentScreenshot) {
      throw new Error('No screenshot to approve');
    }

    try {
      // Check if baseline exists
      const existing = await this.baselineManager.getBaseline(result.projectId, result.testName);

      if (existing) {
        // Update existing baseline
        // Need to extract baselineId from stored metadata
        const baselines = await this.baselineManager.listBaselines(result.projectId);
        const baseline = baselines.find((b) => b.name === result.testName);

        if (baseline) {
          await this.baselineManager.updateBaseline(
            result.projectId,
            baseline.id,
            result.currentScreenshot
          );
        }
      } else {
        // Create new baseline
        await this.baselineManager.saveBaseline(
          result.projectId,
          result.testName,
          result.currentScreenshot
        );
      }

      logger.info('Visual test change approved', {
        projectId: result.projectId,
        testName: result.testName,
      });
    } catch (error) {
      logger.error('Failed to approve change', { resultId, error });
      throw error;
    }
  }

  /**
   * Get stored result
   */
  getResult(resultId: string): VisualTestResult | undefined {
    return this.results.get(resultId);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up visual regression engine');
    await this.screenshotService.cleanup();
    this.results.clear();
  }
}

let instance: VisualRegressionEngine;

/**
 * Get or create singleton instance
 */
export function getVisualRegressionEngine(): VisualRegressionEngine {
  if (!instance) {
    instance = new VisualRegressionEngine();
  }
  return instance;
}

export { VisualRegressionEngine };
export default getVisualRegressionEngine();
