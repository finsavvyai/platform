/**
 * Query Cache - Intelligent Caching Layer for Database Queries
 *
 * Provides query-level caching with automatic invalidation on writes
 * to related tables. Supports TTL-based expiration and pattern-based invalidation.
 */

import { createHash } from 'crypto';
import { logger } from '../../utils/logger.js';
import type { CacheInvalidationRule } from './types.js';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
  hits: number;
  key: string;
  dependencies: string[]; // tables this query depends on
}

export class QueryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private tableQueryMap: Map<string, Set<string>> = new Map(); // table -> query keys
  private invalidationRules: CacheInvalidationRule[] = [];
  private maxCacheSize: number;
  private defaultTTL: number;
  private stats = { hits: 0, misses: 0, evictions: 0 };

  constructor(maxCacheSize: number = 10000, defaultTTLSeconds: number = 300) {
    this.maxCacheSize = maxCacheSize;
    this.defaultTTL = defaultTTLSeconds * 1000;

    // Start cleanup timer
    this.startCleanupTimer();
  }

  /**
   * Execute a cached query
   * Returns cached result if available, otherwise executes queryFn and caches result
   */
  async cachedQuery<T>(
    key: string,
    queryFn: () => Promise<T>,
    ttlSeconds: number = this.defaultTTL / 1000
  ): Promise<T> {
    const cacheKey = this.normalizeKey(key);
    const now = Date.now();

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      cached.hits++;
      this.stats.hits++;
      logger.debug(`Cache hit: ${cacheKey} (${cached.hits} hits)`);
      return cached.data as T;
    }

    // Cache miss or expired
    this.stats.misses++;

    // Execute query
    const data = await queryFn();

    // Store in cache
    const entry: CacheEntry<T> = {
      data,
      expiresAt: now + ttlSeconds * 1000,
      createdAt: now,
      hits: 0,
      key: cacheKey,
      dependencies: [],
    };

    this.cache.set(cacheKey, entry);

    // Evict oldest if cache too large
    if (this.cache.size > this.maxCacheSize) {
      this.evictOldest();
    }

    return data;
  }

  /**
   * Invalidate a specific cache key
   */
  invalidateQuery(key: string): void {
    const cacheKey = this.normalizeKey(key);
    if (this.cache.has(cacheKey)) {
      this.cache.delete(cacheKey);
      logger.debug(`Cache invalidated: ${cacheKey}`);
    }
  }

  /**
   * Invalidate all queries depending on a table
   */
  invalidateByTable(tableName: string): void {
    const queryKeys = this.tableQueryMap.get(tableName) || new Set();

    let count = 0;
    const keysArray = Array.from(queryKeys);
    for (const key of keysArray) {
      if (this.cache.has(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    // Clear the mapping
    this.tableQueryMap.delete(tableName);

    if (count > 0) {
      logger.debug(`Table invalidation: ${count} cache entries for table "${tableName}" removed`);
    }
  }

  /**
   * Invalidate queries matching a pattern
   */
  invalidateByPattern(pattern: RegExp | string): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    let count = 0;

    const keysToDelete: string[] = [];
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.cache.delete(key);
      count++;
    }

    if (count > 0) {
      logger.debug(`Pattern invalidation: ${count} cache entries matching "${pattern}" removed`);
    }
  }

  /**
   * Register a cache invalidation rule for automatic invalidation on writes
   */
  registerInvalidationRule(rule: CacheInvalidationRule): void {
    this.invalidationRules.push(rule);
  }

  /**
   * Notify cache of a table write operation
   * Automatically invalidates dependent queries
   */
  recordTableWrite(tableName: string): void {
    // Invalidate exact match
    this.invalidateByTable(tableName);

    // Check invalidation rules
    for (const rule of this.invalidationRules) {
      if (rule.table === tableName || (rule.relatedTables && rule.relatedTables.includes(tableName))) {
        this.invalidateByPattern(rule.invalidatePattern === 'regex' ? rule.table : new RegExp(rule.table));
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
    hitRate: number;
    evictions: number;
    topKeys: Array<{ key: string; hits: number; expiresIn: number }>;
  } {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    // Get top cache entries by hits
    const topKeys: Array<{ key: string; hits: number; expiresIn: number }> = [];
    const entries = Array.from(this.cache.entries());
    for (const entry of entries) {
      const [key, cacheEntry] = entry;
      topKeys.push({
        key,
        hits: cacheEntry.hits,
        expiresIn: Math.max(0, cacheEntry.expiresAt - Date.now()),
      });
    }
    topKeys.sort((a, b) => b.hits - a.hits);
    const top10 = topKeys.slice(0, 10);

    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 10000) / 10000,
      evictions: this.stats.evictions,
      topKeys: top10,
    };
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.tableQueryMap.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
    logger.info(`Cache cleared: ${size} entries removed`);
  }

  /**
   * Cleanup and shutdown
   */
  destroy(): void {
    this.clear();
  }

  // Private helpers

  private normalizeKey(key: string): string {
    // Hash long keys to keep map keys manageable
    if (key.length > 200) {
      return createHash('sha256').update(key).digest('hex');
    }
    return key;
  }

  private evictOldest(): void {
    let oldest: [string, CacheEntry<any>] | null = null;

    const entries = Array.from(this.cache.entries());
    for (const entry of entries) {
      const [key, cacheEntry] = entry;
      if (!oldest || cacheEntry.createdAt < oldest[1].createdAt) {
        oldest = [key, cacheEntry];
      }
    }

    if (oldest) {
      this.cache.delete(oldest[0]);
      this.stats.evictions++;
      logger.debug(`Cache eviction: removed oldest entry "${oldest[0]}"`);
    }
  }

  private startCleanupTimer(): void {
    const cleanupInterval = 60 * 1000; // 1 minute

    setInterval(() => {
      const now = Date.now();
      let expired = 0;

      const keysToDelete: string[] = [];
      const entries = Array.from(this.cache.entries());
      for (const entry of entries) {
        const [key, cacheEntry] = entry;
        if (cacheEntry.expiresAt <= now) {
          keysToDelete.push(key);
        }
      }
      for (const key of keysToDelete) {
        this.cache.delete(key);
        expired++;
      }

      if (expired > 0) {
        logger.debug(`Cache cleanup: ${expired} expired entries removed`);
      }
    }, cleanupInterval);
  }
}

export default QueryCache;
