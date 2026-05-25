import { NoRouteError } from "./errors.js";
import type {
  GatewayRequest,
  ProviderAdapter,
  RoutePolicy,
} from "./types.js";

/**
 * Selects a provider adapter for a request.
 *
 * Algorithm (deterministic, no silent fallback):
 *   1. If `req.model` set, narrow to adapters whose `ref.model` matches.
 *   2. Narrow to adapters whose `ref.tier` matches `req.tier`.
 *   3. Apply RoutePolicy filters (cost cap, latency cap, preferProvider).
 *   4. If the candidate set is empty -> NoRouteError.
 *   5. Return the first surviving adapter (stable order from caller).
 */
export function selectAdapter(
  adapters: readonly ProviderAdapter[],
  req: GatewayRequest,
  policy: RoutePolicy = {},
): ProviderAdapter {
  if (adapters.length === 0) {
    throw new NoRouteError("no adapters registered");
  }

  let pool = adapters.slice();

  if (req.model !== undefined) {
    pool = pool.filter((a) => a.ref.model === req.model);
    if (pool.length === 0) {
      throw new NoRouteError(`no adapter for model "${req.model}"`);
    }
  }

  pool = pool.filter((a) => a.ref.tier === req.tier);
  if (pool.length === 0) {
    throw new NoRouteError(`no adapter for tier "${req.tier}"`);
  }

  if (policy.preferProvider !== undefined) {
    const filtered = pool.filter((a) => a.ref.provider === policy.preferProvider);
    if (filtered.length === 0) {
      throw new NoRouteError(
        `policy preferProvider="${policy.preferProvider}" not satisfied`,
      );
    }
    pool = filtered;
  }

  if (policy.maxCostPer1kInput !== undefined) {
    const cap = policy.maxCostPer1kInput;
    pool = pool.filter((a) => {
      const c = a.ref.costPer1kInput;
      return c === undefined ? false : c <= cap;
    });
    if (pool.length === 0) {
      throw new NoRouteError(`policy maxCostPer1kInput=${cap} not satisfied`);
    }
  }

  if (policy.maxLatencyMs !== undefined) {
    const cap = policy.maxLatencyMs;
    pool = pool.filter((a) => {
      const l = a.ref.latencyMsP50;
      return l === undefined ? false : l <= cap;
    });
    if (pool.length === 0) {
      throw new NoRouteError(`policy maxLatencyMs=${cap} not satisfied`);
    }
  }

  return pool[0]!;
}
