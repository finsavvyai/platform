/**
 * Vibe Test Pilot Main Routes
 * Routes for test refinement and route aggregation
 */

import { Router, Request, Response } from 'express';
import { vibeTestPilot } from '../services/vibe-test-pilot/VibeTestPilot.js';
import generationRoutes from './vibe-pilot-generation.routes.js';
import utilityRoutes from './vibe-pilot-utility.routes.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Mount generation routes
router.use(generationRoutes);

// Mount utility routes
router.use(utilityRoutes);

/**
 * POST /api/vibe-pilot/refine/:testId
 * Refine an existing test based on user feedback
 */
router.post('/refine/:testId', async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const { feedback } = req.body;

    if (!feedback) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: feedback',
      });
    }

    if (feedback.length < 5) {
      return res.status(400).json({
        success: false,
        error: 'Feedback must be at least 5 characters',
      });
    }

    logger.info(`Refining test: ${testId}`);

    const refinedTest = await vibeTestPilot.refineTest(testId, feedback);

    res.json({
      success: true,
      data: {
        test: refinedTest,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to refine test: ${req.params.testId}`, error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      success: false,
      error: message || 'Failed to refine test',
    });
  }
});

export default router;
