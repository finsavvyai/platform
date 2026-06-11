/**
 * Public surface of @finsavvyai/amliq-brain/api.
 *
 * Consumers wire concrete AuthVerifier + AuditSink + (optional) AuditChain
 * implementations and call createBrainApp(config).app.fetch / listen.
 */

export { createBrainApp } from "./server.js";
export type { BrainApp } from "./server.js";

export { createBrainHostApp } from "./runtime.js";
export type { BrainHostConfig } from "./runtime.js";

export {
  createBrainWorkerApp,
  createBrainWorkerFetch,
  default as brainWorker,
} from "./worker.js";
export type { BrainWorkerDeps, BrainWorkerEnv } from "./worker.js";

export {
  createBrainNodeAuditBucket,
  createBrainNodeFetch,
} from "./node-host.js";
export type {
  AuditLogWriter,
  BrainNodeDeps,
  BrainNodeEnv,
} from "./node-host.js";

export {
  createBrainNodeHttpServer,
  startBrainNodeServer,
} from "./node-server.js";
export type { BrainNodeServerOptions } from "./node-server.js";

export {
  createWorkerAuthVerifier,
  workerRequiredRole,
} from "./worker-auth.js";
export type { BrainWorkerAuthEnv } from "./worker-auth.js";

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

export {
  auditRetentionPrefix,
  purgeExpiredAuditObjects,
} from "./audit-prod/retention.js";
export type {
  AuditRetentionPurgeOptions,
  AuditRetentionPurgeResult,
  R2AuditBucket,
  R2AuditListResult,
  R2AuditObject,
} from "./audit-prod/retention.js";

export { HealthBuilder } from "./health.js";
export type { HealthBuilderOptions } from "./health.js";

export {
  createHttpSearchAdapter,
  buildSearchHandler,
  HttpSearchAdapter,
  linkCitations,
} from "./search/index.js";
export type {
  Citation,
  HttpSearchAdapterOptions,
  SearchAdapter,
  SearchAdapterErrorCode,
  SearchAdapterHit,
  SearchAdapterQuery,
  SearchAdapterResult,
  SearchErrorCode,
  SearchHandlerOptions,
  SearchRequest,
  SearchResponse,
  SearchResult,
} from "./search/index.js";
export { SearchAdapterError } from "./search/index.js";

export {
  buildSarDraftHandler,
  createHttpSarDraftGenerator,
  HttpSarDraftGenerator,
  SarDraftGeneratorError,
} from "./sar-draft/index.js";
export type {
  HttpSarDraftGeneratorOptions,
  SarAlertInput,
  SarDraft,
  SarDraftErrorCode,
  SarDraftGenerator,
  SarDraftGeneratorErrorCode,
  SarDraftHandlerOptions,
  SarDraftResponse,
} from "./sar-draft/index.js";

export * from "./rate-limit/index.js";

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
