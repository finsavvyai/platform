/** W3C Trace Context — minimal OTel-compatible trace IDs.
 *
 * Generates / parses `traceparent` header per
 * https://www.w3.org/TR/trace-context/. The gateway emits one log line
 * per span with `trace_id`, `span_id`, `parent_span_id`, `name`, and
 * `duration_ms` so any OTel collector that ingests JSON logs can
 * reconstruct spans without an SDK runtime in the Worker.
 */

const TRACEPARENT_RE = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

function hex(n: number): string {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function newTraceId(): string { return hex(16); }
export function newSpanId(): string { return hex(8); }

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  sampled: boolean;
}

/** Parse W3C traceparent. Returns null on missing/malformed. */
export function parseTraceparent(value: string | null): TraceContext | null {
  if (!value) return null;
  const m = TRACEPARENT_RE.exec(value.trim());
  if (!m) return null;
  const [, version, traceId, parentSpanId, flags] = m;
  if (version !== '00') return null;
  if (traceId === '0'.repeat(32)) return null;
  if (parentSpanId === '0'.repeat(16)) return null;
  return {
    traceId,
    spanId: newSpanId(),
    parentSpanId,
    sampled: (parseInt(flags, 16) & 1) === 1,
  };
}

/** Build a new root context (no incoming traceparent). */
export function newRootContext(sampled: boolean = true): TraceContext {
  return { traceId: newTraceId(), spanId: newSpanId(), parentSpanId: null, sampled };
}

/** Format a TraceContext back to a traceparent header value. */
export function formatTraceparent(ctx: TraceContext): string {
  const flags = ctx.sampled ? '01' : '00';
  return `00-${ctx.traceId}-${ctx.spanId}-${flags}`;
}

export interface SpanLog {
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  name: string;
  duration_ms: number;
  status: 'ok' | 'error';
  attrs?: Record<string, string | number | boolean>;
}

/** Run a function inside a child span; emit a span log line on completion.
 *  emit() defaults to console.log so it lands in Cloudflare's request log
 *  alongside the structured logger output. */
export async function withSpan<T>(
  parent: TraceContext, name: string, fn: () => Promise<T> | T,
  attrs?: Record<string, string | number | boolean>,
  emit: (line: string) => void = (line) => console.log(line),
): Promise<T> {
  const child: TraceContext = {
    traceId: parent.traceId,
    spanId: newSpanId(),
    parentSpanId: parent.spanId,
    sampled: parent.sampled,
  };
  const start = Date.now();
  try {
    const out = await fn();
    if (parent.sampled) {
      emit(JSON.stringify({
        trace_id: child.traceId, span_id: child.spanId,
        parent_span_id: child.parentSpanId, name,
        duration_ms: Date.now() - start, status: 'ok' as const, attrs,
      } satisfies SpanLog));
    }
    return out;
  } catch (err) {
    if (parent.sampled) {
      emit(JSON.stringify({
        trace_id: child.traceId, span_id: child.spanId,
        parent_span_id: child.parentSpanId, name,
        duration_ms: Date.now() - start, status: 'error' as const,
        attrs: { ...attrs, error: err instanceof Error ? err.message : String(err) },
      } satisfies SpanLog));
    }
    throw err;
  }
}
