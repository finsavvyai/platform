export type SpanKind = "internal" | "server" | "client" | "producer" | "consumer";

export type Attributes = Readonly<Record<string, string | number | boolean>>;

export type SpanStatus = "ok" | "error" | "unset";

export type Span = {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId: string | undefined;
  readonly name: string;
  readonly kind: SpanKind;
  readonly startNs: number;
  readonly endNs: number | undefined;
  readonly attributes: Attributes;
  readonly status: SpanStatus;
};

export type AiExecutionEvent = {
  readonly traceId: string;
  readonly spanId: string;
  readonly provider: string;
  readonly model: string;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly latencyMs: number;
  readonly cost: number;
  readonly cacheHit: boolean;
  readonly redacted: boolean;
};

export interface Tracer {
  start(name: string, kind?: SpanKind, attributes?: Attributes): Span;
  end(span: Span, status?: SpanStatus): Span;
}

export interface AiExecutionLogger {
  record(event: AiExecutionEvent): void;
}
