// Cache management for the Browser SDLC Client

import type { RequestConfig } from '../types';

interface CacheEntry {
  data: unknown;
  timestamp: number;
  ttl: number;
}

/**
 * In-memory cache with TTL support for browser HTTP responses.
 */
export class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();

  /**
   * Generate a cache key from request config.
   */
  getCacheKey(config: RequestConfig): string {
    return `${config.method}:${config.url}:${JSON.stringify(config.params)}`;
  }

  /**
   * Retrieve a cached value if it exists and has not expired.
   */
  getFromCache(key: string): unknown {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  /**
   * Store a value in the cache with a TTL.
   */
  setCache(key: string, data: unknown, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Clear all cached entries.
   */
  clear(): void {
    this.cache.clear();
  }
}
