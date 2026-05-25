/**
 * Visual Regression Testing Routes
 * Pixel-perfect screenshot comparison with AI-powered diff analysis
 */

import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { getVisualRegressionEngine } from '../services/visual-regression/VisualRegressionEngine.js';
import { getBaselineManager } from '../services/visual-regression/BaselineManager.js';
import { logger } from '../utils/logger.js';

const router = Router();
const visualEngine = getVisualRegressionEngine();
const baselineManager = getBaselineManager();

const formatResponse = (data: unknown, message?: string) => ({
  success: true,
  data,
  message,
  timestamp: new Date().toISOString(),
});

const handleError = (res: Response, error: unknown, statusCode = 500) => {
  const msg = error instanceof Error ? error.message : 'Unknown error';
  logger.error('Visual regression error:', { error: msg });
  res.status(statusCode).json({
    success: false,
    error: msg,
    timestamp: new Date().toISOString(),
  });
};

/**
 * POST /api/visual/test
 * Run visual test on a URL against baseline
 */
router.post('/test', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { projectId, url, baselineName, captureOptions, comparisonOptions, createIfMissing } =
      req.body;

    if (!projectId || !url || !baselineName) {
      return res.status(400).json({
        success: false,
        error: 'projectId, url, and baselineName required',
      });
    }

    const result = await visualEngine.runVisualTest({
      projectId,
      url,
      baselineName,
      captureOptions,
      comparisonOptions,
      createIfMissing: createIfMissing !== false,
    });

    res.json(
      formatResponse(
        {
          id: result.id,
          testName: result.testName,
          status: result.status,
          mismatchPercentage: result.comparison?.mismatchPercentage,
          passed: result.status === 'passed',
          duration: result.duration,
          error: result.error,
        },
        `Visual test ${result.status}`
      )
    );
  } catch (error) {
    handleError(res, error);
  }
});

/**
 * POST /api/visual/batch
 * Run batch visual tests
 */
router.post('/batch', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { projectId, tests } = req.body;

    if (!projectId || !Array.isArray(tests) || tests.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'projectId and tests array required',
      });
    }

    const results = await visualEngine.runBatchVisualTests(projectId, tests);

    const summary = {
      total: results.length,
      passed: results.filter((r) => r.status === 'passed').length,
      failed: results.filter((r) => r.status === 'failed').length,
      baselineCreated: results.filter((r) => r.status === 'baseline-created').length,
      avgDuration: Math.round(results.reduce((sum, r) => sum + r.duration, 0) / results.length),
    };

    res.json(
      formatResponse(
        {
          summary,
          results: results.map((r) => ({
            id: r.id,
            testName: r.testName,
            status: r.status,
            mismatchPercentage: r.comparison?.mismatchPercentage,
            duration: r.duration,
            error: r.error,
          })),
        },
        'Batch tests completed'
      )
    );
  } catch (error) {
    handleError(res, error);
  }
});

/**
 * GET /api/visual/baselines/:projectId
 * List all baselines for a project
 */
router.get('/baselines/:projectId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'projectId required',
      });
    }

    const baselines = await baselineManager.listBaselines(projectId);

    res.json(
      formatResponse(
        baselines.map((b) => ({
          id: b.id,
          name: b.name,
          width: b.metadata.width,
          height: b.metadata.height,
          version: b.metadata.version,
          createdAt: b.metadata.createdAt,
          updatedAt: b.metadata.updatedAt,
        })),
        `${baselines.length} baselines found`
      )
    );
  } catch (error) {
    handleError(res, error);
  }
});

/**
 * PUT /api/visual/baselines/:projectId/:resultId/approve
 * Approve a visual test result and save as new baseline
 */
router.put('/baselines/:projectId/:resultId/approve', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { resultId } = req.params;

    if (!resultId) {
      return res.status(400).json({
        success: false,
        error: 'resultId required',
      });
    }

    await visualEngine.approveChange(resultId);

    res.json(formatResponse(null, 'Visual test result approved and baseline updated'));
  } catch (error) {
    handleError(res, error, 400);
  }
});

/**
 * GET /api/visual/results/:resultId
 * Get visual test result details
 */
router.get('/results/:resultId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { resultId } = req.params;

    const result = visualEngine.getResult(resultId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Result not found',
      });
    }

    res.json(
      formatResponse({
        id: result.id,
        testName: result.testName,
        status: result.status,
        comparison: result.comparison && {
          mismatchCount: result.comparison.mismatchCount,
          mismatchPercentage: result.comparison.mismatchPercentage,
          passed: result.comparison.passed,
          threshold: result.comparison.threshold,
          regions: result.comparison.regions,
        },
        duration: result.duration,
        executedAt: result.executedAt,
        error: result.error,
      })
    );
  } catch (error) {
    handleError(res, error);
  }
});

/**
 * GET /api/visual/results/:resultId/diff
 * Download diff image for result
 */
router.get('/results/:resultId/diff', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { resultId } = req.params;

    const result = visualEngine.getResult(resultId);

    if (!result || !result.diffImage) {
      return res.status(404).json({
        success: false,
        error: 'Diff image not found',
      });
    }

    res.contentType('image/png');
    res.send(result.diffImage);
  } catch (error) {
    handleError(res, error);
  }
});

/**
 * GET /api/visual/results/:resultId/current
 * Download current screenshot for result
 */
router.get('/results/:resultId/current', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { resultId } = req.params;

    const result = visualEngine.getResult(resultId);

    if (!result || !result.currentScreenshot) {
      return res.status(404).json({
        success: false,
        error: 'Current screenshot not found',
      });
    }

    res.contentType('image/png');
    res.send(result.currentScreenshot);
  } catch (error) {
    handleError(res, error);
  }
});

/**
 * GET /api/visual/results/:resultId/baseline
 * Download baseline screenshot for result
 */
router.get('/results/:resultId/baseline', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { resultId } = req.params;

    const result = visualEngine.getResult(resultId);

    if (!result || !result.baselineScreenshot) {
      return res.status(404).json({
        success: false,
        error: 'Baseline screenshot not found',
      });
    }

    res.contentType('image/png');
    res.send(result.baselineScreenshot);
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
