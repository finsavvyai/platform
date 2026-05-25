/**
 * Public surface of the search module.
 *
 * Re-exports only. Wired by `../server.ts` and consumed by SAR-AGENT via
 * the shared `SearchResult` shape.
 */
export { linkCitations } from "./citation-linker.js";
export { buildSearchHandler } from "./search-handler.js";
export type { SearchHandlerOptions } from "./search-handler.js";
export type {
  Citation,
  SearchAdapter,
  SearchAdapterHit,
  SearchAdapterQuery,
  SearchAdapterResult,
  SearchErrorCode,
  SearchRequest,
  SearchResponse,
  SearchResult,
} from "./types.js";
