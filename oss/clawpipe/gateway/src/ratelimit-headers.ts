/** RFC 9239 RateLimit-* response headers.
 *
 * https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/
 *
 * Format used:
 *   RateLimit-Limit: <limit>, <limit>;w=<window-seconds>
 *   RateLimit-Remaining: <count>
 *   RateLimit-Reset: <seconds-until-reset>
 *
 * "Reset" is delta-seconds (not an HTTP-date) per the RFC's preferred form.
 */

import type { Env } from './types';
import { getProjectTier } from './billing/usage';
import { TIER_LIMITS } from './billing/types';

const DAY_SECONDS = 86_400;

export interface RateLimitView {
  limit: number;
  remaining: number;
  resetSec: number;
  /** Window in seconds. ClawPipe is daily-bucketed -> 86_400. */
  windowSec: number;
}

/** Seconds until next UTC midnight. */
export function secondsUntilUtcMidnight(now: Date = new Date()): number {
  const tomorrow = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0,
  ));
  return Math.max(0, Math.floor((tomorrow.getTime() - now.getTime()) / 1000));
}

/** Compute the rate-limit view for a project. -1 limit (unlimited) is
 *  reported as a numeric ceiling using Number.MAX_SAFE_INTEGER so the headers
 *  remain syntactically valid; clients that want "no cap" should special-case. */
export async function computeRateLimit(
  env: Env, projectId: string,
): Promise<RateLimitView> {
  const tier = await getProjectTier(env, projectId);
  const limits = TIER_LIMITS[tier];
  const limit = limits.callsPerDay === -1 ? Number.MAX_SAFE_INTEGER : limits.callsPerDay;

  const today = new Date().toISOString().slice(0, 10);
  const key = `usage:${projectId}:${today}`;
  const usedRaw = await env.CACHE.get(key);
  const used = usedRaw ? parseInt(usedRaw, 10) : 0;

  return {
    limit,
    remaining: Math.max(0, limit - used),
    resetSec: secondsUntilUtcMidnight(),
    windowSec: DAY_SECONDS,
  };
}

/** Apply the three RateLimit-* headers to a Headers instance. Mutates. */
export function applyRateLimitHeaders(headers: Headers, view: RateLimitView): void {
  headers.set('RateLimit-Limit', `${view.limit}, ${view.limit};w=${view.windowSec}`);
  headers.set('RateLimit-Remaining', String(view.remaining));
  headers.set('RateLimit-Reset', String(view.resetSec));
}

/** Convenience: clone a Response, attach RateLimit-* headers, return it. */
export function withRateLimitHeaders(response: Response, view: RateLimitView): Response {
  const headers = new Headers(response.headers);
  applyRateLimitHeaders(headers, view);
  return new Response(response.body, { status: response.status, headers });
}
