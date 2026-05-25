/**
 * Vibe Test Pilot Generation Routes
 * Test generation from URL and description
 */

import { Router, Request, Response } from 'express';
import { vibeTestPilot } from '../services/vibe-test-pilot/VibeTestPilot.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/vibe-pilot/generate-from-url
 */
router.post('/generate-from-url', async (req: Request, res: Response) => {
  try {
    const { url, projectId, userId, framework } = req.body;

    if (!url || !projectId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: url, projectId, userId',
      });
    }

    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL provided',
      });
    }

    logger.info(`Generating tests from URL: ${url}`, { projectId });

    const generatedTests = await vibeTestPilot.generateFromURL(url, {
      projectId,
      userId,
      framework: framework || 'playwright',
      includeAssertions: true,
      includeScreenshots: true,
    });

    res.json({
      success: true,
      data: {
        tests: generatedTests,
        count: generatedTests.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to generate tests from URL', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      success: false,
      error: message || 'Failed to generate tests',
    });
  }
});

/**
 * POST /api/vibe-pilot/generate-from-description
 */
router.post('/generate-from-description', async (req: Request, res: Response) => {
  try {
    const { description, projectId, userId, framework } = req.body;

    if (!description || !projectId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: description, projectId, userId',
      });
    }

    if (description.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Description must be at least 10 characters',
      });
    }

    logger.info('Generating tests from description', { projectId });

    const generatedTests = await vibeTestPilot.generateFromDescription(description, {
      projectId,
      userId,
      framework: framework || 'playwright',
      includeAssertions: true,
    });

    res.json({
      success: true,
      data: {
        tests: generatedTests,
        count: generatedTests.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to generate tests from description', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      success: false,
      error: message || 'Failed to generate tests',
    });
  }
});

export default router;
