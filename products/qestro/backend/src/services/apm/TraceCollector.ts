/**
 * TraceCollector: Distributed tracing for test execution
 * Collects and manages execution traces with span hierarchy
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Span,
  Trace,
  TraceCollectorConfig,
} from './types.js';

export class TraceCollector {
  private traces: Map<string, Trace> = new Map();
  private spans: Map<string, Span> = new Map();
  private config: TraceCollectorConfig;
  private maxBuffer: number;

  constructor(config: Partial<TraceCollectorConfig> = {}) {
    this.config = {
      maxTracesInBuffer: config.maxTracesInBuffer ?? 1000,
      enableAutoFlush: config.enableAutoFlush ?? true,
      flushIntervalMs: config.flushIntervalMs ?? 60000,
    };
    this.maxBuffer = this.config.maxTracesInBuffer;

    if (this.config.enableAutoFlush) {
      setInterval(() => this.flush(), this.config.flushIntervalMs);
    }
  }

  /**
   * Start a new distributed trace
   */
  startTrace(
    name: string,
    metadata: Record<string, string> = {}
  ): Trace {
    const traceId = uuidv4();
    const rootSpanId = uuidv4();

    const rootSpan: Span = {
      spanId: rootSpanId,
      traceId,
      name,
      startTime: Date.now(),
      status: 'pending',
      metadata: {},
    };

    const trace: Trace = {
      traceId,
      name,
      startTime: Date.now(),
      spans: [rootSpan],
      rootSpanId,
      status: 'pending',
      metadata,
    };

    this.traces.set(traceId, trace);
    this.spans.set(rootSpanId, rootSpan);

    return trace;
  }

  /**
   * Start a child span within a trace
   */
  startSpan(
    traceId: string,
    name: string,
    parentSpanId?: string
  ): Span {
    const spanId = uuidv4();
    const trace = this.traces.get(traceId);

    if (!trace) {
      throw new Error(`Trace ${traceId} not found`);
    }

    const span: Span = {
      spanId,
      traceId,
      parentSpanId,
      name,
      startTime: Date.now(),
      status: 'pending',
      metadata: {},
    };

    trace.spans.push(span);
    this.spans.set(spanId, span);

    return span;
  }

  /**
   * End a span and calculate its duration
   */
  endSpan(
    spanId: string,
    status: 'ok' | 'error',
    metadata: Record<string, unknown> = {}
  ): void {
    const span = this.spans.get(spanId);

    if (!span) {
      throw new Error(`Span ${spanId} not found`);
    }

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;
    span.metadata = { ...span.metadata, ...metadata };
  }

  /**
   * End a trace and compute final metrics
   */
  endTrace(traceId: string): Trace {
    const trace = this.traces.get(traceId);

    if (!trace) {
      throw new Error(`Trace ${traceId} not found`);
    }

    // Ensure all spans have end times
    for (const span of trace.spans) {
      if (!span.endTime) {
        span.endTime = Date.now();
        span.duration = span.endTime - span.startTime;
      }
    }

    trace.endTime = Math.max(...trace.spans.map((s) => s.endTime ?? 0));
    trace.duration = trace.endTime - trace.startTime;

    // Determine trace status (error if any span is error)
    trace.status = trace.spans.some((s) => s.status === 'error')
      ? 'error'
      : 'ok';

    return trace;
  }

  /**
   * Retrieve a trace by ID
   */
  getTrace(traceId: string): Trace | undefined {
    return this.traces.get(traceId);
  }

  /**
   * Get all traces in buffer
   */
  getAllTraces(): Trace[] {
    return Array.from(this.traces.values());
  }

  /**
   * Get traces sorted by start time (descending)
   */
  getRecentTraces(limit: number = 100): Trace[] {
    return Array.from(this.traces.values())
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit);
  }

  /**
   * Identify slowest spans in a trace
   */
  getSlowestSpans(
    traceId: string,
    limit: number = 10
  ): Span[] {
    const trace = this.traces.get(traceId);

    if (!trace) {
      return [];
    }

    return trace.spans
      .filter((s) => s.duration !== undefined)
      .sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0))
      .slice(0, limit);
  }

  /**
   * Calculate bottlenecks: spans taking >10% of trace time
   */
  getBottlenecks(traceId: string): Span[] {
    const trace = this.traces.get(traceId);

    if (!trace || !trace.duration) {
      return [];
    }

    const threshold = trace.duration * 0.1;

    return trace.spans.filter((s) => (s.duration ?? 0) > threshold);
  }

  /**
   * Flush old traces to maintain ring buffer size
   */
  private flush(): void {
    if (this.traces.size > this.maxBuffer) {
      const sorted = Array.from(this.traces.values())
        .sort((a, b) => a.startTime - b.startTime);

      const toRemove = sorted.length - this.maxBuffer;

      for (let i = 0; i < toRemove; i++) {
        const trace = sorted[i];
        this.traces.delete(trace.traceId);
        trace.spans.forEach((span) => this.spans.delete(span.spanId));
      }
    }
  }

  /**
   * Clear all traces and spans
   */
  clear(): void {
    this.traces.clear();
    this.spans.clear();
  }

  /**
   * Get statistics about current traces
   */
  getStats(): {
    totalTraces: number;
    totalSpans: number;
    pendingTraces: number;
  } {
    const traces = Array.from(this.traces.values());

    return {
      totalTraces: traces.length,
      totalSpans: traces.reduce((sum, t) => sum + t.spans.length, 0),
      pendingTraces: traces.filter((t) => t.status === 'pending').length,
    };
  }
}
