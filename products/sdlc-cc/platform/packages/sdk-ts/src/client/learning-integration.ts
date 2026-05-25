// Learning layer integration helpers for BaseClient

import type { EventEmitter } from "eventemitter3";
import type { RequestConfig, ApiResponse, SDLCConfig } from "../types";
import {
  createLearningLayer,
  type LearningLayer,
} from "../learning";

/**
 * Initialize the learning layer from SDK config.
 */
export function initLearningLayer(
  opt?: SDLCConfig["learning"],
): LearningLayer | null {
  if (!opt) return null;
  const opts = typeof opt === "boolean" ? {} : opt;
  if (typeof opt === "object" && opt.enabled === false) return null;
  return createLearningLayer(opts);
}

/**
 * Build a cache key for a request (GET only).
 */
export function buildLearningCacheKey(
  learning: LearningLayer | null,
  config: RequestConfig,
  isRead: boolean,
): string | null {
  if (!learning?.enabled || !isRead) return null;
  return learning.cache.buildKey(
    config.url,
    (config.params ?? {}) as Record<string, unknown>,
  );
}

/**
 * Try to retrieve a cached response.
 */
export function getCachedResponse<T>(
  learning: LearningLayer | null,
  cacheKey: string | null,
  endpoint: string,
  emitter: EventEmitter,
): ApiResponse<T> | null {
  if (!cacheKey || !learning?.enabled) return null;
  const cached = learning.cache.get<ApiResponse<T>>(cacheKey);
  if (cached) {
    emitter.emit("cache:hit", { endpoint, key: cacheKey });
    return cached.data;
  }
  return null;
}

/**
 * Record an outcome in the tracker.
 */
export function recordOutcome(
  learning: LearningLayer | null,
  endpoint: string,
  success: boolean,
  latencyMs: number,
): void {
  if (!learning?.enabled) return;
  learning.tracker.record(endpoint, success, latencyMs);
}

/**
 * Conditionally cache a successful result based on tracker analysis.
 */
export function maybeCacheResult<T>(
  learning: LearningLayer | null,
  cacheKey: string | null,
  endpoint: string,
  result: ApiResponse<T>,
  emitter: EventEmitter,
): void {
  if (!cacheKey || !learning?.enabled) return;
  if (!learning.tracker.shouldCache(endpoint)) return;

  const ttl = learning.tracker.getAdaptiveTTL(endpoint);
  learning.cache.set(cacheKey, result, result.status, ttl);
  emitter.emit("cache:set", { endpoint, key: cacheKey, ttl });
}
