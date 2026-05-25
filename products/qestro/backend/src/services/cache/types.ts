/**
 * Cache Layer Types
 * Defines structures for multi-tier caching
 */

export type EvictionPolicy = 'lru' | 'lfu' | 'ttl';

export interface CacheEntry<T> {
  key: string;
  value: T;
  expiresAt?: number; // Timestamp for TTL
  accessCount: number; // For LFU
  lastAccessedAt: number; // For LRU
  createdAt: number;
  size: number; // Bytes
}

export interface CacheConfig {
  maxSizeBytes: number;
  maxEntriesL1: number;
  evictionPolicy: EvictionPolicy;
  defaultTtlSeconds: number;
  enableL2: boolean;
  l2Host?: string;
  l2Port?: number;
  l2Db?: number;
}

export interface CacheStats {
  hitsL1: number;
  hitsL2: number;
  misses: number;
  totalSize: number;
  entriesL1: number;
  entriesL2: number;
  hitRate: number;
}

export interface CacheEvent {
  type: 'hit' | 'miss' | 'set' | 'delete' | 'evict';
  key: string;
  layer: 'L1' | 'L2';
  timestamp: number;
  hitRate?: number;
}

export type KeyGenerator = (req: any) => string;

export interface ConditionalRequest {
  etag?: string;
  lastModified?: number;
}
