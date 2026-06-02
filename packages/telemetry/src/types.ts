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

export type AuditOutcome = "success" | "failure" | "denied";

/**
 * Canonical audit record for auth events, admin actions, and sensitive
 * mutations. `traceId` correlates an audit entry to a telemetry trace; it is
 * explicitly `string | undefined` rather than optional so callers always make
 * the correlation decision.
 */
export type AuditEvent = {
  readonly id: string;
  readonly timestamp: number;
  readonly actor: string;
  readonly action: string;
  readonly resource: string;
  readonly outcome: AuditOutcome;
  readonly traceId: string | undefined;
  readonly metadata: Readonly<Record<string, string>>;
};

export type AuditEventInput = {
  readonly actor: string;
  readonly action: string;
  readonly resource: string;
  readonly outcome: AuditOutcome;
  readonly traceId?: string;
  readonly metadata?: Readonly<Record<string, string>>;
};

export type AuditQuery = {
  readonly actor?: string;
  readonly action?: string;
  readonly outcome?: AuditOutcome;
  readonly since?: number;
  readonly until?: number;
};

/**
 * Append-only audit sink. `record` is async because production
 * implementations write to durable, tamper-evident storage. Consumers in
 * other packages should depend on their own minimal local sink interface and
 * have the application inject an implementation of this port.
 */
export interface AuditLog {
  record(event: AuditEvent): Promise<void>;
  query(filter?: AuditQuery): readonly AuditEvent[];
}
