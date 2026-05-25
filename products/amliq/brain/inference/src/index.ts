/**
 * Brain ↔ Cluster inference bridge — public entrypoint.
 *
 * Consumers (Brain agents, retrieval service, sanctions service) import
 * from `@finsavvyai/amliq-brain/inference` and use only what is
 * re-exported here. Internal HTTP/retry helpers live in
 * ./http-internal and are intentionally NOT re-exported.
 */

export {
  type ChatMessage,
  type ChatRole,
  type ChatTool,
  type CompletionChoice,
  type CompletionRequest,
  type CompletionResponse,
  InferenceError,
  InferenceExhaustedError,
  type InferenceProvider,
  InferenceProviderError,
  InferenceTransportError,
  type JwtSigner,
  type TokenUsage,
} from "./types.js";

export {
  ClusterInferenceProvider,
  type ClusterProviderConfig,
} from "./cluster-provider.js";

export {
  FallbackInferenceProvider,
  type FallbackProviderConfig,
} from "./fallback-provider.js";
