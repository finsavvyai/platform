/**
 * Public surface of @finsavvyai/amliq-brain/api.
 *
 * Consumers wire concrete AuthVerifier + AuditSink + (optional) AuditChain
 * implementations and call createBrainApp(config).app.fetch / listen.
 */

export { createBrainApp } from "./server.js";
export type { BrainApp } from "./server.js";

export {
  buildAuthMiddleware,
  getBrainAuth,
  BRAIN_AUTH_CTX_KEY,
} from "./auth.js";
export type {
  AuthMiddlewareOptions,
  BrainAuthContext,
} from "./auth.js";

export { BrainAuditEmitter } from "./audit.js";
export type { AuditEmitterOptions, EmitResult } from "./audit.js";

export { HealthBuilder } from "./health.js";
export type { HealthBuilderOptions } from "./health.js";

export type {
  AuthClaims,
  AuthErrorCode,
  AuthVerifier,
  AuthVerifyErr,
  AuthVerifyOk,
  AuthVerifyResult,
  AuditChain,
  AuditChainInfo,
  AuditDecision,
  AuditInput,
  AuditRecord,
  AuditSink,
  BrainApiConfig,
  ChainAppendResult,
  HealthCheck,
  HealthProbe,
  HealthSnapshot,
  HealthStatus,
} from "./types.js";
