/**
 * Pure sliding-window rate-limit decision function.
 *
 * Given a request's `now`, the window definition, and the historical
 * timestamps observed for the bucket, returns a `RateLimitDecision`
 * conforming to mesh §10.
 *
 * This module is pure (no I/O, no clock dependency, no mutation of
 * inputs) so it can be unit-tested at 100% line + branch coverage.
 * Stateful storage lives behind the `RateLimitStore` interface and is
 * exercised by `tenant-rate-limit.ts` / `middleware.ts`.
 *
 * Algorithm:
 *   1. Prune timestamps older than `(now - windowMs - skewMs)`.
 *   2. Clamp future timestamps newer than `(now + skewMs)` to `now`.
 *   3. If `pruned.length < maxRequests` → allow.
 *   4. Else → deny with `retry_after_ms = oldest_in_window + windowMs - now`.
 *
 * The function NEVER throws. Invalid configs (windowMs <= 0,
 * maxRequests <= 0) are surfaced as `rate_limit.config_invalid` denials
 * so callers see a deterministic decision rather than an exception in
 * the request hot-path.
 */

import type {
  RateLimitConfig,
  RateLimitDecision,
} from "./types.js";

const denyConfigInvalid = (): RateLimitDecision => ({
  allowed: false,
  reason: "rate_limit.config_invalid",
});

const allow = (): RateLimitDecision => ({ allowed: true });

const denyWindow = (retryMs: number): RateLimitDecision => ({
  allowed: false,
  reason: "rate_limit.window_exceeded",
  retry_after_ms: retryMs > 0 ? retryMs : 1,
});

/** Returns true iff config values are positive and finite. */
const isConfigValid = (cfg: RateLimitConfig): boolean => {
  if (!Number.isFinite(cfg.windowMs) || cfg.windowMs <= 0) return false;
  if (!Number.isFinite(cfg.maxRequests) || cfg.maxRequests <= 0) return false;
  if (cfg.skewMs !== undefined) {
    if (!Number.isFinite(cfg.skewMs) || cfg.skewMs < 0) return false;
  }
  return true;
};

/**
 * Compute the sliding-window decision.
 *
 * @param now           Current time, ms since epoch.
 * @param config        Window + cap.
 * @param history       Recorded request timestamps for this bucket.
 *                      The function does not mutate the input array.
 */
export const decideSlidingWindow = (
  now: number,
  config: RateLimitConfig,
  history: readonly number[],
): RateLimitDecision => {
  if (!isConfigValid(config)) return denyConfigInvalid();
  if (!Number.isFinite(now)) return denyConfigInvalid();

  const skew = config.skewMs ?? 0;
  const cutoff = now - config.windowMs - skew;
  const futureCap = now + skew;

  // Single pass: clamp future entries and drop expired ones.
  const live: number[] = [];
  for (const ts of history) {
    if (!Number.isFinite(ts)) continue; // defensive: drop garbage entries
    const clamped = ts > futureCap ? now : ts;
    if (clamped > cutoff) live.push(clamped);
  }

  if (live.length < config.maxRequests) return allow();

  // At-or-over capacity. Compute retry-after from oldest in-window entry.
  // Invariant: live.length >= maxRequests >= 1 so live[0] is always set.
  let oldest = live[0] as number;
  for (const ts of live) {
    if (ts < oldest) oldest = ts;
  }
  const retryMs = oldest + config.windowMs - now;
  return denyWindow(retryMs);
};
