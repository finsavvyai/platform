/**
 * Wiring types for the HTTP RetrievalAdapter.
 *
 * Kept separate from the port (`./types.ts`, which stays impl-agnostic) so
 * the contract surface consumed by downstream agents does not leak HTTP
 * concerns. 200-line cap; types + one error class only.
 */

export interface HttpRetrievalAdapterOptions {
  /** Base URL of the finsavvy-rag service, e.g. "https://rag.internal". */
  readonly baseUrl: string;
  /** Injectable fetch (tests pass a fake; prod uses global fetch). */
  readonly httpFetch?: typeof fetch;
  /** Extra headers (auth token, tenant scope) merged into every request. */
  readonly headers?: Readonly<Record<string, string>>;
  /** Per-request abort timeout in ms. Defaults to 10_000. */
  readonly timeoutMs?: number;
}

/** Result of a successful `/ingest` call. */
export interface IngestSummary {
  readonly ok: true;
  readonly count: number;
}

/** Stable error codes — no free-form strings cross the Brain boundary. */
export type RetrievalAdapterErrorCode =
  | "bad_response"
  | "network_error"
  | "timeout"
  | "upstream_error";

export class RetrievalAdapterError extends Error {
  readonly code: RetrievalAdapterErrorCode;
  readonly status?: number;

  constructor(
    code: RetrievalAdapterErrorCode,
    message: string,
    status?: number,
  ) {
    super(message);
    this.name = "RetrievalAdapterError";
    this.code = code;
    if (status !== undefined) this.status = status;
  }
}
