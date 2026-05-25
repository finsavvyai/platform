/**
 * Test Execution API Routes - Phase 8
 */

import { Router } from 'express';
import TestExecutionEngine from '../services/TestExecutionEngine.js';
import ParallelExecutionCoordinator from '../services/ParallelExecutionCoordinator.js';
import TestResultProcessingService from '../services/TestResultProcessingService.js';

const router = Router();

// Service instances
const executionEngine = new TestExecutionEngine();
const coordinator = new ParallelExecutionCoordinator({ type: 'parallel', maxWorkers: 4 });
const resultProcessor = new TestResultProcessingService();

/**
 * Execute a single test
 * POST /api/test-execution/execute
 */
router.post('/execute', async (req, res) => {
  try {
    const testCase = req.body;

    if (!testCase.id || !testCase.name || !testCase.type) {
      return res.status(400).json({
        error: 'Missing required fields: id, name, type'
      });
    }

    const result = await executionEngine.executeTest(testCase);
    const processed = await resultProcessor.processResult(result);

    res.json({
      success: true,
      result: processed
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Test execution failed',
      message: error.message
    });
  }
});

/**
 * Execute test suite
 * POST /api/test-execution/execute-suite
 */
router.post('/execute-suite', async (req, res) => {
  try {
    const { testCases, config } = req.body;

    if (!Array.isArray(testCases) || testCases.length === 0) {
      return res.status(400).json({
        error: 'testCases must be a non-empty array'
      });
    }

    const results = await executionEngine.executeTestSuite(testCases, config);
    const processed = await resultProcessor.processBatch(Array.from(results.values()));
    const report = resultProcessor.generateReport('suite-' + Date.now(), processed);

    res.json({
      success: true,
      report
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Test suite execution failed',
      message: error.message
    });
  }
});

/**
 * Execute test suite with parallel coordination
 * POST /api/test-execution/execute-parallel
 */
router.post('/execute-parallel', async (req, res) => {
  try {
    const { testCases, config } = req.body;

    if (!Array.isArray(testCases) || testCases.length === 0) {
      return res.status(400).json({
        error: 'testCases must be a non-empty array'
      });
    }

    const results = await coordinator.executeTestSuite(testCases, config);
    const processed = await resultProcessor.processBatch(Array.from(results.values()));
    const report = resultProcessor.generateReport('parallel-suite-' + Date.now(), processed);

    res.json({
      success: true,
      report,
      workerStatus: coordinator.getWorkerStatus()
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Parallel execution failed',
      message: error.message
    });
  }
});

/**
 * Get execution statistics
 * GET /api/test-execution/statistics
 */
router.get('/statistics', (req, res) => {
  try {
    const engineStats = executionEngine.getStatistics();
    const coordinatorStats = coordinator.getStatistics();

    res.json({
      success: true,
      engine: engineStats,
      coordinator: coordinatorStats
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to get statistics',
      message: error.message
    });
  }
});

/**
 * Get test result by ID
 * GET /api/test-execution/results/:testId
 */
router.get('/results/:testId', (req, res) => {
  try {
    const { testId } = req.params;
    const result = resultProcessor.getResult(testId);

    if (!result) {
      return res.status(404).json({
        error: 'Test result not found'
      });
    }

    res.json({
      success: true,
      result
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to get result',
      message: error.message
    });
  }
});

/**
 * Get all test results
 * GET /api/test-execution/results
 */
router.get('/results', (req, res) => {
  try {
    const results = resultProcessor.getAllResults();

    res.json({
      success: true,
      count: results.length,
      results
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to get results',
      message: error.message
    });
  }
});

/**
 * Get test insights
 * GET /api/test-execution/insights/:testId
 */
router.get('/insights/:testId', (req, res) => {
  try {
    const { testId } = req.params;
    const insights = resultProcessor.getTestInsights(testId);

    res.json({
      success: true,
      insights
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to get insights',
      message: error.message
    });
  }
});

/**
 * Cancel all running tests
 * POST /api/test-execution/cancel
 */
router.post('/cancel', async (req, res) => {
  try {
    await Promise.all([
      executionEngine.cancelAll(),
      coordinator.cancelAll()
    ]);

    res.json({
      success: true,
      message: 'All tests cancelled'
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to cancel tests',
      message: error.message
    });
  }
});

/**
 * Export results
 * GET /api/test-execution/export
 */
router.get('/export', (req, res) => {
  try {
    const exported = resultProcessor.exportResults();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=test-results.json');
    res.send(exported);
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to export results',
      message: error.message
    });
  }
});

/**
 * Clear all results
 * DELETE /api/test-execution/results
 */
router.delete('/results', (req, res) => {
  try {
    resultProcessor.clearResults();
    executionEngine.clearResults();

    res.json({
      success: true,
      message: 'All results cleared'
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to clear results',
      message: error.message
    });
  }
});

/**
 * Get worker status
 * GET /api/test-execution/workers
 */
router.get('/workers', (req, res) => {
  try {
    const workers = coordinator.getWorkerStatus();

    res.json({
      success: true,
      workers
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to get worker status',
      message: error.message
    });
  }
});

export default router;
