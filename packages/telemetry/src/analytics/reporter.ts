/**
 * Reporter — pure query interface over an event slice.
 *
 * No I/O. The caller supplies the events (loaded from whatever store).
 * If an admin emits a report via `runAuditedReport`, an audit event is
 * recorded via the injected AuditEmitterPort — but the reporter does NOT
 * import telemetry from within telemetry; the port is wired by the caller.
 */

import { aggregate } from "./aggregator.js";
import {
  AnalyticsError,
  ANALYTICS_ERROR_CODES,
  type AnalyticsEvent,
  type AuditEmitterPort,
  type Report,
  type ReportQuery,
  type TimeRange,
} from "./types.js";

const validateRange = (range: TimeRange): void => {
  if (
    Number.isNaN(range.start.getTime()) ||
    Number.isNaN(range.end.getTime())
  ) {
    throw new AnalyticsError(
      ANALYTICS_ERROR_CODES.INVALID_RANGE,
      "range.start and range.end must be valid Dates",
    );
  }
  if (!(range.start.getTime() < range.end.getTime())) {
    throw new AnalyticsError(
      ANALYTICS_ERROR_CODES.INVALID_RANGE,
      "range.start must be strictly before range.end",
    );
  }
};

/**
 * Filter events by time range (inclusive start, exclusive end), optional
 * `name`, and optional attribute equality filters (AND across keys).
 */
export const filterEvents = (
  events: readonly AnalyticsEvent[],
  query: ReportQuery,
): AnalyticsEvent[] => {
  validateRange(query.range);
  const startMs = query.range.start.getTime();
  const endMs = query.range.end.getTime();
  const wantName = query.name;
  const filters = query.filters;
  const out: AnalyticsEvent[] = [];
  for (const e of events) {
    const ts = Date.parse(e.ts);
    if (Number.isNaN(ts) || ts < startMs || ts >= endMs) continue;
    if (wantName !== undefined && e.name !== wantName) continue;
    if (filters && !matchesFilters(e, filters)) continue;
    out.push(e);
  }
  return out;
};

const matchesFilters = (
  event: AnalyticsEvent,
  filters: Readonly<Record<string, unknown>>,
): boolean => {
  for (const [k, want] of Object.entries(filters)) {
    if (event.attributes[k] !== want) return false;
  }
  return true;
};

/** Compute a Report (filtered slice + aggregates) deterministically. */
export const report = (
  events: readonly AnalyticsEvent[],
  query: ReportQuery,
  clock: () => Date = () => new Date(),
): Report => {
  const slice = filterEvents(events, query);
  return Object.freeze({
    query,
    aggregates: aggregate(slice),
    generatedAt: clock().toISOString(),
  });
};

export type AuditedReportOptions = {
  readonly actorId: string;
  readonly auditEmitter: AuditEmitterPort;
  readonly resource?: string;
  readonly clock?: () => Date;
};

/**
 * Like `report`, but also emits an audit record for the admin query.
 * Decision is "error" iff filtering throws (caller still receives the
 * error — audit happens first).
 */
export const runAuditedReport = (
  events: readonly AnalyticsEvent[],
  query: ReportQuery,
  options: AuditedReportOptions,
): Report => {
  const resource = options.resource ?? `analytics.report:${query.name ?? "*"}`;
  try {
    const result = report(events, query, options.clock);
    options.auditEmitter.emit({
      actorId: options.actorId,
      event: "analytics.report.read",
      resource,
      decision: "allow",
      meta: {
        rangeStart: query.range.start.toISOString(),
        rangeEnd: query.range.end.toISOString(),
        rows: result.aggregates.count,
      },
    });
    return result;
  } catch (err) {
    options.auditEmitter.emit({
      actorId: options.actorId,
      event: "analytics.report.read",
      resource,
      decision: "error",
      reason: err instanceof Error ? err.message : "unknown",
    });
    throw err;
  }
};
