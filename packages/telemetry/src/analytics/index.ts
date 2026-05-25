/**
 * @finsavvyai/telemetry — analytics namespace.
 *
 * Financial analytics + reporting primitives. Kept deliberately separate
 * from raw OTel traces (`../tracer.ts`, `../types.ts`).
 */

export {
  AnalyticsError,
  ANALYTICS_ERROR_CODES,
  type Aggregates,
  type AnalyticsAttributes,
  type AnalyticsErrorCode,
  type AnalyticsEvent,
  type AnalyticsEventInput,
  type AnalyticsScalar,
  type AttributeFilter,
  type AuditEmitterPort,
  type Report,
  type ReportQuery,
  type TimeRange,
} from "./types.js";

export {
  AnalyticsIngestor,
  createAnalyticsIngestor,
  type EventSink,
  type IngestorOptions,
} from "./events.js";

export {
  aggregate,
  avg,
  count,
  max,
  min,
  percentile,
  sum,
  ZERO_AGGREGATES,
} from "./aggregator.js";

export {
  filterEvents,
  report,
  runAuditedReport,
  type AuditedReportOptions,
} from "./reporter.js";

export {
  applyRetention,
  evictByAge,
  evictBySize,
  type EvictionResult,
  type RetentionPolicy,
} from "./retention.js";
