/**
 * Hono rate-limit middleware factory.
 *
 * Mounts BEFORE auth + tenant middleware so abusive callers cannot burn
 * CPU on JWT verification. The middleware is always safe to mount:
 *   - `/health` (and any `bypassPaths`) is never rate-limited (SEV1
 *     observability must not be self-throttled).
 *   - `keyFn === null` means "this request is not a rate-limit subject"
 *     — also bypasses.
 *   - Store failure is fail-open by default; flip `failClosed: true`
 *     only in high-threat environments.
 *
 * On rejection: returns HTTP 429 with the canonical
 * `{ ok: false, error: <stable_code> }` body, sets the `Retry-After`
 * header in seconds (RFC 7231 §7.1.3), and invokes the `onReject`
 * callback so the host can emit one `brain.rate_limit.rejected` audit
 * record per rejection (mesh §10 + AMLIQ audit rule).
 *
 * 100% line + branch coverage required on the rejection path.
 */

import type { Context, MiddlewareHandler, Next } from "hono";
import { decideSlidingWindow } from "./sliding-window.js";
import type {
  RateLimitDecision,
  RateLimitMiddlewareOptions,
  RateLimitRejection,
} from "./types.js";

const DEFAULT_BYPASS = ["/health"] as const;

const isBypassed = (
  path: string,
  bypass: readonly string[],
): boolean => {
  for (const b of bypass) {
    if (path === b) return true;
  }
  return false;
};

const retryAfterSeconds = (decision: RateLimitDecision): number => {
  const ms = decision.retry_after_ms ?? 1000;
  // Round up so clients always sleep at least the advertised window.
  return Math.max(1, Math.ceil(ms / 1000));
};

const rejectResponse = (
  c: Context,
  decision: RateLimitDecision,
): Response => {
  // Invariant: callers only invoke rejectResponse with !allowed decisions
  // produced by decideSlidingWindow (always sets reason) or by the
  // store-unavailable branch (sets reason). reason is always defined here.
  const retry = retryAfterSeconds(decision);
  return c.json(
    { ok: false, error: decision.reason as string },
    429,
    { "Retry-After": String(retry) },
  );
};

/**
 * Build the Hono middleware. The returned handler is stateless; all
 * mutable state lives behind the injected `RateLimitStore`.
 */
export const createRateLimitMiddleware = (
  opts: RateLimitMiddlewareOptions,
): MiddlewareHandler => {
  const clock = opts.clock ?? (() => Date.now());
  const bypass = opts.bypassPaths ?? DEFAULT_BYPASS;
  const failClosed = opts.failClosed ?? false;

  return async (c: Context, next: Next): Promise<Response | void> => {
    const path = c.req.path;
    if (isBypassed(path, bypass)) {
      await next();
      return;
    }

    const key = opts.keyFn({ headers: c.req.raw.headers, path });
    if (key === null) {
      await next();
      return;
    }

    const now = clock();

    const history = await opts.store.read(key);
    if (history === null) {
      // Store unavailable: emit audit so SEV3 alert fires; decide fail policy.
      const decision: RateLimitDecision = {
        allowed: false,
        reason: "rate_limit.store_unavailable",
      };
      emitReject(opts.onReject, { key, path, nowMs: now, decision });
      if (!failClosed) {
        await next();
        return;
      }
      return rejectResponse(c, decision);
    }

    const decision = decideSlidingWindow(now, opts.config, history);
    if (!decision.allowed) {
      emitReject(opts.onReject, { key, path, nowMs: now, decision });
      return rejectResponse(c, decision);
    }

    // Record allowed request. Fire-and-forget failure: log via reject
    // callback with a synthetic decision so observability sees it,
    // but never block the user.
    const recorded = await opts.store.record(key, now);
    if (!recorded) {
      emitReject(opts.onReject, {
        key,
        path,
        nowMs: now,
        decision: {
          allowed: false,
          reason: "rate_limit.store_unavailable",
        },
      });
    }
    await next();
    return;
  };
};

const emitReject = (
  cb: ((info: RateLimitRejection) => void) | undefined,
  info: RateLimitRejection,
): void => {
  if (cb === undefined) return;
  try {
    cb(info);
  } catch {
    // Audit emit failure is logged elsewhere; never throw from middleware.
  }
};
