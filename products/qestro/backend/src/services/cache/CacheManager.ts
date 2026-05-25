/**
 * CacheManager: Multi-tier caching (L1 in-memory + L2 Redis)
 * LRU/LFU eviction, TTL expiry, invalidation patterns
 */

import { CacheEntry, CacheConfig, CacheStats, CacheEvent, EvictionPolicy } from './types.js';

export class CacheManager {
  private l1Cache: Map<string, CacheEntry<any>> = new Map();
  private config: CacheConfig;
  private stats = { hitsL1: 0, hitsL2: 0, misses: 0 };
  private events: CacheEvent[] = [];
  private l2Client?: any; // Redis client

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSizeBytes: config.maxSizeBytes ?? 100 * 1024 * 1024, // 100MB
      maxEntriesL1: config.maxEntriesL1 ?? 10000,
      evictionPolicy: config.evictionPolicy ?? 'lru',
      defaultTtlSeconds: config.defaultTtlSeconds ?? 3600,
      enableL2: config.enableL2 ?? false,
      l2Host: config.l2Host ?? 'localhost',
      l2Port: config.l2Port ?? 6379,
      l2Db: config.l2Db ?? 0,
    };

    // Initialize L2 Redis client if enabled
    if (this.config.enableL2) {
      this.initializeL2();
    }
  }

  /**
   * Get value from cache (L1 → L2)
   */
  async get<T>(key: string): Promise<T | null> {
    // Check L1
    const l1Entry = this.l1Cache.get(key);

    if (l1Entry) {
      if (this.isExpired(l1Entry)) {
        this.l1Cache.delete(key);
      } else {
        l1Entry.accessCount++;
        l1Entry.lastAccessedAt = Date.now();
        this.stats.hitsL1++;
        this.recordEvent({
          type: 'hit',
          key,
          layer: 'L1',
          timestamp: Date.now(),
        });
        return l1Entry.value;
      }
    }

    // Check L2
    if (this.config.enableL2 && this.l2Client) {
      try {
        const l2Value = await this.getFromL2<T>(key);

        if (l2Value !== null) {
          // Populate L1 from L2
          const ttl = this.config.defaultTtlSeconds * 1000;
          const size = this.estimateSize(l2Value);

          this.l1Cache.set(key, {
            key,
            value: l2Value,
            expiresAt: Date.now() + ttl,
            accessCount: 1,
            lastAccessedAt: Date.now(),
            createdAt: Date.now(),
            size,
          });

          this.ensureL1Capacity();
          this.stats.hitsL2++;
          this.recordEvent({
            type: 'hit',
            key,
            layer: 'L2',
            timestamp: Date.now(),
          });
          return l2Value;
        }
      } catch (error) {
        console.error('L2 cache error:', error);
      }
    }

    this.stats.misses++;
    this.recordEvent({
      type: 'miss',
      key,
      layer: 'L1',
      timestamp: Date.now(),
    });
    return null;
  }

  /**
   * Set value in cache (L1 + L2)
   */
  async set<T>(
    key: string,
    value: T,
    ttlSeconds?: number
  ): Promise<void> {
    const ttl = ttlSeconds ?? this.config.defaultTtlSeconds;
    const size = this.estimateSize(value);

    const entry: CacheEntry<T> = {
      key,
      value,
      expiresAt: Date.now() + ttl * 1000,
      accessCount: 0,
      lastAccessedAt: Date.now(),
      createdAt: Date.now(),
      size,
    };

    // Write to L1
    this.l1Cache.set(key, entry);
    this.ensureL1Capacity();

    // Write to L2
    if (this.config.enableL2 && this.l2Client) {
      try {
        await this.setInL2(key, value, ttl);
      } catch (error) {
        console.error('L2 cache error:', error);
      }
    }

    this.recordEvent({
      type: 'set',
      key,
      layer: 'L1',
      timestamp: Date.now(),
    });
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    this.l1Cache.delete(key);

    if (this.config.enableL2 && this.l2Client) {
      try {
        await this.deleteFromL2(key);
      } catch (error) {
        console.error('L2 cache error:', error);
      }
    }

    this.recordEvent({
      type: 'delete',
      key,
      layer: 'L1',
      timestamp: Date.now(),
    });
  }

  /**
   * Invalidate by pattern (regex)
   */
  async invalidatePattern(pattern: string): Promise<number> {
    const regex = new RegExp(pattern);
    const keys = Array.from(this.l1Cache.keys()).filter((k) =>
      regex.test(k)
    );

    for (const key of keys) {
      await this.delete(key);
    }

    return keys.length;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hitsL1 + this.stats.hitsL2 + this.stats.misses;
    const hitRate =
      totalRequests > 0
        ? (this.stats.hitsL1 + this.stats.hitsL2) / totalRequests
        : 0;

    const totalSize = Array.from(this.l1Cache.values()).reduce(
      (sum, entry) => sum + entry.size,
      0
    );

    return {
      hitsL1: this.stats.hitsL1,
      hitsL2: this.stats.hitsL2,
      misses: this.stats.misses,
      totalSize,
      entriesL1: this.l1Cache.size,
      entriesL2: this.config.enableL2 ? 0 : 0, // Would need L2 query
      hitRate,
    };
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    this.l1Cache.clear();

    if (this.config.enableL2 && this.l2Client) {
      try {
        await this.l2Client.flushdb();
      } catch (error) {
        console.error('L2 cache error:', error);
      }
    }

    this.stats = { hitsL1: 0, hitsL2: 0, misses: 0 };
  }

  /**
   * Get event history
   */
  getEventHistory(limit: number = 100): CacheEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    if (!entry.expiresAt) {
      return false;
    }

    return Date.now() > entry.expiresAt;
  }

  /**
   * Ensure L1 capacity using eviction policy
   */
  private ensureL1Capacity(): void {
    const totalSize = Array.from(this.l1Cache.values()).reduce(
      (sum, entry) => sum + entry.size,
      0
    );

    const entries = Array.from(this.l1Cache.values());

    // Evict if exceeds max size or entries
    while (
      (totalSize > this.config.maxSizeBytes ||
        entries.length > this.config.maxEntriesL1) &&
      entries.length > 0
    ) {
      const victimIndex = this.selectEvictionVictim(entries);

      if (victimIndex >= 0) {
        const victim = entries[victimIndex];
        this.l1Cache.delete(victim.key);
        entries.splice(victimIndex, 1);

        this.recordEvent({
          type: 'evict',
          key: victim.key,
          layer: 'L1',
          timestamp: Date.now(),
        });
      } else {
        break;
      }
    }
  }

  /**
   * Select entry to evict based on policy
   */
  private selectEvictionVictim(entries: CacheEntry<any>[]): number {
    switch (this.config.evictionPolicy) {
      case 'lru':
        return entries.reduce((minIdx, entry, idx) => {
          const minEntry = entries[minIdx];
          return entry.lastAccessedAt < minEntry.lastAccessedAt ? idx : minIdx;
        }, 0);

      case 'lfu':
        return entries.reduce((minIdx, entry, idx) => {
          const minEntry = entries[minIdx];
          return entry.accessCount < minEntry.accessCount ? idx : minIdx;
        }, 0);

      case 'ttl':
        return entries.reduce((minIdx, entry, idx) => {
          const minEntry = entries[minIdx];
          const minExpiry = minEntry.expiresAt ?? Infinity;
          const expiry = entry.expiresAt ?? Infinity;
          return expiry < minExpiry ? idx : minIdx;
        }, 0);

      default:
        return 0;
    }
  }

  /**
   * Estimate object size in bytes
   */
  private estimateSize(value: any): number {
    const jsonStr = JSON.stringify(value);
    return new TextEncoder().encode(jsonStr).length;
  }

  /**
   * Record cache event
   */
  private recordEvent(event: CacheEvent): void {
    event.hitRate = this.getStats().hitRate;
    this.events.push(event);

    if (this.events.length > 10000) {
      this.events.shift();
    }
  }

  /**
   * Initialize L2 Redis client
   */
  private initializeL2(): void {
    try {
      const redis = require('redis');
      this.l2Client = redis.createClient({
        host: this.config.l2Host,
        port: this.config.l2Port,
        db: this.config.l2Db,
      });
    } catch (error) {
      console.warn('Redis client not available, L2 disabled');
    }
  }

  /**
   * Get from L2 (placeholder)
   */
  private async getFromL2<T>(key: string): Promise<T | null> {
    if (!this.l2Client) return null;
    try {
      const value = await this.l2Client.get(key);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }

  /**
   * Set in L2 (placeholder)
   */
  private async setInL2<T>(
    key: string,
    value: T,
    ttl: number
  ): Promise<void> {
    if (!this.l2Client) return;
    try {
      await this.l2Client.setex(
        key,
        ttl,
        JSON.stringify(value)
      );
    } catch {
      // Silently fail
    }
  }

  /**
   * Delete from L2 (placeholder)
   */
  private async deleteFromL2(key: string): Promise<void> {
    if (!this.l2Client) return;
    try {
      await this.l2Client.del(key);
    } catch {
      // Silently fail
    }
  }
}
