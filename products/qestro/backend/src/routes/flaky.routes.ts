/**
 * Flaky Test Analytics Routes
 * Powers the "Flaky Tests" card in the Analytics dashboard
 * and the "Stress Test" button on individual test cases.
 */

import express from 'express';
import { FlakyDetector, StressTestResult, TestRunner } from '../services/test-intelligence/FlakyDetector.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { logger } from '../utils/logger.js';
import { getPlaywrightRunner } from '../services/PlaywrightRunnerService.js';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { testCases } from '../schema/index.js';

const router = express.Router();
const detector = new FlakyDetector();

router.use(authenticateToken);

/**
 * GET /api/analytics/flaky
 * Returns the top N flaky tests for the current project
 */
router.get('/flaky', async (req, res) => {
  try {
    const projectId = req.query.projectId as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    if (!projectId) {
      res.status(400).json({ error: 'projectId required' });
      return;
    }

    // TODO: wire to real test run history once the test-runs table is populated
    // For now, return an empty result so the frontend shows "no flaky tests yet"
    // instead of mock data.
    res.json({
      success: true,
      projectId,
      flakyTests: [],
      totalTests: 0,
      flakinessPercentage: 0,
      limit,
    });
  } catch (err) {
    logger.error('Flaky analytics error', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Failed to fetch flaky tests' });
  }
});

/**
 * POST /api/analytics/flaky/stress
 * Stress-test a single test by running it N times (flakestress methodology)
 *
 * Body: { testId: string, iterations?: number }
 */
router.post('/flaky/stress', async (req, res) => {
  try {
    const { testId, iterations = 10 } = req.body as {
      testId?: string;
      iterations?: number;
    };

    if (!testId) {
      res.status(400).json({ error: 'testId required' });
      return;
    }

    if (iterations < 1 || iterations > 100) {
      res.status(400).json({ error: 'iterations must be between 1 and 100' });
      return;
    }

    // Load test case from DB and wire runner to real Playwright execution
    const playwrightRunner = getPlaywrightRunner();
    const runner: TestRunner = async (id) => {
      const [testCase] = await db
        .select()
        .from(testCases)
        .where(eq(testCases.id, id))
        .limit(1);

      if (!testCase) {
        return { status: 'fail', durationMs: 0, error: 'Test case not found' };
      }

      const start = Date.now();
      try {
        const result = await playwrightRunner.execute({
          id: testCase.id,
          code: (testCase as any).code || (testCase as any).testCode || '',
          timeout: 30000,
          config: {},
        } as any);
        return {
          status: result.status === 'passed' ? 'pass' : 'fail',
          durationMs: result.duration || Date.now() - start,
          error: result.error,
        };
      } catch (err) {
        return {
          status: 'fail',
          durationMs: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    };

    const result: StressTestResult = await detector.stressTest(testId, runner, iterations);

    res.json({ success: true, result });
  } catch (err) {
    logger.error('Stress test error', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Stress test failed' });
  }
});

export default router;
