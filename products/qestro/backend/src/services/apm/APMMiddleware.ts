/**
 * APMMiddleware: Express middleware for automatic instrumentation
 * Tracks request duration, errors, and resource usage
 */

import { Request, Response, NextFunction } from 'express';
import { ResourceUsage } from './types.js';
import { TraceCollector } from './TraceCollector.js';
import { MetricsEngine } from './MetricsEngine.js';

export class APMMiddleware {
  constructor(
    private traceCollector: TraceCollector,
    private metricsEngine: MetricsEngine
  ) {}

  /**
   * Create Express middleware for APM instrumentation
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const traceId = req.headers['x-trace-id'] as string || this.generateTraceId();

      // Attach trace ID to request
      (req as any).traceId = traceId;

      // Start trace for this request
      const trace = this.traceCollector.startTrace(
        `${req.method} ${req.path}`,
        {
          method: req.method,
          path: req.path,
          ip: req.ip ?? 'unknown',
        }
      );

      // Start span for route handler
      const span = this.traceCollector.startSpan(
        trace.traceId,
        'route-handler',
        trace.rootSpanId
      );

      // Override response methods to capture completion
      const originalSend = res.send;

      res.send = function (data: any) {
        const duration = Date.now() - startTime;

        // End span
        this.traceCollector.endSpan(
          span.spanId,
          res.statusCode >= 400 ? 'error' : 'ok',
          {
            statusCode: res.statusCode,
            contentLength: Buffer.byteLength(JSON.stringify(data)),
          }
        );

        // End trace
        this.traceCollector.endTrace(trace.traceId);

        // Record metrics
        this.metricsEngine.recordMetric('request_duration', duration, {
          method: req.method,
          path: req.path,
          status: String(res.statusCode),
        });

        this.metricsEngine.recordMetric('http_status_code', res.statusCode, {
          method: req.method,
          path: req.path,
        });

        // Record resource usage
        const resources = this.getResourceUsage();
        this.metricsEngine.recordMetric(
          'memory_usage_mb',
          resources.memoryUsageMb,
          { source: 'middleware' }
        );
        this.metricsEngine.recordMetric(
          'cpu_usage_percent',
          resources.cpuUsagePercent,
          { source: 'middleware' }
        );

        return originalSend.call(this, data);
      }.bind({ traceCollector: this.traceCollector, metricsEngine: this.metricsEngine });

      next();
    };
  }

  /**
   * Get current resource usage
   */
  private getResourceUsage(): ResourceUsage {
    const usage = process.memoryUsage();

    return {
      memoryUsageMb: usage.rss / 1024 / 1024,
      heapUsedMb: usage.heapUsed / 1024 / 1024,
      heapTotalMb: usage.heapTotal / 1024 / 1024,
      cpuUsagePercent: 0, // Would need native module or perf hooks
      timestamp: Date.now(),
    };
  }

  /**
   * Generate unique trace ID
   */
  private generateTraceId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Error handling middleware
   */
  errorMiddleware() {
    return (
      err: Error,
      _req: Request,
      res: Response,
      next: NextFunction
    ) => {
      const traceId = (_req as any).traceId;

      if (traceId) {
        const trace = this.traceCollector.getTrace(traceId);

        if (trace) {
          // Mark trace as error
          trace.status = 'error';

          // Log error in trace metadata
          trace.metadata.error = err.message;
          trace.metadata.stack = err.stack ?? '';
        }
      }

      // Record error metric
      this.metricsEngine.recordMetric('errors_total', 1, {
        type: err.name,
        message: err.message,
      });

      next(err);
    };
  }

  /**
   * Middleware to periodically flush and aggregate metrics
   */
  periodicFlush(intervalMs: number = 60000) {
    return setInterval(() => {
      const metricNames = this.metricsEngine.getMetricNames();

      for (const name of metricNames) {
        this.metricsEngine.aggregateMetrics(name, 'minute');
      }
    }, intervalMs);
  }
}
