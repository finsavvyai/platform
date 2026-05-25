/**
 * Test Intelligence API Routes
 * Endpoints for flaky detection, test prioritization, auto-fix, and predictive analytics
 */

import { Router, Request, Response } from 'express';
import { FlakyDetector } from '../services/test-intelligence/FlakyDetector.js';
import { TestPrioritizer } from '../services/test-intelligence/TestPrioritizer.js';
import { AutoFixEngine } from '../services/test-intelligence/AutoFixEngine.js';
import { PredictiveAnalytics } from '../services/test-intelligence/PredictiveAnalytics.js';
import {
  CodeChange,
  TestFailure,
  TestRun,
} from '../services/test-intelligence/types.js';

const router = Router();

// Initialize services
const flakyDetector = new FlakyDetector();
const testPrioritizer = new TestPrioritizer();
const autoFixEngine = new AutoFixEngine();
const predictiveAnalytics = new PredictiveAnalytics();

// Mock data store - replace with database in production
interface ProjectData {
  testRunHistory: Map<string, TestRun[]>;
  testMetadata: Map<string, { name: string; executionTime: number; businessCritical: boolean }>;
  codeChanges: CodeChange[];
}

const projectDataStore = new Map<string, ProjectData>();

/**
 * GET /api/intelligence/flaky/:projectId
 * Get flaky test report for a project
 */
router.get('/flaky/:projectId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const projectData = projectDataStore.get(projectId);

    if (!projectData) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const testIds = Array.from(projectData.testMetadata.keys());
    const report = await flakyDetector.detectFlakyTests(
      projectId,
      testIds,
      projectData.testRunHistory
    );

    res.status(200).json(report);
  } catch (error) {
    res.status(500).json({
      error: `Failed to detect flaky tests: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
});

/**
 * GET /api/intelligence/prioritize?projectId=:projectId
 * Get prioritized test execution order
 */
router.get('/prioritize', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.query;

    if (!projectId || typeof projectId !== 'string') {
      res.status(400).json({ error: 'projectId query parameter is required' });
      return;
    }

    const projectData = projectDataStore.get(projectId);

    if (!projectData) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const testIds = Array.from(projectData.testMetadata.keys());
    const priorities = await testPrioritizer.prioritizeTests(
      testIds,
      projectData.codeChanges,
      projectData.testRunHistory,
      projectData.testMetadata
    );

    res.status(200).json(priorities);
  } catch (error) {
    res.status(500).json({
      error: `Failed to prioritize tests: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
});

/**
 * POST /api/intelligence/auto-fix/:testId
 * Get auto-fix suggestions for a test failure
 */
router.post('/auto-fix/:testId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { testId } = req.params;
    const { testCode, failure } = req.body;

    if (!testCode || !failure) {
      res.status(400).json({ error: 'testCode and failure are required' });
      return;
    }

    const suggestions = await autoFixEngine.suggestFixes(
      testId,
      testCode,
      failure as TestFailure
    );

    res.status(200).json(suggestions);
  } catch (error) {
    res.status(500).json({
      error: `Failed to suggest fixes: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
});

/**
 * POST /api/intelligence/auto-fix/:testId/apply
 * Apply an auto-fix to a test
 */
router.post('/auto-fix/:testId/apply', async (req: Request, res: Response): Promise<void> => {
  try {
    const { testId } = req.params;
    const { fixedCode, originalCode } = req.body;

    if (!fixedCode || !originalCode) {
      res.status(400).json({ error: 'fixedCode and originalCode are required' });
      return;
    }

    const result = await autoFixEngine.applyFix(testId, fixedCode, originalCode);

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      error: `Failed to apply fix: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
});

/**
 * GET /api/intelligence/predict/:projectId
 * Get failure predictions for tests in a project
 */
router.get('/predict/:projectId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const projectData = projectDataStore.get(projectId);

    if (!projectData) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const testIds = Array.from(projectData.testMetadata.keys());
    const predictions = await predictiveAnalytics.predictFailures(
      projectId,
      testIds,
      projectData.testRunHistory
    );

    res.status(200).json(predictions);
  } catch (error) {
    res.status(500).json({
      error: `Failed to predict failures: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
});

/**
 * GET /api/intelligence/health/:projectId
 * Get project health score and recommendations
 */
router.get('/health/:projectId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const projectData = projectDataStore.get(projectId);

    if (!projectData) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const healthScore = await predictiveAnalytics.getHealthScore(
      projectId,
      projectData.testRunHistory
    );

    res.status(200).json(healthScore);
  } catch (error) {
    res.status(500).json({
      error: `Failed to calculate health score: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
});

/**
 * GET /api/intelligence/trends/:projectId
 * Get test trend analysis for a project
 */
router.get('/trends/:projectId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { days } = req.query;
    const daysNum = days ? parseInt(days as string, 10) : 30;

    const projectData = projectDataStore.get(projectId);

    if (!projectData) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const trends = await predictiveAnalytics.getTrendAnalysis(
      projectId,
      projectData.testRunHistory,
      daysNum
    );

    res.status(200).json(trends);
  } catch (error) {
    res.status(500).json({
      error: `Failed to analyze trends: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
});

/**
 * POST /api/intelligence/projects/:projectId/initialize
 * Initialize project data for intelligence analysis
 * (For testing/demo purposes)
 */
router.post(
  '/projects/:projectId/initialize',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;
      const { tests, codeChanges } = req.body;

      if (!tests || !Array.isArray(tests)) {
        res.status(400).json({ error: 'tests array is required' });
        return;
      }

      const testMetadata = new Map<string, { name: string; executionTime: number; businessCritical: boolean }>();
      const testRunHistory = new Map<string, TestRun[]>();

      for (const test of tests) {
        testMetadata.set(test.id, {
          name: test.name,
          executionTime: test.executionTime || 5000,
          businessCritical: test.businessCritical || false,
        });

        // Initialize with mock run history
        testRunHistory.set(test.id, []);
      }

      projectDataStore.set(projectId, {
        testMetadata,
        testRunHistory,
        codeChanges: codeChanges || [],
      });

      res.status(201).json({
        message: 'Project initialized successfully',
        projectId,
        testCount: tests.length,
      });
    } catch (error) {
      res.status(500).json({
        error: `Failed to initialize project: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }
);

/**
 * POST /api/intelligence/projects/:projectId/run
 * Record a test run for intelligence analysis
 * (For testing/demo purposes)
 */
router.post('/projects/:projectId/run', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { testId, status, duration, errorMessage } = req.body;

    const projectData = projectDataStore.get(projectId);

    if (!projectData) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const runs = projectData.testRunHistory.get(testId) || [];
    runs.push({
      runId: `run-${Date.now()}`,
      testId,
      status,
      duration,
      errorMessage,
      executedAt: new Date(),
    });

    projectData.testRunHistory.set(testId, runs);

    res.status(201).json({
      message: 'Test run recorded',
      testId,
      runCount: runs.length,
    });
  } catch (error) {
    res.status(500).json({
      error: `Failed to record run: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
});

export default router;
