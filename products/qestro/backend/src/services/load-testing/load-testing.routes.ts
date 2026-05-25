import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateUser } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';
import { loadTestEngine } from './LoadTestEngine.js';
import type { LoadTestConfig } from './types.js';

export const loadTestingRouter = Router();
loadTestingRouter.use(authenticateUser);

const loadTestConfigSchema = z.object({
  testId: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  targetUrl: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).default('GET'),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional(),
  loadProfile: z.enum(['constant', 'ramp_up', 'spike', 'step']).default('constant'),
  initialVirtualUsers: z.number().int().min(1).max(10000),
  maxVirtualUsers: z.number().int().min(1).max(10000),
  rampUpDurationMs: z.number().int().optional(),
  rampDownDurationMs: z.number().int().optional(),
  spikeDurationMs: z.number().int().optional(),
  stepIncrement: z.number().int().optional(),
  stepDurationMs: z.number().int().optional(),
  testDurationMs: z.number().int().min(5000),
  thinkTimeMs: z.number().int().optional(),
  thresholdRules: z
    .array(
      z.object({
        metric: z.enum(['errorRate', 'p95Latency', 'throughput', 'avgLatency']),
        operator: z.enum(['>', '<', '=', '>=', '<=']),
        value: z.number(),
        action: z.enum(['stop', 'alert']).optional(),
      }),
    )
    .optional(),
});

loadTestingRouter.post('/start', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    const validatedData = loadTestConfigSchema.parse(req.body);
    const config = {
      ...validatedData,
      userId: req.user.userId,
    } as LoadTestConfig;

    const runId = await loadTestEngine.startLoadTest(config);
    logger.info(`Load test started: ${runId}`, { testId: config.testId, userId: req.user.userId });
    res.status(201).json({ runId, message: 'Load test started' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('Start load test error:', error);
    res.status(500).json({ error: 'Failed to start load test' });
  }
});

loadTestingRouter.post('/stop/:runId', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    const { runId } = req.params;
    if (!runId) return res.status(400).json({ error: 'runId required' });

    await loadTestEngine.stopLoadTest(runId);
    logger.info(`Load test stopped: ${runId}`, { userId: req.user.userId });
    res.json({ message: 'Load test stopped' });
  } catch (error) {
    logger.error('Stop load test error:', error);
    const status = error instanceof Error && error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ error: error instanceof Error ? error.message : 'Failed to stop load test' });
  }
});

loadTestingRouter.get('/results/:runId', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    const { runId } = req.params;
    if (!runId) return res.status(400).json({ error: 'runId required' });

    const results = await loadTestEngine.getResults(runId);
    res.json(results);
  } catch (error) {
    logger.error('Get load test results error:', error);
    const status = error instanceof Error && error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ error: error instanceof Error ? error.message : 'Failed to get results' });
  }
});

loadTestingRouter.get('/metrics/:runId', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    const { runId } = req.params;
    if (!runId) return res.status(400).json({ error: 'runId required' });

    const results = await loadTestEngine.getResults(runId);
    res.json({
      runId: results.runId,
      status: results.status,
      currentMetrics: results.finalMetrics,
      peakVirtualUsers: results.peakVirtualUsers,
      durationMs: results.durationMs,
    });
  } catch (error) {
    logger.error('Get load test metrics error:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

loadTestingRouter.get('/history', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    // This would typically fetch from database
    // For now, return empty history
    res.json({ loadTests: [] });
  } catch (error) {
    logger.error('Get load test history error:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});
