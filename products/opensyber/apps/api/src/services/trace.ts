/**
 * Lightweight Perfetto-compatible tracing service.
 *
 * Instruments request lifecycle, LLM calls, and skill execution.
 * Exports spans in Chrome Trace Event format for Perfetto UI viewing.
 *
 * Usage:
 *   const span = trace.startSpan('llm-proxy', { model: 'claude-haiku' });
 *   // ... do work ...
 *   span.end();
 *   const events = trace.flush();
 */

import { eventsToOtelJson, type OtelTracePayload } from './trace-otel.js';

interface TraceEvent {
  name: string;
  cat: string;
  ph: 'B' | 'E' | 'X';
  ts: number;
  dur?: number;
  pid: number;
  tid: number;
  args?: Record<string, unknown>;
}

interface Span {
  name: string;
  category: string;
  startTime: number;
  args: Record<string, unknown>;
  end: () => void;
}

const PID = 1;

export class TraceCollector {
  private events: TraceEvent[] = [];
  private tid: number;

  constructor() {
    this.tid = Math.floor(Math.random() * 0xFFFF);
  }

  startSpan(name: string, args: Record<string, unknown> = {}, category = 'api'): Span {
    const startTime = performance.now() * 1000; // microseconds
    return {
      name,
      category,
      startTime,
      args,
      end: () => {
        const endTime = performance.now() * 1000;
        this.events.push({
          name,
          cat: category,
          ph: 'X',
          ts: startTime,
          dur: endTime - startTime,
          pid: PID,
          tid: this.tid,
          args,
        });
      },
    };
  }

  addInstantEvent(name: string, args: Record<string, unknown> = {}): void {
    this.events.push({
      name,
      cat: 'marker',
      ph: 'X',
      ts: performance.now() * 1000,
      dur: 0,
      pid: PID,
      tid: this.tid,
      args,
    });
  }

  flush(): TraceEvent[] {
    const events = [...this.events];
    this.events = [];
    return events;
  }

  toJSON(): string {
    return JSON.stringify({ traceEvents: this.flush() });
  }

  /**
   * Export accumulated events in OpenTelemetry OTLP/JSON format.
   * Non-destructive: does NOT flush the buffer (unlike toJSON()).
   *
   * @param options.traceId  Optional pre-computed 32-char hex trace ID.
   * @param options.wallClockAnchorMs  Optional wall-clock anchor (ms).
   */
  toOtelJson(options: { traceId?: string; wallClockAnchorMs?: number } = {}): OtelTracePayload {
    return eventsToOtelJson([...this.events], options);
  }
}

/**
 * Create a per-request trace collector.
 * Attach to Hono context via `c.set('trace', createTrace())`.
 */
export function createTrace(): TraceCollector {
  return new TraceCollector();
}
