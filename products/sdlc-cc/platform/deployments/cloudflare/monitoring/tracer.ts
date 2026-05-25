// Distributed tracing for worker observability

import type { ObservabilityConfig, Span } from './observability-types';
import type { StructuredLogger } from './structured-logger';

export class Tracer {
  private config: ObservabilityConfig;
  private activeSpans: Map<string, Span> = new Map();
  private logger: StructuredLogger;

  constructor(config: ObservabilityConfig, logger: StructuredLogger) {
    this.config = config;
    this.logger = logger;
  }

  startSpan(operationName: string, parentSpanId?: string): string {
    const spanId = this.generateSpanId();
    const traceId = parentSpanId
      ? this.getTraceIdFromParent(parentSpanId)
      : this.generateTraceId();

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
    return this.generateTraceId();
  }

  private exportSpan(span: Span): void {
    if (!this.config.enableTracing) return;

    this.logger.debug('Exporting span', {
      traceId: span.traceId,
      spanId: span.spanId,
      operationName: span.operationName,
      duration: span.endTime ? span.endTime - span.startTime : undefined
    });
  }
}
