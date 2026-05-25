// =============================================================================
// SDLC.ai Platform - Worker Observability and Monitoring
// Main orchestrator that composes metrics, logging, tracing, and error tracking
// =============================================================================

import type { ObservabilityConfig } from './observability-types';
import { MetricsCollector } from './metrics-collector';
import { StructuredLogger } from './structured-logger';
import { ErrorTracker } from './error-tracker';
import { Tracer } from './tracer';

// Re-export sub-modules for backward compatibility
export type { ObservabilityConfig, MetricData, WorkerMetrics, LogEntry, ErrorContext, Span } from './observability-types';
export { MetricsCollector } from './metrics-collector';
export { StructuredLogger } from './structured-logger';
export { ErrorTracker } from './error-tracker';
export { Tracer } from './tracer';

export class Observability {
  private config: ObservabilityConfig;
  private metrics: MetricsCollector;
  private logger: StructuredLogger;
  private errorTracker: ErrorTracker;
  private tracer: Tracer;

  constructor(config: ObservabilityConfig) {
    this.config = config;
    this.logger = new StructuredLogger(config);
    this.metrics = new MetricsCollector(config);
    this.errorTracker = new ErrorTracker(config, this.logger);
    this.tracer = new Tracer(config, this.logger);
  }

  async traceRequest<T>(
    operationName: string,
    fn: (spanId: string) => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const requestId = this.generateRequestId();
    this.logger.setRequestId(requestId);

    const spanId = this.tracer.startSpan(operationName);
    this.metrics.startRequest();

    const startTime = Date.now();

    try {
      this.tracer.setTag(spanId, 'requestId', requestId);
      if (metadata) {
        Object.entries(metadata).forEach(([key, value]) => {
          this.tracer.setTag(spanId, key, String(value));
        });
      }

      const result = await fn(spanId);

      const duration = Date.now() - startTime;
      this.metrics.endRequest(duration);
      this.logger.performance(operationName, duration, { requestId });
      this.tracer.finishSpan(spanId, { status: 'success' });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metrics.recordError();
      this.metrics.endRequest(duration);

      this.tracer.setTag(spanId, 'error', 'true');
      this.tracer.finishSpan(spanId, { status: 'error' });

      await this.errorTracker.captureError(error as Error, {
        requestId,
        operationName
      });

      throw error;
    }
  }

  getMetrics(): MetricsCollector {
    return this.metrics;
  }

  getLogger(): StructuredLogger {
    return this.logger;
  }

  getErrorTracker(): ErrorTracker {
    return this.errorTracker;
  }

  getTracer(): Tracer {
    return this.tracer;
  }

  async exportData(env: Record<string, unknown>): Promise<void> {
    await this.metrics.exportMetrics(env);
  }

  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 16);
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, unknown>;
  }> {
    const metrics = this.metrics.getMetricsSummary();
    const errorRate = metrics.errors.rate;
    const avgDuration = metrics.requests.durationAvg;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const details: Record<string, unknown> = {
      errorRate,
      avgDuration,
      uptime: metrics.uptime
    };

    if (errorRate > 0.1) {
      status = 'unhealthy';
    } else if (errorRate > 0.05 || avgDuration > 5000) {
      status = 'degraded';
    }

    details.status = status;

    return { status, details };
  }
}

export function createObservability(
  env: Record<string, unknown>,
  service: string,
  version: string = '1.0.0'
): Observability {
  const config: ObservabilityConfig = {
    environment: env.ENVIRONMENT || 'development',
    service,
    version,
    logLevel: env.LOG_LEVEL || 'info',
    enableMetrics: env.ENVIRONMENT !== 'development',
    enableTracing: env.ENVIRONMENT === 'production',
    enableErrorTracking: true,
    sentryDsn: env.SENTRY_DSN,
    datadogApiKey: env.DATADOG_API_KEY,
    metricsEndpoint: env.METRICS_ENDPOINT
  };

  return new Observability(config);
}

export function withObservability<T extends any[], R>(
  observability: Observability,
  operationName: string,
  fn: (...args: T) => Promise<R>,
  getMetadata?: (...args: T) => Record<string, any>
) {
  return async (...args: T): Promise<R> => {
    const metadata = getMetadata ? getMetadata(...args) : undefined;
    return await observability.traceRequest(
      operationName,
      () => fn(...args),
      metadata
    );
  };
}

export default Observability;
