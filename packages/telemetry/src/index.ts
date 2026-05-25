export * from "./types.js";
export { InMemoryTracer } from "./tracer.js";
export type { StartOptions } from "./tracer.js";
export { InMemoryAiLogger } from "./ai-logger.js";
export type { AiLoggerOptions } from "./ai-logger.js";
export {
  AuditEmitter,
  createAuditEmitter,
  type AuditDecision,
  type AuditEmitterOptions,
  type AuditInput,
  type AuditRecord,
  type AuditSink,
} from "./audit-log.js";
export { DEFAULT_REDACT_KEYS, REDACTED, redact, type RedactOptions } from "./redact.js";

// Analytics namespace — financial analytics + reporting.
// Kept deliberately separate from raw OTel traces above.
export * as analytics from "./analytics/index.js";
