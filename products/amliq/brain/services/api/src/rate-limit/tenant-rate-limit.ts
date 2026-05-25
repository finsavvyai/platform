/**
 * Per-tenant sliding-window rate limit, composing `decideSlidingWindow`
 * with a `RateLimitStore` for cross-request persistence.
 *
 * Surface kept narrow: one `check` function. The Hono middleware in
 * `middleware.ts` is the only intended caller. Tenant rate-limiting is
 * applied after auth; the IP-keyed rate-limit (also in `middleware.ts`)
 * runs before auth and uses the same primitive on a different store key.
 *
 * Failure semantics:
 *   - Store `read` returns `null` (transient store failure) → return
 *     `rate_limit.store_unavailable`. The middleware decides whether
 *     to fail-open (default, portfolio policy) or fail-closed.
 *   - Store `record` returns `false` (transient write failure) → return
 *     allow (we already let the request through) but propagate the
 *     `record_failed` signal via `recorded=false` so the caller can
 *     log it.
 *
 * 100% line + branch coverage required: store-failure paths are
 * security-relevant (must not silently swallow errors).
 */

import type {
  RateLimitConfig,
  RateLimitDecision,
  RateLimitStore,
} from "./types.js";
import { decideSlidingWindow } from "./sliding-window.js";

export interface TenantRateLimitInput {
  readonly tenantId: string;
  readonly bucket: string;
  readonly nowMs: number;
}

export interface TenantRateLimitResult {
  readonly decision: RateLimitDecision;
  /** True iff the request was recorded into the store. */
  readonly recorded: boolean;
}

/**
 * Compose the bucket key. Always `tenant:${id}:${bucket}` so a single
 * KV/D1 namespace can host both tenant-scoped and IP-scoped limits
 * without collision (IP limits use `ip:${addr}:${bucket}`).
 */
export const tenantKey = (tenantId: string, bucket: string): string =>
  `tenant:${tenantId}:${bucket}`;

/**
 * Run a per-tenant sliding-window check.
 *
 * Order of operations is deliberate:
 *   1. read existing history
 *   2. decide on the read-snapshot (deterministic + testable)
 *   3. record the new timestamp ONLY if allowed (denied requests do not
 *      extend the window — prevents adversaries from keeping themselves
 *      throttled forever via repeated probes, the "lockout amplifier"
 *      anti-pattern)
 */
export const checkTenantRateLimit = async (
  config: RateLimitConfig,
  store: RateLimitStore,
  input: TenantRateLimitInput,
): Promise<TenantRateLimitResult> => {
  const key = tenantKey(input.tenantId, input.bucket);

  const history = await store.read(key);
  if (history === null) {
    return {
      decision: {
        allowed: false,
        reason: "rate_limit.store_unavailable",
      },
      recorded: false,
    };
  }

  const decision = decideSlidingWindow(input.nowMs, config, history);

  if (!decision.allowed) {
    // Re-tag as tenant-specific reason for audit clarity, unless it was
    // a config error (which dominates and must surface raw).
    if (decision.reason === "rate_limit.window_exceeded") {
      // Invariant: `window_exceeded` is always produced with retry_after_ms
      // set (see `denyWindow` in sliding-window.ts), so we propagate it.
      return {
        decision: {
          allowed: false,
          reason: "rate_limit.tenant_exceeded",
          retry_after_ms: decision.retry_after_ms as number,
        },
        recorded: false,
      };
    }
    return { decision, recorded: false };
  }

  const ok = await store.record(key, input.nowMs);
  return { decision, recorded: ok };
};
