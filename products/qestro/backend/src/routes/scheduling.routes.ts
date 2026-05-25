/**
 * Scheduling Routes
 * Manages scheduled test runs (cron-based, one-time, recurring)
 */

import { Router, Request, Response } from 'express';
import { authenticateUser, requireSubscription } from '../middleware/auth.js';
import schedulerService from '../services/TestSchedulerService.js';
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
  logger.error('Scheduling error:', { error: msg });
  res.status(statusCode).json({ success: false, error: msg, timestamp: new Date().toISOString() });
};

// GET /api/schedules - List all schedules for a project
router.get('/', authenticateUser, async (_req: Request, res: Response) => {
  try {
    // Return all schedules from internal map
    const schedules = schedulerService.getAllSchedules();
    res.json(formatResponse({ schedules, total: schedules.length }, 'Schedules retrieved'));
  } catch (error) {
    handleError(res, error);
  }
});

// POST /api/schedules - Create new schedule
router.post('/', authenticateUser, requireSubscription('pro'), async (req: Request, res: Response) => {
  try {
    const { projectId, testIds, cronExpression, cronPreset, name, shardingStrategy, maxConcurrentWorkers } = req.body;
    if (!projectId || !Array.isArray(testIds) || !testIds.length)
      return res.status(400).json({ success: false, error: 'projectId and testIds required' });
    if (!cronExpression && !cronPreset)
      return res.status(400).json({ success: false, error: 'cronExpression or cronPreset required' });

    const schedule = await schedulerService.createSchedule({
      projectId,
      testIds,
      cronExpression,
      cronPreset,
      name: name || `Schedule ${new Date().toISOString()}`,
      shardingStrategy: shardingStrategy || 'round-robin',
      maxConcurrentWorkers,
    });
    res.status(201).json(formatResponse(schedule, 'Schedule created'));
  } catch (error) {
    handleError(res, error, 400);
  }
});

// PUT /api/schedules/:id/status - Enable/disable schedule
router.put('/:id/status', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean')
      return res.status(400).json({ success: false, error: 'enabled (boolean) required' });

    await schedulerService.updateScheduleStatus(req.params.id, enabled);
    res.json(formatResponse({ id: req.params.id, enabled }, `Schedule ${enabled ? 'enabled' : 'disabled'}`));
  } catch (error) {
    handleError(res, error, 400);
  }
});

// DELETE /api/schedules/:id - Delete schedule
router.delete('/:id', authenticateUser, async (req: Request, res: Response) => {
  try {
    await schedulerService.deleteSchedule(req.params.id);
    res.json(formatResponse({ id: req.params.id }, 'Schedule deleted'));
  } catch (error) {
    handleError(res, error);
  }
});

// POST /api/schedules/:id/trigger - Manually trigger a scheduled run
router.post('/:id/trigger', authenticateUser, async (req: Request, res: Response) => {
  try {
    const plan = await schedulerService.triggerExecution(req.params.id, req.body.testCases || []);
    res.status(202).json(formatResponse(plan, 'Schedule triggered'));
  } catch (error) {
    handleError(res, error, 400);
  }
});

export default router;
