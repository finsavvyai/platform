/**
 * AMLIQ Brain — Compliance Corpus types.
 *
 * `ComplianceDoc` is the cross-agent contract (Brain Week 2 conventions
 * §3). RAG-OSS-PREP indexer accepts this shape verbatim. Do NOT add
 * fields here without coordinating with that agent.
 */

export interface ComplianceDoc {
  /** Logical source key, e.g. "fincen-rss" or "ffiec-pdf". */
  readonly source: string;
  /** ISO 3166-1 alpha-2 jurisdiction code. v1 is "US" only. */
  readonly jurisdiction: string;
  /** Stable source-given id (RSS guid, URL slug, etc.). */
  readonly doc_id: string;
  /** Human title from source. */
  readonly title: string;
  /** ISO-8601 publication timestamp from source (never invented). */
  readonly published_at: string;
  /** Hex sha256 of the normalised `body`. Source of truth for dedupe. */
  readonly sha256: string;
  /** Plain-text body, fetcher-normalised (no HTML, no PDF binary). */
  readonly body: string;
}

/**
 * A single configured input source for the pipeline.
 * Fetchers consume one of these and return zero or more docs + errors.
 */
export interface SourceConfig {
  /** Matches `ComplianceDoc.source`. */
  readonly source: string;
  /** Endpoint or base URL. Never hard-coded in source; supplied by caller. */
  readonly url: string;
  /** Jurisdiction tag applied to every doc this source produces. */
  readonly jurisdiction: string;
}

/**
 * Structured error from a fetcher or the pipeline. Never throws across
 * doc boundaries — accumulates here so the batch survives a bad record.
 */
export interface IngestError {
  readonly source: string;
  readonly stage: "fetch" | "parse" | "dedupe" | "index" | "audit";
  readonly code: string;
  readonly message: string;
}

/**
 * Result of a single fetcher invocation.
 * `errors.length > 0` does NOT imply `docs.length === 0` — partial
 * success is the expected path.
 */
export interface FetchResult {
  readonly docs: readonly ComplianceDoc[];
  readonly errors: readonly IngestError[];
}

/**
 * Result of the orchestrator. `indexed` is the count actually handed to
 * the indexer (post-dedupe). `audited` is the count successfully audit-
 * emitted (may be < indexed if the audit sink misbehaves).
 */
export interface IngestResult {
  readonly fetched: number;
  readonly deduped: number;
  readonly indexed: number;
  readonly audited: number;
  readonly errors: readonly IngestError[];
}

/** Indexer contract — implemented by oss/finsavvy-rag, injected here. */
export interface Indexer {
  /** Receives only post-dedupe documents. Idempotent on sha256. */
  index(docs: readonly ComplianceDoc[]): Promise<void>;
  /**
   * Returns the set of sha256 already known to the index, so the
   * pipeline can skip them. Empty set means "treat everything as new".
   */
  knownShas(): Promise<ReadonlySet<string>>;
}

/** Audit-emit contract — implemented by AUDIT-TAMPER (or telemetry adapter). */
export interface AuditEmitter {
  emit(record: AuditRecord): Promise<void>;
}

/** Audit record shape per round-1 + AMLIQ extensions. PII-free. */
export interface AuditRecord {
  readonly ts: string;
  readonly actor_id: string;
  readonly event: string;
  readonly resource: string;
  readonly decision: string;
  readonly reason: string;
  readonly meta: Readonly<Record<string, string>>;
}

/** Fetcher signature shared by every source-specific implementation. */
export type Fetcher = (cfg: SourceConfig) => Promise<FetchResult>;
