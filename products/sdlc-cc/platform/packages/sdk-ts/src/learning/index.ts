// Self-learning SDK layer — adaptive caching + outcome tracking

export { SDKCache, type CachedResponse, type CacheOptions } from "./cache";
export {
  OutcomeTracker,
  type EndpointStats,
  type TrackerOptions,
} from "./tracker";

export interface LearningLayerOptions {
  /** Enable or disable the learning layer (default: true when created) */
  enabled?: boolean;
  /** Max cache entries (default: 1000) */
  maxCacheEntries?: number;
  /** Default cache TTL in ms (default: 60000) */
  defaultTTL?: number;
  /** Min calls before caching kicks in (default: 5) */
  minCallsForCache?: number;
  /** Min success rate to cache (default: 0.9) */
  minSuccessRate?: number;
}

import { SDKCache } from "./cache";
import { OutcomeTracker } from "./tracker";

export interface LearningLayer {
  cache: SDKCache;
  tracker: OutcomeTracker;
  enabled: boolean;
}

/**
 * Factory to create a self-learning layer for the SDK.
 * Pairs an LRU cache with an outcome tracker that adapts TTLs
 * based on observed endpoint reliability.
 */
export function createLearningLayer(
  options: LearningLayerOptions = {},
): LearningLayer {
  const cache = new SDKCache({
    maxEntries: options.maxCacheEntries ?? 1000,
    defaultTTL: options.defaultTTL ?? 60_000,
  });

  const tracker = new OutcomeTracker({
    minCallsForCache: options.minCallsForCache ?? 5,
    minSuccessRate: options.minSuccessRate ?? 0.9,
  });

  return {
    cache,
    tracker,
    enabled: options.enabled ?? true,
  };
}
