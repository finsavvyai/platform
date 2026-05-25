/**
 * Audit log emitter.
 *
 * Shape per swarm conventions:
 *   { ts, actor_id, event, resource, decision, reason }
 *
 * Critical path:
 *  - Always returns the redacted record (even if the sink fails).
 *  - Never throws. Sink errors are routed to the fallback sink.
 *  - No PII / no secrets in `reason` (caller's responsibility; we also redact).
 */

import { DEFAULT_REDACT_KEYS, redact } from "./redact.js";

export type AuditDecision = "allow" | "deny" | "error";

export type AuditInput = {
  readonly actorId: string;
  readonly event: string;
  readonly resource: string;
  readonly decision: AuditDecision;
  readonly reason?: string;
  readonly meta?: Readonly<Record<string, unknown>>;
};

export type AuditRecord = {
  readonly ts: string; // ISO-8601 UTC
  readonly actor_id: string;
  readonly event: string;
  readonly resource: string;
  readonly decision: AuditDecision;
  readonly reason: string;
  readonly meta?: Readonly<Record<string, unknown>>;
};

export type AuditSink = (record: AuditRecord) => void;

export type AuditEmitterOptions = {
  readonly sink?: AuditSink;
  readonly fallbackSink?: AuditSink;
  readonly redactKeys?: readonly string[];
  readonly clock?: () => Date;
};

const defaultSink: AuditSink = (record) => {
  // Single structured JSON line. stdout, machine-parseable.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(record));
};

const defaultFallbackSink: AuditSink = (record) => {
  try {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ audit_fallback: true, record }));
  } catch {
    // Last-resort: do nothing. We will not throw from audit.
  }
};

export class AuditEmitter {
  private readonly sink: AuditSink;
  private readonly fallbackSink: AuditSink;
  private readonly redactKeys: readonly string[];
  private readonly clock: () => Date;

  constructor(options: AuditEmitterOptions = {}) {
    this.sink = options.sink ?? defaultSink;
    this.fallbackSink = options.fallbackSink ?? defaultFallbackSink;
    this.redactKeys = options.redactKeys ?? DEFAULT_REDACT_KEYS;
    this.clock = options.clock ?? (() => new Date());
  }

  /**
   * Emit one audit record. Synchronous. Returns the (redacted) record so
   * callers can attach it to traces or HTTP response headers. Never throws.
   */
  emit(input: AuditInput): AuditRecord {
    const record = this.build(input);
    try {
      this.sink(record);
    } catch (sinkErr) {
      this.runFallback(record, sinkErr);
    }
    return record;
  }

  private build(input: AuditInput): AuditRecord {
    const safe = redact(
      {
        actor_id: input.actorId,
        event: input.event,
        resource: input.resource,
        decision: input.decision,
        reason: input.reason ?? "",
        meta: input.meta,
      },
      { keys: this.redactKeys },
    );
    const record: AuditRecord = {
      ts: this.clock().toISOString(),
      actor_id: safe.actor_id,
      event: safe.event,
      resource: safe.resource,
      decision: safe.decision,
      reason: safe.reason,
      ...(safe.meta !== undefined ? { meta: safe.meta } : {}),
    };
    return record;
  }

  private runFallback(record: AuditRecord, sinkErr: unknown): void {
    try {
      this.fallbackSink(record);
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify({
          audit_sink_error: true,
          message: sinkErr instanceof Error ? sinkErr.message : String(sinkErr),
        }),
      );
    } catch {
      // Swallow. Audit must never throw.
    }
  }
}

export const createAuditEmitter = (
  options: AuditEmitterOptions = {},
): AuditEmitter => new AuditEmitter(options);
