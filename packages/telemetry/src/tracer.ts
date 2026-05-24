import type { Attributes, Span, SpanKind, SpanStatus, Tracer } from "./types.js";

const hex = (bytes: number): string => {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
};

export class InMemoryTracer implements Tracer {
  readonly spans: Span[] = [];

  start(name: string, kind: SpanKind = "internal", attributes: Attributes = {}): Span {
    return {
      traceId: hex(16),
      spanId: hex(8),
      parentSpanId: undefined,
      name,
      kind,
      startNs: this.now(),
      endNs: undefined,
      attributes,
      status: "unset",
    };
  }

  end(span: Span, status: SpanStatus = "ok"): Span {
    const completed: Span = { ...span, endNs: this.now(), status };
    this.spans.push(completed);
    return completed;
  }

  protected now(): number {
    return Number(process.hrtime.bigint());
  }
}
