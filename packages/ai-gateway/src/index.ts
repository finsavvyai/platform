export * from "./types.js";
export {
  NoRouteError,
  NonRetryableProviderError,
  RetryableProviderError,
  GatewayExhaustedError,
} from "./errors.js";
export { AiGateway, type GatewayConfig } from "./gateway.js";
export { InMemorySemanticCache, type CacheConfig, deriveCacheKey } from "./cache.js";
export { TokenCounter } from "./accounting.js";
export { selectAdapter } from "./routing.js";
export { runWithRetry, isRetryable, backoffDelayMs } from "./retry.js";

/**
 * Edge transport layer. Promoted from `portfolio/fintech-suite/api-gateway`
 * (PipeWarden) in round 2 — JWT verify, rate limiting, response cache,
 * security headers, audit emission. Wraps `AiGateway` for Cloudflare Workers
 * and other Web-Fetch runtimes.
 */
export * as edge from "./edge/index.js";
