/**
 * Analytics Routes
 * Provides test execution metrics, trends, performance analysis
 */

import { Router, Request, Response } from 'express';
import { authenticateUser, requireSubscription } from '../middleware/auth.js';
import { analyticsEngine, type AnalyticsQuery } from '../services/AnalyticsEngine.js';
import { reportGenerator } from '../services/analytics/ReportGenerator.js';
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
  logger.error('Analytics error:', { error: msg });
  res.status(statusCode).json({
    success: false,
    error: msg,
    timestamp: new Date().toISOString(),
  });
};

/** Build a default date range for analytics queries */
const buildQuery = (projectId: string, period?: string, limit?: number): AnalyticsQuery => {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const periodDays = period === 'monthly' ? 30 : period === 'weekly' ? 7 : 1;
  return {
    projectId,
    startDate: now - periodDays * dayMs,
    endDate: now,
    period: (period as 'daily' | 'weekly' | 'monthly') || 'daily',
    limit,
  };
};

// GET /api/analytics/dashboard - Get dashboard analytics summary
router.get('/dashboard', authenticateUser, async (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId as string;
    if (!projectId) return res.status(400).json({ success: false, error: 'projectId required' });

    const result = await analyticsEngine.getAnalytics(buildQuery(projectId));

    res.json(formatResponse({
      executionTrends: result.executionTrends,
      flakyTests: result.flakyTests?.slice(0, 3),
      slowestTests: result.slowestTests?.slice(0, 5),
      passRates: result.passRates,
      summary: {
        totalTests: result.executionTrends?.[0]?.totalTests || 0,
        avgDuration: result.executionTrends?.[0]?.avgDuration || 0,
      },
    }));
  } catch (error) {
    handleError(res, error);
  }
});

// GET /api/analytics/trends - Get execution trends
router.get('/trends', authenticateUser, async (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId as string;
    if (!projectId) return res.status(400).json({ success: false, error: 'projectId required' });

    const period = (req.query.period as string) || 'daily';
    const result = await analyticsEngine.getAnalytics(buildQuery(projectId, period));
    res.json(formatResponse(result.executionTrends, 'Execution trends retrieved'));
  } catch (error) {
    handleError(res, error);
  }
});

// GET /api/analytics/flaky-tests - Get flaky test scores
router.get('/flaky-tests', authenticateUser, async (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId as string;
    if (!projectId) return res.status(400).json({ success: false, error: 'projectId required' });

    const limit = parseInt(req.query.limit as string) || 10;
    const result = await analyticsEngine.getAnalytics(buildQuery(projectId, 'daily', limit));
    const flaky = result.flakyTests || [];
    const avg = flaky.length ? (flaky.reduce((s, t) => s + t.flakiness, 0) / flaky.length).toFixed(2) : 0;
    res.json(formatResponse({ flakyTests: flaky, summary: { totalFlaky: flaky.length, averageFlakinessScore: avg } }));
  } catch (error) {
    handleError(res, error);
  }
});

// GET /api/analytics/slowest-tests - Get slowest tests
router.get('/slowest-tests', authenticateUser, async (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId as string;
    if (!projectId) return res.status(400).json({ success: false, error: 'projectId required' });

    const limit = parseInt(req.query.limit as string) || 10;
    const result = await analyticsEngine.getAnalytics(buildQuery(projectId, 'daily', limit));
    const slow = result.slowestTests || [];
    res.json(formatResponse({ slowestTests: slow, summary: { totalSlow: slow.length } }));
  } catch (error) {
    handleError(res, error);
  }
});

// GET /api/analytics/ai-usage - Get AI usage statistics
router.get('/ai-usage', authenticateUser, requireSubscription('pro'), async (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId as string || 'default';
    const result = await analyticsEngine.getAnalytics(buildQuery(projectId));
    res.json(formatResponse(result.aiUsageStats, 'AI usage statistics retrieved'));
  } catch (error) {
    handleError(res, error);
  }
});

// POST /api/analytics/report - Generate report
router.post('/report', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { format, period, projectId } = req.body;
    if (!format || !period || !projectId) return res.status(400).json({ success: false, error: 'format, period, projectId required' });

    // Build a report object from analytics data
    const analytics = await analyticsEngine.getAnalytics(buildQuery(projectId, period));
    const report = {
      metadata: {
        title: `${period} Test Report`,
        projectId,
        projectName: projectId,
        generatedAt: Date.now(),
        period: period as 'daily' | 'weekly' | 'monthly',
        startDate: analytics.query.startDate,
        endDate: analytics.query.endDate,
      },
      summary: {
        totalTests: analytics.executionTrends?.[0]?.totalTests || 0,
        passedTests: analytics.executionTrends?.[0]?.passedTests || 0,
        failedTests: analytics.executionTrends?.[0]?.failedTests || 0,
        skippedTests: 0,
        passRate: 0,
        failRate: 0,
        avgDuration: analytics.executionTrends?.[0]?.avgDuration || 0,
        totalDuration: 0,
        flakeRate: 0,
        trend: analytics.executionTrends?.[0]?.trend || ('stable' as const),
        previousPeriodPassRate: 0,
        passRateChange: 0,
        topFailures: [],
        slowestTests: [],
        flakyTests: [],
      },
      trends: [],
      testResults: [],
      recommendations: [],
    };

    const output = await reportGenerator.generateReport(report, format);
    res.json(formatResponse({ report: output }, `Report generated in ${format} format`));
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
