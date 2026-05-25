/**
 * Audit emitter for AMLIQ Brain.
 *
 * - Wraps the injected AuditSink (round-2 rule: no direct telemetry import).
 * - Optionally tamper-evident: when an AuditChain is provided, every record
 *   is chained via chainAppend(prevHash, record) before reaching the sink.
 * - Sink failure → fallback sink (never silent, never throws). The emit
 *   promise resolves with the (chained) record either way, so callers can
 *   make their "do not serve without audit" decision deterministically.
 *
 * 100% line + branch coverage required (portfolio CLAUDE.md: audit emit).
 */

import type {
  AuditChain,
  AuditInput,
  AuditRecord,
  AuditSink,
} from "./types.js";

export interface AuditEmitterOptions {
  readonly sink: AuditSink;
  readonly fallbackSink?: AuditSink;
  readonly chain?: AuditChain;
  readonly clock?: () => Date;
}

const GENESIS_HASH = "0".repeat(64);

const defaultFallback: AuditSink = (record) => {
  try {
    // Last-resort line. No PII, no secrets — record is already redacted upstream.
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({ brain_audit_fallback: true, record }),
    );
  } catch {
    // Truly nothing left to do; do not throw from the audit path.
  }
};

export interface EmitResult {
  readonly record: AuditRecord;
  readonly delivered: boolean;
  readonly fallbackUsed: boolean;
}

export class BrainAuditEmitter {
  private readonly sink: AuditSink;
  private readonly fallbackSink: AuditSink;
  private readonly chain: AuditChain | undefined;
  private readonly clock: () => Date;
  private prevHash: string = GENESIS_HASH;

  constructor(opts: AuditEmitterOptions) {
    this.sink = opts.sink;
    this.fallbackSink = opts.fallbackSink ?? defaultFallback;
    this.chain = opts.chain;
    this.clock = opts.clock ?? (() => new Date());
  }

  /**
   * Emit one audit record. Never throws. Returns the persisted record plus
   * delivery status. Callers (e.g. /v1/aml/decision) MUST refuse to serve
   * a successful response if `delivered === false` and `fallbackUsed === false`.
   */
  async emit(input: AuditInput): Promise<EmitResult> {
    const base = this.build(input);
    const chained = await this.maybeChain(base);
    return this.deliver(chained);
  }

  /** Snapshot of the current chain head (for /health and tests). */
  headHash(): string {
    return this.prevHash;
  }

  private build(input: AuditInput): Omit<AuditRecord, "chain"> {
    return {
      ts: this.clock().toISOString(),
      actor_id: input.actorId,
      event: input.event,
      resource: input.resource,
      decision: input.decision,
      reason: input.reason ?? "",
      ...(input.meta !== undefined ? { meta: input.meta } : {}),
    };
  }

  private async maybeChain(
    base: Omit<AuditRecord, "chain">,
  ): Promise<AuditRecord> {
    if (!this.chain) return base;
    const res = await this.chain.chainAppend(this.prevHash, base);
    const chained: AuditRecord = {
      ...base,
      chain: { prevHash: this.prevHash, hash: res.hash, sig: res.sig },
    };
    this.prevHash = res.hash;
    return chained;
  }

  private async deliver(record: AuditRecord): Promise<EmitResult> {
    try {
      await this.sink(record);
      return { record, delivered: true, fallbackUsed: false };
    } catch {
      try {
        await this.fallbackSink(record);
        return { record, delivered: false, fallbackUsed: true };
      } catch {
        return { record, delivered: false, fallbackUsed: false };
      }
    }
  }
}
