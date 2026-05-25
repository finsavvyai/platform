/**
 * ComplianceDoc — cross-agent contract for regulatory documents flowing from
 * a corpus pipeline (e.g. FinCEN RSS / FFIEC PDF crawler) into the finsavvy-rag
 * indexer.
 *
 * Producer: CORPUS-PIPELINE (products/amliq/brain/corpus/).
 * Consumer: finsavvy-rag indexer (this package's services/rag/ingest).
 *
 * Contract is intentionally minimal; consumers MAY carry extra fields in
 * `meta`, but the seven canonical fields below MUST be present.
 *
 * License: Apache-2.0
 */

/**
 * A canonical compliance / regulatory document, normalised for embedding +
 * retrieval. All fields are required.
 */
export interface ComplianceDoc {
  /**
   * Originating publisher / feed identifier.
   * Examples: "fincen", "ffiec", "ofac", "occ".
   * Lowercase, kebab-case for multi-word sources.
   */
  source: string;

  /**
   * ISO-3166-1 alpha-2 country code or a recognised supra-national region.
   * Examples: "US", "UK", "EU".
   */
  jurisdiction: string;

  /**
   * Stable, source-assigned document identifier.
   * MUST be unique within `source`. Used as the pgvector `documents.doc_id`
   * upsert key, so changing it creates a new row rather than updating one.
   */
  doc_id: string;

  /**
   * Human-readable title of the document.
   */
  title: string;

  /**
   * Publication timestamp in ISO 8601 (RFC 3339) format.
   * Examples: "2026-05-25T00:00:00Z", "2026-05-25".
   * Producers SHOULD prefer the more precise form when available.
   */
  published_at: string;

  /**
   * Lowercase hex SHA-256 of the `body` field as bytes (UTF-8 encoded).
   * Used by consumers to detect content drift across re-ingests.
   * Length: exactly 64 hex characters.
   */
  sha256: string;

  /**
   * Plain-text body of the document. Producers are responsible for stripping
   * markup (HTML, PDF text-extraction artefacts, etc.) before emitting.
   * Whitespace SHOULD be normalised but is not strictly required.
   */
  body: string;
}

/**
 * Narrow runtime type guard. Useful at I/O boundaries when accepting docs
 * from untrusted producers (queue payloads, file imports). Performs structural
 * checks only — does NOT validate sha256 against body, jurisdiction codes,
 * or published_at format.
 */
export function isComplianceDoc(value: unknown): value is ComplianceDoc {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.source === "string" &&
    typeof v.jurisdiction === "string" &&
    typeof v.doc_id === "string" &&
    typeof v.title === "string" &&
    typeof v.published_at === "string" &&
    typeof v.sha256 === "string" &&
    typeof v.body === "string" &&
    v.sha256.length === 64
  );
}
