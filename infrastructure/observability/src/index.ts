/**
 * @finsavvyai/observability-adapters
 *
 * Concrete sink adapters + token-counter flush exporter + health-check
 * helper. All adapters are injectable into telemetry's `AuditEmitter` /
 * analytics sink interfaces.
 */

export type {
  AuditDecision,
  AuditRecord,
  AuditSink,
  AnalyticsScalar,
  AnalyticsEvent,
  AnalyticsSink,
  AuditEmitterPort,
  R2BucketLike,
  TokenCounterPort,
  TokenCounterSnapshotLike,
  HealthStatus,
  HealthCheckResult,
  HealthReport,
} from "./types.js";

export { createStdoutSink, type StdoutSinkOptions } from "./sinks/stdout.js";
export {
  createR2Sink,
  type R2SinkOptions,
  type R2SinkHandle,
} from "./sinks/r2.js";
export {
  createDatadogSink,
  type DatadogSinkOptions,
  type DatadogSinkHandle,
  type DatadogSite,
} from "./sinks/datadog.js";
export {
  createSinkFromEnv,
  type SinkKind,
  type SinkFactoryEnv,
  type SinkFactoryOptions,
  type SinkFactoryResult,
} from "./sinks/factory.js";
export {
  startTokenCounterFlush,
  type TokenFlushOptions,
  type TokenFlushHandle,
} from "./exporters/token-counter-flush.js";
export {
  createHealthRunner,
  type NamedCheck,
  type HealthRunnerOptions,
} from "./health/health-check.js";
