/**
 * Rate-limit shared types for the AMLIQ Brain API.
 *
 * Mesh §10 contract — the canonical decision shape returned by every
 * rate-limit checker (sliding-window, tenant-aware, future leaky-bucket)
 * is `RateLimitDecision`. Brain server middleware consumes this shape
 * directly and emits a stable-coded audit record on rejection.
 *
 * All identifiers and reason codes are wire-stable. Adding a new reason
 * requires updating: this file, the audit runbook for `RATE_LIMIT_SPIKE`,
 * and the SOC 2 readiness control mapping (CC7.2 anomaly detection).
 */

/**
 * Stable wire-level reason codes. Returned in `RateLimitDecision.reason`
 * and emitted as the `reason` field on `brain.rate_limit.rejected`
 * audit records.
 *
 * - `rate_limit.window_exceeded`   — sliding-window cap exceeded.
 * - `rate_limit.tenant_exceeded`   — per-tenant cap exceeded.
 * - `rate_limit.store_unavailable` — backing store call failed (fail-open by default).
 * - `rate_limit.config_invalid`    — middleware invoked with invalid config (defensive).
 */
export type RateLimitReason =
  | "rate_limit.window_exceeded"
  | "rate_limit.tenant_exceeded"
  | "rate_limit.store_unavailable"
  | "rate_limit.config_invalid";

/**
 * The contract every rate-limit checker returns. `allowed=true` always
 * means the request is permitted and `retry_after_ms` / `reason` MUST
 * be undefined. `allowed=false` MUST set `reason` and SHOULD set
 * `retry_after_ms` so the HTTP `Retry-After` header can be computed.
 */
export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly retry_after_ms?: number;
  readonly reason?: RateLimitReason;
}

/** Static configuration shared by all checkers. */
export interface RateLimitConfig {
  /** Window length in milliseconds. Must be > 0. */
  readonly windowMs: number;
  /** Maximum requests allowed in the window. Must be > 0. */
  readonly maxRequests: number;
  /**
   * Clock-skew tolerance in ms. Timestamps older than (now - windowMs -
   * skewMs) are pruned; timestamps newer than (now + skewMs) are clamped.
   * Defaults to 0 — set non-zero only when the underlying store can return
   * future-dated entries (distributed clocks).
   */
  readonly skewMs?: number;
}

/**
 * Async store interface for cross-request counter persistence. DI-friendly
 * so the brain server can swap KV / D1 / in-memory at composition time.
 *
 * Implementations MUST be tenant-keyed at the caller level (the store
 * itself is namespace-agnostic). Callers compose `${tenant_id}:${bucket}`
 * before invocation.
 *
 * Contract:
 * - `read` returns the recorded timestamps (ms since epoch). MAY return
 *   stale entries; the caller prunes against the window.
 * - `record` appends `nowMs` to the bucket. SHOULD persist atomically.
 * - Implementations MUST NOT throw on transient failures; return null
 *   from `read` and resolve `record` to false. The middleware decides
 *   fail-open vs fail-closed.
 */
export interface RateLimitStore {
  read(key: string): Promise<readonly number[] | null>;
  record(key: string, nowMs: number): Promise<boolean>;
}

/**
 * Hono middleware options. `failClosed` controls behaviour when the
 * store is unavailable — default is `false` (fail-open) which matches
 * portfolio policy: never block a legitimate user because of a cache
 * outage; alert instead.
 */
export interface RateLimitMiddlewareOptions {
  readonly config: RateLimitConfig;
  readonly store: RateLimitStore;
  /** Returns the bucket key for a given request (e.g. IP, tenant, route). */
  readonly keyFn: (req: { readonly headers: Headers; readonly path: string }) =>
    | string
    | null;
  /** Audit emit callback. Invoked once per rejection. Must not throw. */
  readonly onReject?: (info: RateLimitRejection) => void;
  /** Override `Date.now` for tests. */
  readonly clock?: () => number;
  /** When true, store failure denies the request. Default: false. */
  readonly failClosed?: boolean;
  /** Routes never rate-limited. Default: ["/health"]. */
  readonly bypassPaths?: readonly string[];
}

/** Info passed to the audit `onReject` callback. */
export interface RateLimitRejection {
  readonly key: string;
  readonly path: string;
  readonly nowMs: number;
  readonly decision: RateLimitDecision;
}
