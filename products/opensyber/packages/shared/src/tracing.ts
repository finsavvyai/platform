/**
 * Lightweight Perfetto-compatible trace format generator.
 *
 * Outputs Chrome Trace Event Format (JSON) that can be loaded
 * directly into ui.perfetto.dev for visualization.
 *
 * Edge-safe: no Node-only imports. Callers that need to persist
 * the trace to disk can pipe the `toJSON()` output through their
 * own runtime-appropriate writer.
 */

export interface TraceEvent {
  name: string;
  cat: string;
  ph: string;
  ts: number;
  dur?: number;
  pid: number;
  tid: number;
  args?: Record<string, unknown>;
}

interface PendingSpan {
  name: string;
  category: string;
  startUs: number;
}

/**
 * Tracer collects Chrome Trace Events and exports them as JSON
 * compatible with ui.perfetto.dev.
 */
export class Tracer {
  private events: TraceEvent[] = [];
  private pending = new Map<string, PendingSpan>();
  private readonly pid: number;
  private readonly tid: number;

  constructor(pid = 1, tid = 1) {
    this.pid = pid;
    this.tid = tid;
  }

  /**
   * Record the beginning of a named span.
   */
  begin(name: string, category = 'default'): void {
    this.pending.set(name, {
      name,
      category,
      startUs: nowMicroseconds(),
    });
    this.events.push({
      name,
      cat: category,
      ph: 'B',
      ts: nowMicroseconds(),
      pid: this.pid,
      tid: this.tid,
    });
  }

  /**
   * Record the end of a previously-begun span.
   * If no matching begin is found the event is still emitted.
   */
  end(name: string): void {
    const endTs = nowMicroseconds();
    this.events.push({
      name,
      cat: this.pending.get(name)?.category ?? 'default',
      ph: 'E',
      ts: endTs,
      pid: this.pid,
      tid: this.tid,
    });
    this.pending.delete(name);
  }

  /**
   * Measure an async function, automatically emitting a complete (X) event.
   */
  async measure<T>(
    name: string,
    fn: () => Promise<T>,
    category = 'default',
  ): Promise<T> {
    const startUs = nowMicroseconds();
    try {
      return await fn();
    } finally {
      const dur = nowMicroseconds() - startUs;
      this.events.push({
        name,
        cat: category,
        ph: 'X',
        ts: startUs,
        dur,
        pid: this.pid,
        tid: this.tid,
      });
    }
  }

  /**
   * Add a single instant event (useful for marking points in time).
   */
  instant(name: string, args?: Record<string, unknown>): void {
    this.events.push({
      name,
      cat: 'instant',
      ph: 'i',
      ts: nowMicroseconds(),
      pid: this.pid,
      tid: this.tid,
      args,
    });
  }

  /**
   * Return all collected events as a JSON string
   * in Chrome Trace Event Format.
   */
  toJSON(): string {
    return JSON.stringify({ traceEvents: this.events }, null, 2);
  }

  /**
   * Return a copy of all collected events.
   */
  getEvents(): ReadonlyArray<TraceEvent> {
    return [...this.events];
  }

  /**
   * Clear all collected events and pending spans.
   */
  reset(): void {
    this.events = [];
    this.pending.clear();
  }
}

/**
 * Create a new Tracer instance.
 */
export function createTracer(pid = 1, tid = 1): Tracer {
  return new Tracer(pid, tid);
}

/* ------------------------------------------------------------------ */
/*  Internal                                                           */
/* ------------------------------------------------------------------ */

function nowMicroseconds(): number {
  if (typeof performance !== 'undefined') {
    return Math.round(performance.now() * 1000);
  }
  const [sec, ns] = process.hrtime();
  return sec * 1_000_000 + Math.round(ns / 1000);
}
