/**
 * Retrieval adapter — public surface.
 *
 * The port (types below) stays impl-agnostic. The concrete
 * `HttpRetrievalAdapter` (Week 4) wires the port to the `oss/finsavvy-rag`
 * FastAPI service over HTTP. Consumers depend on the `RetrievalAdapter`
 * interface and receive a concrete adapter via DI at boot.
 */

export type {
  ComplianceDoc,
  ComplianceSource,
  Jurisdiction,
  RetrievalAdapter,
  RetrievalHit,
  RetrievalQuery,
  RetrievalResult,
} from "./types.js";

export {
  HttpRetrievalAdapter,
  createHttpRetrievalAdapter,
} from "./http-adapter.js";

export {
  RetrievalAdapterError,
  type HttpRetrievalAdapterOptions,
  type IngestSummary,
  type RetrievalAdapterErrorCode,
} from "./http-types.js";
