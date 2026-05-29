// =============================================================================
// SDLC.ai Platform - Worker Observability and Monitoring
// =============================================================================
// This module provides comprehensive monitoring and observability for all workers
// Includes metrics, logging, tracing, and error tracking
// =============================================================================

import { ExecutionContext } from '@cloudflare/workers-types';

// =============================================================================
// CONFIGURATION
// =============================================================================

interface ObservabilityConfig {
  environment: 'development' | 'staging' | 'production';
  service: string;
  version: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableMetrics: boolean;
  enableTracing: boolean;
  enableErrorTracking: boolean;
  metricsEndpoint?: string;
  sentryDsn?: string;
  datadogApiKey?: string;
}

// =============================================================================
// METRICS COLLECTION
// =============================================================================

interface MetricData {
  name: string;
  value: number;
  timestamp: number;
  tags: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram';
}

interface WorkerMetrics {
  // Request metrics
  requestsTotal: number;
  requestDuration: number[];
  activeRequests: number;

  // Error metrics
  errorsTotal: number;
  errorRate: number;

  // Performance metrics
  cpuTime: number;
  memoryUsage: number;

  // Business metrics
  documentsProcessed: number;
  vectorSearches: number;
  authentications: number;

  // Custom metrics
  customMetrics: Map<string, MetricData>;
}

class MetricsCollector {
  private config: ObservabilityConfig;
  private metrics: WorkerMetrics;
  private startTime: number;

  constructor(config: ObservabilityConfig) {
    this.config = config;
    this.startTime = Date.now();
    this.metrics = {
      requestsTotal: 0,
      requestDuration: [],
      activeRequests: 0,
      errorsTotal: 0,
      errorRate: 0,
      cpuTime: 0,
      memoryUsage: 0,
      documentsProcessed: 0,
      vectorSearches: 0,
      authentications: 0,
      customMetrics: new Map()
    };
  }

  // Request metrics
  startRequest(): void {
    this.metrics.requestsTotal++;
    this.metrics.activeRequests++;
  }

  endRequest(duration: number): void {
    this.metrics.activeRequests--;
    this.metrics.requestDuration.push(duration);

    // Keep only last 1000 request durations for histogram
    if (this.metrics.requestDuration.length > 1000) {
      this.metrics.requestDuration = this.metrics.requestDuration.slice(-1000);
    }
  }

  // Error metrics
  recordError(): void {
    this.metrics.errorsTotal++;
    this.calculateErrorRate();
  }

  private calculateErrorRate(): void {
    if (this.metrics.requestsTotal > 0) {
      this.metrics.errorRate = this.metrics.errorsTotal / this.metrics.requestsTotal;
    }
  }

  // Performance metrics
  recordCpuTime(ms: number): void {
    this.metrics.cpuTime += ms;
  }

  recordMemoryUsage(bytes: number): void {
    this.metrics.memoryUsage = bytes;
  }

  // Business metrics
  incrementDocumentsProcessed(): void {
    this.metrics.documentsProcessed++;
  }

  incrementVectorSearches(): void {
    this.metrics.vectorSearches++;
  }

  incrementAuthentications(): void {
    this.metrics.authentications++;
  }

  // Custom metrics
  recordCustomMetric(name: string, value: number, tags: Record<string, string> = {}, type: 'counter' | 'gauge' | 'histogram' = 'counter'): void {
    const metric: MetricData = {
      name,
      value,
      timestamp: Date.now(),
      tags: {
        service: this.config.service,
        environment: this.config.environment,
        ...tags
      },
      type
    };

    this.metrics.customMetrics.set(name, metric);
  }

  // Get metrics summary
  getMetricsSummary(): any {
    const durations = this.metrics.requestDuration;
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const p95Duration = this.calculatePercentile(durations, 95);
    const p99Duration = this.calculatePercentile(durations, 99);

    return {
      service: this.config.service,
      environment: this.config.environment,
      version: this.config.version,
      uptime: Date.now() - this.startTime,

      requests: {
        total: this.metrics.requestsTotal,
        active: this.metrics.activeRequests,
        durationAvg: Math.round(avgDuration),
        durationP95: Math.round(p95Duration),
        durationP99: Math.round(p99Duration)
      },

      errors: {
        total: this.metrics.errorsTotal,
        rate: Math.round(this.metrics.errorRate * 10000) / 10000
      },

      performance: {
        cpuTime: this.metrics.cpuTime,
        memoryUsage: this.metrics.memoryUsage
      },

      business: {
        documentsProcessed: this.metrics.documentsProcessed,
        vectorSearches: this.metrics.vectorSearches,
        authentications: this.metrics.authentications
      },

      customMetrics: Array.from(this.metrics.customMetrics.entries()).map(([name, data]) => ({
        name,
        ...data
      }))
    };
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  // Export metrics for external systems
  async exportMetrics(env: any): Promise<void> {
    if (!this.config.enableMetrics) return;

    const metrics = this.getMetricsSummary();

    // Send to Analytics Engine (if available)
    if (env && env.ANALYTICS) {
      try {
        await env.ANALYTICS.writeDataPoint({
          blobs: [JSON.stringify(metrics)],
          doubles: [
            metrics.requests.total,
            metrics.errors.rate,
            metrics.performance.cpuTime,
            metrics.performance.memoryUsage
          ],
          indexes: [this.config.service, this.config.environment]
        });
      } catch (error) {
        console.error('Failed to write metrics to Analytics Engine:', error);
      }
    }

    // Send to external monitoring services
    if (this.config.metricsEndpoint) {
      try {
        await fetch(this.config.metricsEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.datadogApiKey || ''}`
          },
          body: JSON.stringify(metrics)
        });
      } catch (error) {
        console.error('Failed to send metrics to external endpoint:', error);
      }
    }
  }
}

// =============================================================================
// STRUCTURED LOGGING
// =============================================================================

interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  service: string;
  environment: string;
  message: string;
  requestId?: string;
  userId?: string;
  tenantId?: string;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class StructuredLogger {
  private config: ObservabilityConfig;
  private requestId?: string;

  constructor(config: ObservabilityConfig) {
    this.config = config;
  }

  setRequestId(requestId: string): void {
    this.requestId = requestId;
  }

  private createLogEntry(level: 'debug' | 'info' | 'warn' | 'error', message: string, metadata?: Record<string, any>, error?: Error): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      service: this.config.service,
      environment: this.config.environment,
      message,
      requestId: this.requestId,
      metadata,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    };
  }

  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = levels[this.config.logLevel];
    const messageLevel = levels[level];
    return messageLevel >= currentLevel;
  }

  private log(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    const logMessage = JSON.stringify(entry);

    switch (entry.level) {
      case 'debug':
        console.debug(logMessage);
        break;
      case 'info':
        console.info(logMessage);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'error':
        console.error(logMessage);
        break;
    }

    // Send to external logging service
    this.sendToExternalLogger(entry);
  }

  private async sendToExternalLogger(entry: LogEntry): Promise<void> {
    // Implementation for external logging services
    // This could be sent to Logtail, DataDog, or other services
  }

  debug(message: string, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry('debug', message, metadata);
    this.log(entry);
  }

  info(message: string, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry('info', message, metadata);
    this.log(entry);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry('warn', message, metadata);
    this.log(entry);
  }

  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry('error', message, metadata, error);
    this.log(entry);
  }

  // Security and audit logging
  audit(event: string, userId?: string, tenantId?: string, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry('info', `AUDIT: ${event}`, {
      ...metadata,
      auditEvent: event,
      userId,
      tenantId,
      timestamp: new Date().toISOString()
    });
    this.log(entry);
  }

  // Performance logging
  performance(operation: string, duration: number, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry('info', `Performance: ${operation}`, {
      ...metadata,
      operation,
      duration,
      performanceMetric: true
    });
    this.log(entry);
  }
}

// =============================================================================
// ERROR TRACKING
// =============================================================================

interface ErrorContext {
  requestId?: string;
  userId?: string;
  tenantId?: string;
  service: string;
  environment: string;
  version: string;
  tags?: Record<string, string>;
  extra?: Record<string, any>;
}

class ErrorTracker {
  private config: ObservabilityConfig;
  private logger: StructuredLogger;

  constructor(config: ObservabilityConfig, logger: StructuredLogger) {
    this.config = config;
    this.logger = logger;
  }

  async captureError(error: Error, context: Partial<ErrorContext> = {}): Promise<void> {
    if (!this.config.enableErrorTracking) return;

    const fullContext: ErrorContext = {
      service: this.config.service,
      environment: this.config.environment,
      version: this.config.version,
      ...context
    };

    // Log the error
    this.logger.error(`Unhandled error: ${error.message}`, error, {
      errorContext: fullContext
    });

    // Send to Sentry (if configured)
    if (this.config.sentryDsn) {
      await this.sendToSentry(error, fullContext);
    }

    // Send to other error tracking services
    await this.sendToErrorTrackingServices(error, fullContext);
  }

  private async sendToSentry(error: Error, context: ErrorContext): Promise<void> {
    try {
      // Implementation for Sentry integration
      // This would use the Sentry SDK or direct API calls
    } catch (sentryError) {
      this.logger.error('Failed to send error to Sentry', sentryError as Error);
    }
  }

  private async sendToErrorTrackingServices(error: Error, context: ErrorContext): Promise<void> {
    // Implementation for other error tracking services
    // DataDog, Rollbar, etc.
  }

  // Create user feedback for errors
  createErrorFeedback(errorId: string, userId: string, feedback: string): void {
    this.logger.info('User feedback received for error', {
      errorId,
      userId,
      feedback,
      type: 'user_feedback'
    });
  }
}

// =============================================================================
// DISTRIBUTED TRACING
// =============================================================================

interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  tags: Record<string, string>;
  logs: Array<{
    timestamp: number;
    level: string;
    message: string;
  }>;
}

class Tracer {
  private config: ObservabilityConfig;
  private activeSpans: Map<string, Span> = new Map();
  private logger: StructuredLogger;

  constructor(config: ObservabilityConfig, logger: StructuredLogger) {
    this.config = config;
    this.logger = logger;
  }

  startSpan(operationName: string, parentSpanId?: string): string {
    const spanId = this.generateSpanId();
    const traceId = parentSpanId ? this.getTraceIdFromParent(parentSpanId) : this.generateTraceId();

    const span: Span = {
      traceId,
      spanId,
      parentSpanId,
      operationName,
      startTime: Date.now(),
      tags: {
        service: this.config.service,
        environment: this.config.environment
      },
      logs: []
    };

    this.activeSpans.set(spanId, span);

    this.logger.debug(`Started span: ${operationName}`, {
      spanId,
      traceId,
      parentSpanId
    });

    return spanId;
  }

  finishSpan(spanId: string, tags?: Record<string, string>): void {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      this.logger.warn('Attempted to finish non-existent span', { spanId });
      return;
    }

    span.endTime = Date.now();
    if (tags) {
      span.tags = { ...span.tags, ...tags };
    }

    const duration = span.endTime - span.startTime;

    this.logger.debug(`Finished span: ${span.operationName}`, {
      spanId,
      traceId: span.traceId,
      duration
    });

    // Export span to tracing system
    this.exportSpan(span);

    this.activeSpans.delete(spanId);
  }

  setTag(spanId: string, key: string, value: string): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.tags[key] = value;
    }
  }

  logEvent(spanId: string, level: string, message: string): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.logs.push({
        timestamp: Date.now(),
        level,
        message
      });
    }
  }

  private generateSpanId(): string {
    return Math.random().toString(36).substring(2, 16);
  }

  private generateTraceId(): string {
    return Math.random().toString(36).substring(2, 16);
  }

  private getTraceIdFromParent(parentSpanId: string): string {
    // In a real implementation, this would retrieve the trace ID from the parent span
    // For now, we'll generate a new one
    return this.generateTraceId();
  }

  private exportSpan(span: Span): void {
    if (!this.config.enableTracing) return;

    // Export to tracing systems like Jaeger, Zipkin, etc.
    this.logger.debug('Exporting span', {
      traceId: span.traceId,
      spanId: span.spanId,
      operationName: span.operationName,
      duration: span.endTime ? span.endTime - span.startTime : undefined
    });
  }
}

// =============================================================================
// MAIN OBSERVABILITY CLASS
// =============================================================================

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

  // Request wrapper that automatically tracks metrics and traces
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

  // Getters for individual components
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

  // Export all observability data
  async exportData(env: any): Promise<void> {
    await this.metrics.exportMetrics(env);
  }

  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 16);
  }

  // Health check for observability systems
  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details: any }> {
    const metrics = this.metrics.getMetricsSummary();

    // Determine health based on error rate and response times
    const errorRate = metrics.errors.rate;
    const avgDuration = metrics.requests.durationAvg;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const details: any = {
      errorRate,
      avgDuration,
      uptime: metrics.uptime
    };

    if (errorRate > 0.1) { // 10% error rate
      status = 'unhealthy';
    } else if (errorRate > 0.05 || avgDuration > 5000) { // 5% error rate or 5s avg duration
      status = 'degraded';
    }

    details.status = status;

    return { status, details };
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createObservability(
  env: any,
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

// =============================================================================
// MIDDLEWARE HELPERS
// =============================================================================

export function withObservability<T extends any[], R>(
  observability: Observability,
  operationName: string,
  fn: (...args: T) => Promise<R>,
  getMetadata?: (...args: T) => Record<string, any>
) {
  return async (...args: T): Promise<R> => {
    const metadata = getMetadata ? getMetadata(...args) : undefined;
    return await observability.traceRequest(operationName, () => fn(...args), metadata);
  };
}

export default Observability;
