import {
  GatewayExhaustedError,
  NonRetryableProviderError,
  RetryableProviderError,
} from "./errors.js";
import type { RetryConfig } from "./types.js";

const DEFAULT_BASE_MS = 50;
const DEFAULT_MAX_MS = 2_000;
const DEFAULT_ATTEMPTS = 3;

/**
 * Decides whether a thrown provider error should be retried.
 *
 * Rules:
 *   - NonRetryableProviderError -> never retry.
 *   - RetryableProviderError -> always retry.
 *   - HTTP-like error with numeric .status:
 *       * 408 (timeout), 429 (rate limit) -> retry.
 *       * Any other 4xx -> do NOT retry.
 *       * 5xx -> retry.
 *   - Anything else (e.g. network error) -> retry.
 */
export function isRetryable(err: unknown): boolean {
  if (err instanceof NonRetryableProviderError) return false;
  if (err instanceof RetryableProviderError) return true;

  const status = readStatus(err);
  if (status === undefined) return true;
  if (status === 408 || status === 429) return true;
  if (status >= 400 && status < 500) return false;
  return true;
}

function readStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const s = (err as { status?: unknown }).status;
  return typeof s === "number" ? s : undefined;
}

export function backoffDelayMs(
  attempt: number,
  base: number,
  cap: number,
  jitter: () => number,
): number {
  // Decorrelated jitter: exp = base * 2^(attempt-1), then jittered in [base, exp].
  const exp = Math.min(cap, base * 2 ** Math.max(0, attempt - 1));
  const lo = base;
  const hi = Math.max(lo, exp);
  const j = clamp01(jitter());
  return Math.floor(lo + (hi - lo) * j);
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export async function runWithRetry<T>(
  op: (attempt: number) => Promise<T>,
  cfg: RetryConfig = {},
): Promise<{ value: T; attempts: number }> {
  const max = cfg.maxAttempts ?? DEFAULT_ATTEMPTS;
  const base = cfg.baseDelayMs ?? DEFAULT_BASE_MS;
  const cap = cfg.maxDelayMs ?? DEFAULT_MAX_MS;
  const jitter = cfg.jitter ?? Math.random;
  const sleep = cfg.sleep ?? defaultSleep;

  if (max < 1) throw new Error("retry maxAttempts must be >= 1");

  let lastErr: unknown;
  for (let attempt = 1; attempt <= max; attempt++) {
    try {
      const value = await op(attempt);
      return { value, attempts: attempt };
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err)) throw err;
      if (attempt >= max) break;
      const delay = backoffDelayMs(attempt, base, cap, jitter);
      await sleep(delay);
    }
  }
  throw new GatewayExhaustedError(lastErr);
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
