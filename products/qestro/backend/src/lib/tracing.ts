/**
 * Perfetto-compatible trace writer
 * Outputs JSON traces that can be loaded at ui.perfetto.dev
 *
 * Format: Chrome Trace Event Format (JSON Object Format)
 * https://docs.google.com/document/d/1CvAClvFfyA5R-PhYUmn5OOQtYMH4h6I0nSsKchNAySU
 *
 * Reference: https://github.com/google/perfetto
 */

export interface TraceEvent {
  /** Event name */
  name: string;
  /** Category (for filtering in Perfetto UI) */
  cat: string;
  /** Phase: B=begin, E=end, X=complete, I=instant, C=counter, M=metadata */
  ph: 'B' | 'E' | 'X' | 'I' | 'C' | 'M';
  /** Timestamp in microseconds */
  ts: number;
  /** Duration in microseconds (only for 'X' phase) */
  dur?: number;
  /** Process ID */
  pid: number;
  /** Thread ID */
  tid: number;
  /** Additional args shown in the UI */
  args?: Record<string, unknown>;
}

export interface TraceFile {
  traceEvents: TraceEvent[];
  displayTimeUnit: 'ms' | 'ns';
  metadata?: Record<string, unknown>;
}

export class TraceBuilder {
  private events: TraceEvent[] = [];
  private startTime: number;
  private pid: number;
  private openSpans = new Map<string, { ts: number; cat: string; args?: Record<string, unknown> }>();

  constructor(traceName: string, pid = 1) {
    this.pid = pid;
    this.startTime = performance.now() * 1000; // to microseconds

    // Process metadata
    this.events.push({
      name: 'process_name',
      cat: '__metadata',
      ph: 'M',
      ts: 0,
      pid,
      tid: 0,
      args: { name: traceName },
    });
  }

  /** Current timestamp relative to trace start (microseconds) */
  private now(): number {
    return performance.now() * 1000 - this.startTime;
  }

  /**
   * Begin a span (duration event). Returns the span name for later `end()`.
   */
  begin(name: string, category: string, args?: Record<string, unknown>): string {
    this.openSpans.set(name, { ts: this.now(), cat: category, args });
    return name;
  }

  /**
   * End a previously-begun span
   */
  end(name: string, extraArgs?: Record<string, unknown>): void {
    const span = this.openSpans.get(name);
    if (!span) return;
    this.openSpans.delete(name);

    const ts = span.ts;
    const dur = this.now() - ts;
    this.events.push({
      name,
      cat: span.cat,
      ph: 'X',
      ts,
      dur,
      pid: this.pid,
      tid: 0,
      args: { ...span.args, ...extraArgs },
    });
  }

  /**
   * Record a complete event (begin + end in one call)
   */
  complete(
    name: string,
    category: string,
    durationMs: number,
    args?: Record<string, unknown>,
  ): void {
    this.events.push({
      name,
      cat: category,
      ph: 'X',
      ts: this.now() - durationMs * 1000,
      dur: durationMs * 1000,
      pid: this.pid,
      tid: 0,
      args,
    });
  }

  /**
   * Record an instant event (zero duration marker)
   */
  instant(name: string, category: string, args?: Record<string, unknown>): void {
    this.events.push({
      name,
      cat: category,
      ph: 'I',
      ts: this.now(),
      pid: this.pid,
      tid: 0,
      args,
    });
  }

  /**
   * Record a counter value (shown as a line chart in Perfetto)
   */
  counter(name: string, value: number, category = 'counters'): void {
    this.events.push({
      name,
      cat: category,
      ph: 'C',
      ts: this.now(),
      pid: this.pid,
      tid: 0,
      args: { value },
    });
  }

  /**
   * Export the trace as a JSON object (Perfetto-compatible)
   */
  toJSON(): TraceFile {
    return {
      traceEvents: this.events,
      displayTimeUnit: 'ms',
      metadata: {
        tracer: 'qestro-perfetto',
        created: new Date().toISOString(),
      },
    };
  }

  /**
   * Export as stringified JSON (write to disk or send over HTTP)
   */
  toString(): string {
    return JSON.stringify(this.toJSON());
  }

  /** Clear all events */
  clear(): void {
    this.events = [];
    this.openSpans.clear();
  }
}

/**
 * Instrument any async function with a trace span
 */
export async function traced<T>(
  trace: TraceBuilder,
  name: string,
  category: string,
  fn: () => Promise<T>,
  args?: Record<string, unknown>,
): Promise<T> {
  trace.begin(name, category, args);
  try {
    const result = await fn();
    trace.end(name, { status: 'ok' });
    return result;
  } catch (err) {
    trace.end(name, {
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
