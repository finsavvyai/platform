/**
 * APM API Routes
 * Endpoints for accessing traces, metrics, and alerts
 */

import { Router, Request, Response } from 'express';
import { TraceCollector } from '../TraceCollector.js';
import { MetricsEngine } from '../MetricsEngine.js';
import { AlertManager } from '../AlertManager.js';

export interface APMRequest extends Request {
  traceId?: string;
}

export function createAPMRoutes(
  traceCollector: TraceCollector,
  metricsEngine: MetricsEngine,
  alertManager: AlertManager
): Router {
  const router = Router();

  /**
   * GET /api/apm/traces - List recent traces
   */
  router.get('/traces', (_req: Request, res: Response) => {
    const limit = Number(((_req as any).query.limit as string) ?? 100);
    const traces = traceCollector.getRecentTraces(limit);

    res.json({
      traces,
      count: traces.length,
      timestamp: Date.now(),
    });
  });

  /**
   * GET /api/apm/traces/:id - Get trace details with bottlenecks
   */
  router.get('/traces/:id', (req: Request, res: Response) => {
    const trace = traceCollector.getTrace(req.params.id);

    if (!trace) {
      res.status(404).json({ error: 'Trace not found' });
      return;
    }

    const bottlenecks = traceCollector.getBottlenecks(req.params.id);
    const slowestSpans = traceCollector.getSlowestSpans(req.params.id, 10);

    res.json({
      trace,
      bottlenecks,
      slowestSpans,
      totalDuration: trace.duration,
      spanCount: trace.spans.length,
    });
  });

  /**
   * GET /api/apm/metrics/:name - Get metric data
   */
  router.get('/metrics/:name', (req: Request, res: Response) => {
    const { name } = req.params;
    const startTime = Number((req.query.start as string) ?? Date.now() - 3600000);
    const endTime = Number((req.query.end as string) ?? Date.now());

    const metrics = metricsEngine.getMetrics(name, {
      start: startTime,
      end: endTime,
    });

    const stats = metricsEngine.getStats(name);

    res.json({
      name,
      metrics,
      stats,
      timeRange: { start: startTime, end: endTime },
      count: metrics.length,
    });
  });

  /**
   * GET /api/apm/metrics/summary - System health summary
   */
  router.get('/summary', (_req: Request, res: Response) => {
    const metrics = {
      request_duration: metricsEngine.getStats('request_duration'),
      memory_usage_mb: metricsEngine.getStats('memory_usage_mb'),
      cpu_usage_percent: metricsEngine.getStats('cpu_usage_percent'),
      error_rate: metricsEngine.getStats('errors_total'),
      test_execution_time: metricsEngine.getStats('test_execution_time'),
      queue_depth: metricsEngine.getStats('queue_depth'),
    };

    const traceStats = traceCollector.getStats();

    res.json({
      metrics,
      traces: traceStats,
      timestamp: Date.now(),
      health: {
        isHealthy:
          (metrics.memory_usage_mb.latest ?? 0) < 1024 &&
          (metrics.error_rate.count ?? 0) < 10,
      },
    });
  });

  /**
   * GET /api/apm/aggregated/:name - Get aggregated metrics
   */
  router.get('/aggregated/:name', (req: Request, res: Response) => {
    const { name } = req.params;
    const interval = (req.query.interval as 'minute' | 'hour' | 'day') ?? 'minute';

    metricsEngine.aggregateMetrics(name, interval);
    const aggregated = metricsEngine.getAggregated(name, interval);

    res.json({
      name,
      interval,
      aggregated,
      count: aggregated.length,
    });
  });

  /**
   * GET /api/apm/alerts - Get active alerts
   */
  router.get('/alerts', (_req: Request, res: Response) => {
    const active = alertManager.getActiveAlerts();
    const history = alertManager.getAlertHistory(100);

    res.json({
      active,
      history: history.slice(-10),
      activeCount: active.length,
      timestamp: Date.now(),
    });
  });

  /**
   * POST /api/apm/alerts/rules - Add alert rule
   */
  router.post('/alerts/rules', (req: Request, res: Response) => {
    const { rule } = req.body;

    if (!rule.name || !rule.metricName || !rule.threshold) {
      res.status(400).json({
        error: 'Missing required fields: name, metricName, threshold',
      });
      return;
    }

    alertManager.addRule({
      ruleId: rule.ruleId || `rule-${Date.now()}`,
      name: rule.name,
      metricName: rule.metricName,
      condition: rule.condition ?? 'gt',
      threshold: rule.threshold,
      duration: rule.duration ?? 0,
      enabled: rule.enabled ?? true,
      channels: rule.channels ?? ['webhook'],
      webhookUrl: rule.webhookUrl,
      email: rule.email,
    });

    res.status(201).json({
      message: 'Alert rule created',
      ruleId: rule.ruleId,
    });
  });

  /**
   * GET /api/apm/alerts/rules - Get all alert rules
   */
  router.get('/alerts/rules', (_req: Request, res: Response) => {
    const rules = alertManager.getRules();

    res.json({ rules, count: rules.length });
  });

  /**
   * DELETE /api/apm/alerts/rules/:id - Remove alert rule
   */
  router.delete('/alerts/rules/:id', (req: Request, res: Response) => {
    alertManager.removeRule(req.params.id);

    res.json({ message: 'Alert rule deleted', ruleId: req.params.id });
  });

  /**
   * POST /api/apm/alerts/evaluate - Manually evaluate all rules
   */
  router.post('/alerts/evaluate', async (_req: Request, res: Response) => {
    const newAlerts = await alertManager.evaluate();

    res.json({
      newAlerts,
      count: newAlerts.length,
      timestamp: Date.now(),
    });
  });

  return router;
}

// Default export with default instances
const metricsEngine = new MetricsEngine();
const defaultAPMRouter = createAPMRoutes(new TraceCollector(), metricsEngine, new AlertManager(metricsEngine));
export default defaultAPMRouter;
