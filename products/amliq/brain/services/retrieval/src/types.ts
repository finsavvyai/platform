/**
 * Retrieval adapter — types shared with the wider AMLIQ Brain mesh.
 *
 * `ComplianceDoc` is the cross-agent contract shape produced by
 * CORPUS-PIPELINE and indexed by `oss/finsavvy-rag/`. Brain queries return
 * the same shape so downstream agents (SAR Draft, Regulatory Change,
 * Alert Triage) get a single, stable schema regardless of source.
 *
 * 200-line cap; types-only file; runtime impl arrives once finsavvy-rag
 * is published (Week 4 of the decisive plan).
 */

export type Jurisdiction =
  | "US"
  | "UK"
  | "EU"
  | "IL"
  | "CA"
  | "AU"
  | "OTHER";

export type ComplianceSource =
  | "fincen_rss"
  | "ffiec_pdf"
  | "ofac"
  | "ecb"
  | "fca"
  | "internal";

export interface ComplianceDoc {
  /** Logical source of the document. */
  readonly source: ComplianceSource;
  readonly jurisdiction: Jurisdiction;
  /** Stable identifier in the source system (URL hash, FINCEN advisory id, etc.). */
  readonly doc_id: string;
  readonly title: string;
  /** Publication time in ISO-8601 UTC. */
  readonly published_at: string;
  /** SHA-256 of the canonical body bytes (lowercase hex). */
  readonly sha256: string;
  /** Plain-text body (chunked downstream by the retriever). */
  readonly body: string;
}

export interface RetrievalQuery {
  readonly text: string;
  readonly jurisdiction?: Jurisdiction;
  readonly source?: ComplianceSource;
  readonly topK?: number;
}

export interface RetrievalHit {
  readonly doc: ComplianceDoc;
  readonly score: number; // 0..1 (cosine or rrf-normalised)
  readonly chunkIndex?: number;
}

export interface RetrievalResult {
  readonly query: RetrievalQuery;
  readonly hits: readonly RetrievalHit[];
  readonly latencyMs: number;
}

/**
 * DI contract. Brain wires a concrete adapter at boot:
 *   - dev/local → in-memory stub
 *   - staging/prod → oss/finsavvy-rag client (HTTP/gRPC, TBD)
 */
export interface RetrievalAdapter {
  query(q: RetrievalQuery): Promise<RetrievalResult>;
}
