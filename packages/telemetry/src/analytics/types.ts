/**
 * Analytics primitives — types.
 *
 * Strictly separated from raw OTel traces (see ../types.ts).
 * Financial money values are integer minor units (e.g. cents).
 * Floating-point only for ratios / percentages / dimensionless metrics.
 */

export type AnalyticsScalar = string | number | boolean | null;

export type AnalyticsAttributes = Readonly<Record<string, AnalyticsScalar>>;

/** A single ingested event. `value` is the numeric measurement. */
export type AnalyticsEvent = {
  readonly id: string;
  readonly ts: string; // ISO-8601 UTC
  readonly name: string;
  readonly value: number;
  readonly attributes: AnalyticsAttributes;
};

/** Input shape — caller passes raw data; ingest assigns `id` + `ts`. */
export type AnalyticsEventInput = {
  readonly name: string;
  readonly value: number;
  readonly attributes?: Readonly<Record<string, unknown>>;
  readonly ts?: Date | string;
};

/** Time bounds (inclusive start, exclusive end). */
export type TimeRange = {
  readonly start: Date;
  readonly end: Date;
};

/** Filter on attribute values. AND across keys; equality match. */
export type AttributeFilter = Readonly<Record<string, AnalyticsScalar>>;

export type ReportQuery = {
  readonly range: TimeRange;
  readonly name?: string;
  readonly filters?: AttributeFilter;
};

export type Aggregates = {
  readonly count: number;
  readonly sum: number;
  readonly avg: number;
  readonly min: number;
  readonly max: number;
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
};

export type Report = {
  readonly query: ReportQuery;
  readonly aggregates: Aggregates;
  readonly generatedAt: string;
};

/** Bound interface — analytics emits an audit event when an admin queries. */
export interface AuditEmitterPort {
  emit(input: {
    actorId: string;
    event: string;
    resource: string;
    decision: "allow" | "deny" | "error";
    reason?: string;
    meta?: Readonly<Record<string, unknown>>;
  }): unknown;
}

/** Sentinel error codes. Stable IDs for clients. */
export const ANALYTICS_ERROR_CODES = {
  INVALID_VALUE: "ANALYTICS_INVALID_VALUE",
  INVALID_RANGE: "ANALYTICS_INVALID_RANGE",
  EMPTY: "ANALYTICS_EMPTY",
} as const;

export type AnalyticsErrorCode =
  (typeof ANALYTICS_ERROR_CODES)[keyof typeof ANALYTICS_ERROR_CODES];

export class AnalyticsError extends Error {
  readonly code: AnalyticsErrorCode;
  constructor(code: AnalyticsErrorCode, message: string) {
    super(message);
    this.name = "AnalyticsError";
    this.code = code;
  }
}
