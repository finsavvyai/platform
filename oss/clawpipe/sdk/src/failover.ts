/**
 * Provider failover — health tracker + retry/fallback orchestration.
 *
 * In-memory health map per provider; on a retryable failure (HTTP 5xx, 429,
 * timeout, or generic network error) the next-best fallback model is tried.
 * Failures decay after `HEALTH_DECAY_MS` so a transient blip doesn't ban the
 * provider permanently.
 */

import type { RouteDecision } from './router';
import { GatewayError } from './gateway';

export const HEALTH_DECAY_MS = 60_000;
export const FAILURE_PENALTY = 0.15;
export const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
export const DEFAULT_FALLBACK_COUNT = 3;

export interface ProviderHealth { failures: number; lastFailure: number }
export type HealthMap = Map<string, ProviderHealth>;

/** Mark a provider failure. Decays older failures before incrementing. */
export function recordFailure(map: HealthMap, provider: string, now: number = Date.now()): void {
  const cur = map.get(provider);
  const decayed = cur && now - cur.lastFailure > HEALTH_DECAY_MS ? 0 : (cur?.failures ?? 0);
  map.set(provider, { failures: decayed + 1, lastFailure: now });
}

/** Mark a provider success — clears the entry. */
export function recordSuccess(map: HealthMap, provider: string): void {
  map.delete(provider);
}

/** Score penalty in [0, 1] from the health map. Decays linearly with age. */
export function healthPenalty(
  map: HealthMap, provider: string, now: number = Date.now(),
): number {
  const h = map.get(provider);
  if (!h) return 0;
  const age = now - h.lastFailure;
  if (age >= HEALTH_DECAY_MS) return 0;
  const ageFactor = 1 - age / HEALTH_DECAY_MS;
  return Math.min(1, h.failures * FAILURE_PENALTY * ageFactor);
}

/** Decide whether the given error/status warrants a failover retry. */
export function isRetryable(err: unknown): boolean {
  if (err instanceof GatewayError) return RETRYABLE_STATUSES.has(err.statusCode);
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes('timeout') || msg.includes('timed out')
      || msg.includes('network') || msg.includes('fetch failed')
      || msg.includes('econnreset') || msg.includes('econnrefused');
  }
  return false;
}

/** Run a call with failover. Tries primary, then each fallback in order. The
 *  callFn runs with the chosen RouteDecision and is expected to throw on
 *  non-2xx. Returns the first successful result; throws the last error if all
 *  candidates fail. The health map is mutated for each attempt. */
export async function runWithFailover<T>(
  primary: RouteDecision,
  fallbacks: RouteDecision[],
  callFn: (route: RouteDecision) => Promise<T>,
  health: HealthMap = new Map(),
): Promise<{ result: T; usedRoute: RouteDecision; attempts: number }> {
  const candidates = [primary, ...fallbacks];
  let lastErr: unknown;
  let attempts = 0;
  for (const route of candidates) {
    attempts++;
    try {
      const result = await callFn(route);
      recordSuccess(health, route.provider);
      return { result, usedRoute: route, attempts };
    } catch (err) {
      lastErr = err;
      recordFailure(health, route.provider);
      if (!isRetryable(err)) break;
    }
  }
  throw lastErr ?? new Error('failover exhausted with no error captured');
}
