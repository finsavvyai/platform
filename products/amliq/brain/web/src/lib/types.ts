/**
 * Local mirror of the Brain search contract (mesh §3).
 *
 * Mirrored — NOT imported — to honour the round-2 rule: this `web/` package
 * MUST NOT import from `@finsavvyai/*` or sibling product subtrees. The
 * shapes are stable cross-agent contracts and re-defining them here keeps
 * the UI deployable independently from the API source tree.
 *
 * If the contract changes upstream (services/api/src/search/types.ts), the
 * Brain release checklist requires this mirror to be updated in the same
 * release.
 */
export interface Citation {
  readonly doc_id: string;
  readonly span_start: number;
  readonly span_end: number;
  readonly source: string;
}

export interface SearchResult {
  readonly doc_id: string;
  readonly snippet: string;
  readonly score: number;
  readonly citations: readonly Citation[];
}

export interface SearchResponse {
  readonly ok: true;
  readonly query: string;
  readonly results: readonly SearchResult[];
  readonly latencyMs: number;
}

export interface SearchErrorResponse {
  readonly ok: false;
  readonly error: string;
}

export type SearchApiResponse = SearchResponse | SearchErrorResponse;
