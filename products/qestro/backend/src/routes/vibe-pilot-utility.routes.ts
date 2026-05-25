/**
 * Vibe Test Pilot Utility Routes
 * Analysis, validation, templates, and health checks
 */

import { Router, Request, Response } from 'express';
import { pageAnalyzer } from '../services/vibe-test-pilot/PageAnalyzer.js';
import { testCodeGenerator } from '../services/vibe-test-pilot/TestCodeGenerator.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/vibe-pilot/analyze-page
 */
router.post('/analyze-page', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: url',
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

    logger.info(`Analyzing page: ${url}`);

    const analysis = await pageAnalyzer.analyzePage(url);

    res.json({
      success: true,
      data: {
        analysis,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to analyze page', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      success: false,
      error: message || 'Failed to analyze page',
    });
  }
});

/**
 * POST /api/vibe-pilot/validate
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: code',
      });
    }

    if (typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Code must be a string',
      });
    }

    logger.info('Validating test code');

    const validation = testCodeGenerator.validateGeneratedCode(code);

    res.json({
      success: true,
      data: {
        validation,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to validate code', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      success: false,
      error: message || 'Failed to validate code',
    });
  }
});

/**
 * GET /api/vibe-pilot/templates
 */
router.get('/templates', (req: Request, res: Response) => {
  try {
    const templates = [
      {
        id: 'login-flow',
        name: 'Login Flow',
        description: 'Test user authentication',
        framework: 'playwright',
        category: 'auth',
      },
      {
        id: 'signup-flow',
        name: 'Signup Flow',
        description: 'Test user registration',
        framework: 'playwright',
        category: 'auth',
      },
      {
        id: 'form-submission',
        name: 'Form Submission',
        description: 'Test form validation',
        framework: 'playwright',
        category: 'forms',
      },
      {
        id: 'search-functionality',
        name: 'Search Functionality',
        description: 'Test search and results',
        framework: 'playwright',
        category: 'functionality',
      },
      {
        id: 'api-endpoint',
        name: 'API Endpoint',
        description: 'Test REST API endpoints',
        framework: 'api',
        category: 'api',
      },
      {
        id: 'mobile-navigation',
        name: 'Mobile Navigation',
        description: 'Test mobile app flows',
        framework: 'maestro',
        category: 'mobile',
      },
    ];

    logger.info('Retrieved test templates');

    res.json({
      success: true,
      data: {
        templates,
        count: templates.length,
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to retrieve templates', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve templates',
    });
  }
});

/**
 * POST /api/vibe-pilot/health
 */
router.post('/health', (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        service: 'vibe-test-pilot',
        timestamp: new Date().toISOString(),
        features: [
          'URL-based test generation',
          'Description-based test generation',
          'Page analysis',
          'Code validation',
          'Test templates',
        ],
      },
    });
  } catch (error: unknown) {
    logger.error('Health check failed', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      success: false,
      error: 'Health check failed',
    });
  }
});

export default router;
