/**
 * Cache management system for LunaForge
 * Provides multi-level caching with memory, file, and optional remote storage
 */

import { ProjectGraph } from "../types";

export interface CacheEntry<T = any> {
  value: T;
  timestamp: number;
  expiresAt: number;
  size: number;
}

export interface CacheConfig {
  memoryMaxSize: number;
  memoryMaxEntries: number;
  defaultTTL: number; // Time to live in milliseconds
  enableFileCache: boolean;
  cacheDirectory: string;
}

/**
 * Enhanced cache manager with LRU eviction and TTL support
 */
export class CacheManager {
  private memoryCache = new Map<string, CacheEntry>();
  private memoryUsage = 0;
  private cacheConfig: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.cacheConfig = {
      memoryMaxSize: 50 * 1024 * 1024, // 50MB
      memoryMaxEntries: 1000,
      defaultTTL: 30 * 60 * 1000, // 30 minutes
      enableFileCache: true,
      cacheDirectory: ".lunaforge-cache",
      ...config
    };
  }

  /**
   * Get value from cache (memory only for now, file cache can be added later)
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key);
      this.memoryUsage -= entry.size;
      return null;
    }

    return entry.value;
  }

  /**
   * Set value in cache with optional TTL
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const serializedSize = this.calculateSize(value);
    const now = Date.now();
    const expiresAt = now + (ttl || this.cacheConfig.defaultTTL);

    const entry: CacheEntry<T> = {
      value,
      timestamp: now,
      expiresAt,
      size: serializedSize
    };

    // Evict if necessary
    await this.ensureCapacity(serializedSize);

    // Remove old entry if exists
    const oldEntry = this.memoryCache.get(key);
    if (oldEntry) {
      this.memoryUsage -= oldEntry.size;
    }

    this.memoryCache.set(key, entry);
    this.memoryUsage += serializedSize;
  }

  /**
   * Delete entry from cache
   */
  async delete(key: string): Promise<void> {
    const entry = this.memoryCache.get(key);
    if (entry) {
      this.memoryUsage -= entry.size;
      this.memoryCache.delete(key);
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    this.memoryUsage = 0;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      entries: this.memoryCache.size,
      memoryUsage: this.memoryUsage,
      memoryUsagePercent: (this.memoryUsage / this.cacheConfig.memoryMaxSize) * 100,
      maxEntries: this.cacheConfig.memoryMaxEntries,
      maxSize: this.cacheConfig.memoryMaxSize
    };
  }

  /**
   * Ensure capacity for new entry using LRU eviction
   */
  private async ensureCapacity(requiredSize: number): Promise<void> {
    // Check if we need to evict entries
    while (this.shouldEvict(requiredSize)) {
      const lruKey = this.findLRUKey();
      if (lruKey) {
        await this.delete(lruKey);
      } else {
        break;
      }
    }
  }

  /**
   * Determine if eviction is needed
   */
  private shouldEvict(requiredSize: number): boolean {
    const wouldExceedMemory = this.memoryUsage + requiredSize > this.cacheConfig.memoryMaxSize;
    const wouldExceedEntries = this.memoryCache.size >= this.cacheConfig.memoryMaxEntries;
    return wouldExceedMemory || wouldExceedEntries;
  }

  /**
   * Find least recently used key
   */
  private findLRUKey(): string | null {
    let lruKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        lruKey = key;
      }
    }

    return lruKey;
  }

  /**
   * Calculate approximate size of cached value
   */
  private calculateSize(value: any): number {
    if (value === null || value === undefined) return 0;
    try {
      return JSON.stringify(value).length * 2; // Approximate byte size
    } catch {
      return 1024; // Default size for non-serializable objects
    }
  }

  /**
   * Cleanup expired entries
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.memoryCache.entries()) {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      await this.delete(key);
    }
  }
}