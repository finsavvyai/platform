/**
 * Public surface for AMLIQ Brain corpus ingest pipeline.
 *
 * Consumers (brain wiring layer) compose:
 *   import { runPipeline, fincenRss, ffiecPdf } from "<this pkg>";
 *
 * Indexer + AuditEmitter are injected at composition time; this module
 * provides no defaults to avoid coupling `products/*` to telemetry or
 * finsavvy-rag at compile time.
 */

export type {
  AuditEmitter,
  AuditRecord,
  ComplianceDoc,
  FetchResult,
  Fetcher,
  Indexer,
  IngestError,
  IngestResult,
  SourceConfig,
} from "./types.js";

export { dedupe } from "./dedupe.js";
export { runPipeline } from "./pipeline.js";
export type { PipelineDeps, PipelineSource } from "./pipeline.js";

export { fincenRss } from "./fetchers/fincen-rss.js";
export { ffiecPdf, parseHandbookList } from "./fetchers/ffiec-pdf.js";
