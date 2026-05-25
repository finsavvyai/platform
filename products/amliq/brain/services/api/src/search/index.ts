/**
 * Public surface of the search module.
 *
 * Re-exports only. Wired by `../server.ts` and consumed by SAR-AGENT via
 * the shared `SearchResult` shape.
 */
export { linkCitations } from "./citation-linker.js";
export {
  createHttpSearchAdapter,
  HttpSearchAdapter,
} from "./http-adapter.js";
export type { HttpSearchAdapterOptions } from "./http-adapter.js";
export { buildSearchHandler } from "./search-handler.js";
export type { SearchHandlerOptions } from "./search-handler.js";
export type {
  Citation,
  SearchAdapter,
  SearchAdapterErrorCode,
  SearchAdapterHit,
  SearchAdapterQuery,
  SearchAdapterResult,
  SearchErrorCode,
  SearchRequest,
  SearchResponse,
  SearchResult,
} from "./types.js";
export { SearchAdapterError } from "./types.js";
