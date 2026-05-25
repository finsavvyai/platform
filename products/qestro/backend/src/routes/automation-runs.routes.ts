import { Router, Request, Response } from 'express';
import { automationRunService } from '../services/AutomationRunService.js';
import { logger } from '../utils/logger.js';
import { WebSocket } from 'ws';

const router = Router();

/**
 * Create a new test run
 * POST /api/automation-runs
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, testPlanId, projectId, userId, testCases, config, metadata } = req.body;

    if (!name || !projectId || !userId || !testCases || !config) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, projectId, userId, testCases, config'
      });
    }

    const run = await automationRunService.createRun({
      name,
      testPlanId,
      projectId,
      userId,
      testCases,
      config,
      metadata
    });

    res.status(201).json({
      success: true,
      data: run
    });
  } catch (error: any) {
    logger.error('Error creating test run:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create test run',
      message: error.message
    });
  }
});

/**
 * Get all test runs
 * GET /api/automation-runs
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { projectId, userId, status } = req.query;

    let runs = automationRunService.getAllRuns();

    // Apply filters
    if (projectId) {
      runs = runs.filter(r => r.projectId === projectId);
    }

    if (userId) {
      runs = runs.filter(r => r.userId === userId);
    }

    if (status) {
      runs = runs.filter(r => r.status === status);
    }

    res.json({
      success: true,
      data: runs,
      count: runs.length
    });
  } catch (error: any) {
    logger.error('Error getting test runs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get test runs',
      message: error.message
    });
  }
});

/**
 * Get a specific test run
 * GET /api/automation-runs/:runId
 */
router.get('/:runId', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;

    const run = automationRunService.getRun(runId);

    if (!run) {
      return res.status(404).json({
        success: false,
        error: 'Test run not found'
      });
    }

    res.json({
      success: true,
      data: run
    });
  } catch (error: any) {
    logger.error('Error getting test run:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get test run',
      message: error.message
    });
  }
});

/**
 * Start a test run
 * POST /api/automation-runs/:runId/start
 */
router.post('/:runId/start', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;

    const run = await automationRunService.startRun(runId);

    res.json({
      success: true,
      data: run
    });
  } catch (error: any) {
    logger.error('Error starting test run:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start test run',
      message: error.message
    });
  }
});

/**
 * Pause a test run
 * POST /api/automation-runs/:runId/pause
 */
router.post('/:runId/pause', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;

    const run = await automationRunService.pauseRun(runId);

    res.json({
      success: true,
      data: run
    });
  } catch (error: any) {
    logger.error('Error pausing test run:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to pause test run',
      message: error.message
    });
  }
});

/**
 * Cancel a test run
 * POST /api/automation-runs/:runId/cancel
 */
router.post('/:runId/cancel', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;

    const run = await automationRunService.cancelRun(runId);

    res.json({
      success: true,
      data: run
    });
  } catch (error: any) {
    logger.error('Error cancelling test run:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel test run',
      message: error.message
    });
  }
});

/**
 * Get test results for a run
 * GET /api/automation-runs/:runId/results
 */
router.get('/:runId/results', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;

    const run = automationRunService.getRun(runId);

    if (!run) {
      return res.status(404).json({
        success: false,
        error: 'Test run not found'
      });
    }

    res.json({
      success: true,
      data: run.results,
      count: run.results.length
    });
  } catch (error: any) {
    logger.error('Error getting test results:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get test results',
      message: error.message
    });
  }
});

/**
 * Get a specific test result
 * GET /api/automation-runs/:runId/results/:resultId
 */
router.get('/:runId/results/:resultId', async (req: Request, res: Response) => {
  try {
    const { runId, resultId } = req.params;

    const result = automationRunService.getTestResult(runId, resultId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Test result not found'
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('Error getting test result:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get test result',
      message: error.message
    });
  }
});

/**
 * Export test run results
 * GET /api/automation-runs/:runId/export
 */
router.get('/:runId/export', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    const format = (req.query.format as string) || 'json';

    const exportedData = automationRunService.exportRun(runId, format as any);

    // Set appropriate headers based on format
    switch (format) {
      case 'html':
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `attachment; filename=test-run-${runId}.html`);
        break;
      case 'xml':
        res.setHeader('Content-Type', 'application/xml');
        res.setHeader('Content-Disposition', `attachment; filename=test-run-${runId}.xml`);
        break;
      default:
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=test-run-${runId}.json`);
    }

    res.send(exportedData);
  } catch (error: any) {
    logger.error('Error exporting test run:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export test run',
      message: error.message
    });
  }
});

/**
 * Get active runs
 * GET /api/automation-runs/active
 */
router.get('/status/active', async (req: Request, res: Response) => {
  try {
    const activeRuns = automationRunService.getActiveRuns();

    res.json({
      success: true,
      data: activeRuns,
      count: activeRuns.length
    });
  } catch (error: any) {
    logger.error('Error getting active runs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get active runs',
      message: error.message
    });
  }
});

/**
 * Get runs by project
 * GET /api/automation-runs/project/:projectId
 */
router.get('/project/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    const runs = automationRunService.getRunsByProject(projectId);

    res.json({
      success: true,
      data: runs,
      count: runs.length
    });
  } catch (error: any) {
    logger.error('Error getting runs by project:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get runs by project',
      message: error.message
    });
  }
});

/**
 * Get runs by user
 * GET /api/automation-runs/user/:userId
 */
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const runs = automationRunService.getRunsByUser(userId);

    res.json({
      success: true,
      data: runs,
      count: runs.length
    });
  } catch (error: any) {
    logger.error('Error getting runs by user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get runs by user',
      message: error.message
    });
  }
});

/**
 * Get run statistics
 * GET /api/automation-runs/:runId/statistics
 */
router.get('/:runId/statistics', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;

    const run = automationRunService.getRun(runId);

    if (!run) {
      return res.status(404).json({
        success: false,
        error: 'Test run not found'
      });
    }

    const passRate = run.totalTests > 0
      ? Math.round((run.passedTests / run.totalTests) * 100)
      : 0;

    const failRate = run.totalTests > 0
      ? Math.round((run.failedTests / run.totalTests) * 100)
      : 0;

    const avgTestDuration = run.results.length > 0
      ? run.results.reduce((sum, r) => sum + (r.duration || 0), 0) / run.results.length
      : 0;

    const statistics = {
      runId: run.id,
      status: run.status,
      duration: run.duration,
      totalTests: run.totalTests,
      passedTests: run.passedTests,
      failedTests: run.failedTests,
      skippedTests: run.skippedTests,
      retriedTests: run.retriedTests,
      passRate,
      failRate,
      avgTestDuration,
      environment: run.environment,
      parallel: run.config.parallel,
      retryEnabled: run.config.retryFailedTests
    };

    res.json({
      success: true,
      data: statistics
    });
  } catch (error: any) {
    logger.error('Error getting run statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get run statistics',
      message: error.message
    });
  }
});

/**
 * Cleanup old runs
 * POST /api/automation-runs/cleanup
 */
router.post('/maintenance/cleanup', async (req: Request, res: Response) => {
  try {
    const { maxAge } = req.body;

    automationRunService.cleanupOldRuns(maxAge);

    res.json({
      success: true,
      message: 'Cleanup completed'
    });
  } catch (error: any) {
    logger.error('Error cleaning up runs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup runs',
      message: error.message
    });
  }
});

export default router;
