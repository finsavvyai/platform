/**
 * Search endpoint types for AMLIQ Brain.
 *
 * Cross-agent contract (mesh §3):
 *   SearchResult { doc_id, snippet, score, citations: Citation[] }
 *   Citation     { doc_id, span_start, span_end, source }
 *
 * SEARCH-UI defines; SAR-AGENT consumes for context fill.
 *
 * SearchRequest carries an explicit `tenant_id` so the adapter call can
 * enforce tenant scope (round-2 isolation). Once MULTI-TENANT publishes
 * `TenantContext` in `../tenant/types.ts`, the handler will derive
 * `tenant_id` from that DI input; the request shape stays stable.
 *
 * Types-only file. 200-line cap.
 */
import type { ComplianceDoc } from "../../../retrieval/src/types.js";

/** Inbound search request body. */
export interface SearchRequest {
  readonly q: string;
  readonly tenant_id: string;
  readonly top_k?: number;
}

/** Citation pointing back to a span inside the source document. */
export interface Citation {
  readonly doc_id: string;
  readonly span_start: number;
  readonly span_end: number;
  /** Source URI / id of the originating document (e.g. FinCEN advisory). */
  readonly source: string;
}

/** One result row returned to the caller. */
export interface SearchResult {
  readonly doc_id: string;
  readonly snippet: string;
  readonly score: number;
  readonly citations: readonly Citation[];
}

/** Top-level response envelope. */
export interface SearchResponse {
  readonly ok: true;
  readonly query: string;
  readonly results: readonly SearchResult[];
  readonly latencyMs: number;
}

/** Hit returned from the underlying retrieval system (DI). */
export interface SearchAdapterHit {
  readonly doc: ComplianceDoc;
  readonly snippet: string;
  readonly score: number;
}

export interface SearchAdapterResult {
  readonly hits: readonly SearchAdapterHit[];
  readonly latencyMs: number;
}

export interface SearchAdapterQuery {
  readonly text: string;
  readonly tenantId: string;
  readonly topK: number;
}

/**
 * DI contract. At runtime this wraps `oss/finsavvy-rag`. The handler does
 * NOT import the rag package directly — round-2 rule.
 *
 * Implementations MUST honour `tenantId` (scope retrieval to the caller's
 * tenant). Mixing tenants is a release-blocking defect.
 */
export interface SearchAdapter {
  query(q: SearchAdapterQuery): Promise<SearchAdapterResult>;
}

/** Stable error codes for the search endpoint. */
export type SearchErrorCode =
  | "missing_query"
  | "missing_tenant"
  | "tenant_mismatch"
  | "adapter_error"
  | "audit_emit_failed";
