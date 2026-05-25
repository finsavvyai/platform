import type {
  Attributes,
  Span,
  SpanKind,
  SpanStatus,
  Tracer,
} from "./types.js";

const hex = (bytes: number): string => {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
};

export type StartOptions = {
  readonly kind?: SpanKind;
  readonly attributes?: Attributes;
  readonly parent?: Span;
};

/**
 * Minimal in-memory tracer. OpenTelemetry-compatible at the data-shape level
 * so we can wrap a real OTEL exporter later without changing call sites.
 *
 * Guarantees:
 *  - `withSpan` always ends the span (try/finally) even on throw.
 *  - Parent linkage: a new span started while another is active inherits the
 *    parent's traceId and gets parentSpanId set.
 *  - Timing uses process.hrtime.bigint() which is monotonic.
 */
export class InMemoryTracer implements Tracer {
  readonly spans: Span[] = [];
  private readonly stack: Span[] = [];

  start(
    name: string,
    kind: SpanKind = "internal",
    attributes: Attributes = {},
  ): Span {
    return this.startWith(name, { kind, attributes });
  }

  startWith(name: string, opts: StartOptions = {}): Span {
    const parent = opts.parent ?? this.activeSpan();
    const span: Span = {
      traceId: parent ? parent.traceId : hex(16),
      spanId: hex(8),
      parentSpanId: parent ? parent.spanId : undefined,
      name,
      kind: opts.kind ?? "internal",
      startNs: this.now(),
      endNs: undefined,
      attributes: opts.attributes ?? {},
      status: "unset",
    };
    this.stack.push(span);
    return span;
  }

  end(span: Span, status: SpanStatus = "ok"): Span {
    // Pop the matching span from the stack (tolerates out-of-order close).
    const idx = this.stack.lastIndexOf(span);
    if (idx >= 0) this.stack.splice(idx, 1);
    const endNs = Math.max(this.now(), span.startNs);
    const completed: Span = { ...span, endNs, status };
    this.spans.push(completed);
    return completed;
  }

  /**
   * Run `fn` inside a span. Always ends the span. On throw, status="error".
   */
  withSpan<T>(name: string, fn: (span: Span) => T, opts: StartOptions = {}): T {
    const span = this.startWith(name, opts);
    try {
      const result = fn(span);
      this.end(span, "ok");
      return result;
    } catch (err) {
      this.end(span, "error");
      throw err;
    }
  }

  async withSpanAsync<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    opts: StartOptions = {},
  ): Promise<T> {
    const span = this.startWith(name, opts);
    try {
      const result = await fn(span);
      this.end(span, "ok");
      return result;
    } catch (err) {
      this.end(span, "error");
      throw err;
    }
  }

  activeSpan(): Span | undefined {
    return this.stack[this.stack.length - 1];
  }

  protected now(): number {
    return Number(process.hrtime.bigint());
  }
}
