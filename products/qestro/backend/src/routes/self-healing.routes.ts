/**
 * Self-Healing Routes
 * Provides test failure analysis and automatic assertion suggestions
 */

import { Router, Request, Response } from 'express';
import { authenticateUser, requireSubscription } from '../middleware/auth.js';
import { selfHealingEngine } from '../services/SelfHealingEngine.js';
import { logger } from '../utils/logger.js';

const router = Router();

const formatResponse = (data: unknown, message?: string) => ({
  success: true,
  data,
  message,
  timestamp: new Date().toISOString(),
});

const handleError = (res: Response, error: unknown, statusCode = 500) => {
  const msg = error instanceof Error ? error.message : 'Unknown error';
  logger.error('Self-healing error:', { error: msg });
  res.status(statusCode).json({
    success: false,
    error: msg,
    timestamp: new Date().toISOString(),
  });
};

// POST /api/self-healing/analyze - Analyze a test failure and attempt healing
router.post('/analyze', authenticateUser, requireSubscription('pro'), async (req: Request, res: Response) => {
  try {
    const { testId, errorMessage, status, duration, screenshots, logs } = req.body;
    if (!testId || !errorMessage) return res.status(400).json({ success: false, error: 'testId and errorMessage required' });

    const testResult = {
      id: testId,
      testId,
      status: status || 'failed' as const,
      startTime: new Date(),
      endTime: new Date(),
      duration: duration || 0,
      errors: [errorMessage],
      assertions: [],
      metrics: {},
      screenshots: screenshots || [],
      logs: logs || [],
    };

    const result = await selfHealingEngine.analyzeAndHeal(testId, testResult, req.body.testCode);
    res.json(formatResponse(result, 'Failure analysis completed'));
  } catch (error) {
    handleError(res, error, 400);
  }
});

// POST /api/self-healing/apply - Apply a healing suggestion (manual trigger)
router.post('/apply', authenticateUser, requireSubscription('pro'), async (req: Request, res: Response) => {
  try {
    const { testId, errorMessage, testCode } = req.body;
    if (!testId || !errorMessage) return res.status(400).json({ success: false, error: 'testId and errorMessage required' });

    const testResult = {
      id: testId,
      testId,
      status: 'failed' as const,
      startTime: new Date(),
      endTime: new Date(),
      duration: 0,
      errors: [errorMessage],
      assertions: [],
      metrics: {},
      screenshots: [],
      logs: [],
    };

    const result = await selfHealingEngine.analyzeAndHeal(testId, testResult, testCode);
    res.json(formatResponse(result, result.healed ? 'Healing applied' : 'Healing suggestion generated'));
  } catch (error) {
    handleError(res, error, 400);
  }
});

// GET /api/self-healing/history/:testId - Get healing history for a test
router.get('/history/:testId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const history = selfHealingEngine.getHealingHistory(req.params.testId);
    res.json(formatResponse({
      testId: req.params.testId,
      healings: history,
      total: history.length,
    }));
  } catch (error) {
    handleError(res, error);
  }
});

// GET /api/self-healing/stats - Get healing statistics
router.get('/stats', authenticateUser, async (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId as string;
    const stats = selfHealingEngine.getHealingStats(projectId);
    res.json(formatResponse({ projectId, ...stats }, 'Healing statistics retrieved'));
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
