/**
 * Edge transport layer. Wraps the round-1 `AiGateway` orchestrator with
 * Cloudflare-Workers-compatible primitives: JWT verify, rate limiting,
 * response cache, security headers, audit emission.
 *
 * Runtime-agnostic: every export consumes/produces standard Web Fetch
 * `Request`/`Response` so the same code runs on Workers, Node 20+ HTTP
 * shims, Deno, or inside a Hono `app.all('*', handler)` mount.
 */

export { createEdgeHandler, type EdgeHandlerConfig } from "./handler.js";
export { verifyJwt, signHs256, type VerifyOptions } from "./jwt.js";
export { extractAuth, clientIpOf } from "./extract-auth.js";
export { RateLimiter, defaultKeyFor, type RateLimitConfig, type RateLimiterOptions } from "./rate-limit.js";
export { EdgeResponseCache, buildEtag, type ResponseCacheConfig, type CachedResponse } from "./response-cache.js";
export { InMemoryKvStore } from "./kv-memory.js";
export { securityHeaders, withHeaders, type SecurityHeaderOptions } from "./security-headers.js";
export { emitAudit, redact } from "./audit.js";
export { parseCompletionBody } from "./parse-completion.js";
export {
  EdgeAuthError,
  EdgeRateLimitedError,
  EdgeBadRequestError,
} from "./errors.js";
export type {
  ActorId,
  AuthClaims,
  AuthResult,
  AuditSink,
  EdgeAuditEvent,
  KvStore,
  RateLimitDecision,
} from "./types.js";
