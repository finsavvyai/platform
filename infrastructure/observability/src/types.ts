/**
 * Local structural types mirroring @finsavvyai/telemetry sink interfaces.
 *
 * We define them locally (per cross-package convention) so this package
 * compiles without a hard import cycle. Telemetry's `AuditSink`/`EventSink`
 * are structurally identical — duck typing keeps us compatible.
 */

export type AuditDecision = "allow" | "deny" | "error";

export type AuditRecord = {
  readonly ts: string;
  readonly actor_id: string;
  readonly event: string;
  readonly resource: string;
  readonly decision: AuditDecision;
  readonly reason: string;
  readonly meta?: Readonly<Record<string, unknown>>;
};

export type AuditSink = (record: AuditRecord) => void;

export type AnalyticsScalar = string | number | boolean | null;

export type AnalyticsEvent = {
  readonly id: string;
  readonly ts: string;
  readonly name: string;
  readonly value: number;
  readonly attributes: Readonly<Record<string, AnalyticsScalar>>;
};

export type AnalyticsSink = (event: AnalyticsEvent) => void;

/** Minimal Cloudflare R2 bucket binding shape we depend on. */
export interface R2BucketLike {
  put(
    key: string,
    value: ArrayBuffer | Uint8Array | string,
    options?: { httpMetadata?: { contentType?: string; contentEncoding?: string } },
  ): Promise<unknown>;
}

/**
 * Minimal AuditEmitter port — only the `emit` method we depend on.
 * `decision` is widened to `string` so domain-specific decisions like
 * `"metered"` can be emitted via this port even though telemetry's
 * concrete `AuditEmitter` accepts a narrower union. Callers that need
 * the narrow type should construct their own emitter.
 */
export interface AuditEmitterPort {
  emit(input: {
    actorId: string;
    event: string;
    resource: string;
    decision: AuditDecision | string;
    reason?: string;
    meta?: Readonly<Record<string, unknown>>;
  }): unknown;
}

/** TokenCounter snapshot — structurally matches ai-gateway's surface. */
export interface TokenCounterSnapshotLike {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedCalls: number;
  readonly billedCalls: number;
}

export interface TokenCounterPort {
  snapshot(): TokenCounterSnapshotLike;
  reset?(): void;
}

export type HealthStatus = "ok" | "degraded" | "down";

export type HealthCheckResult = {
  readonly name: string;
  readonly status: HealthStatus;
};

export type HealthReport = {
  readonly status: HealthStatus;
  readonly version: string;
  readonly uptime_s: number;
  readonly checks: ReadonlyArray<HealthCheckResult>;
};
