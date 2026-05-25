/**
 * Cache interfaces and types for Claude Agent Platform
 */

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  tags?: string[]; // Cache tags for invalidation
  priority?: 'low' | 'normal' | 'high'; // Cache priority
  compress?: boolean; // Compress large values
  serialize?: boolean; // Serialize complex objects
}

export interface CacheResult<T = any> {
  value: T;
  hit: boolean; // Whether cache hit or miss
  source?: 'memory' | 'redis' | 'database'; // Where value came from
  ttl?: number; // Remaining TTL
  metadata?: CacheMetadata;
}

export interface CacheMetadata {
  createdAt: number;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
  tags?: string[];
  size: number; // Size in bytes
  version: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  hitRate: number;
  memoryUsage: number;
  keyCount: number;
}

export interface CacheMetrics {
  operations: {
    get: number;
    set: number;
    delete: number;
    clear: number;
  };
  performance: {
    avgGetTime: number; // milliseconds
    avgSetTime: number; // milliseconds
    totalOperations: number;
  };
  memory: {
    used: number; // bytes
    available: number; // bytes
    percentage: number;
  };
  redis?: {
    connected: boolean;
    memory: number;
    keys: number;
    operations: number;
  };
}

export interface CacheConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
    keyPrefix: string;
    retryDelayOnFailover: number;
    maxRetriesPerRequest: number;
    lazyConnect: boolean;
    connectTimeout?: number;
    commandTimeout?: number;
    maxmemoryPolicy?: string;
  };
  memory: {
    maxEntries: number;
    maxAge: number;
    updateAgeOnGet: boolean;
    checkPeriod: number;
  };
  tiers: {
    l1: { backend: CacheBackend; ttl: number };
    l2: { backend: CacheBackend; ttl: number };
    l3: { backend: CacheBackend; ttl: number };
  };
  defaultTTL: {
    [key: string]: number;
  };
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  backends: {
    redis?: BackendHealth;
    memory: BackendHealth;
  };
  metrics: CacheMetrics;
  lastCheck: Date;
  issues: string[];
}

export interface BackendHealth {
  connected: boolean;
  responseTime: number;
  error?: string;
  lastCheck: Date;
}

export type CacheBackend = 'memory' | 'redis';

export type CacheTier = 'l1' | 'l2' | 'l3';

export interface CacheEvent {
  type: 'set' | 'get' | 'delete' | 'clear' | 'evict';
  key: string;
  tier?: CacheTier;
  backend?: CacheBackend;
  timestamp: Date;
  metadata?: any;
}

export interface CacheInvalidationRule {
  pattern: string | RegExp;
  tags?: string[];
  ttl?: number;
  maxAge?: number;
  priority: number;
}

export interface CacheWarmerConfig {
  enabled: boolean;
  keys: string[];
  interval: number; // milliseconds
  priority: 'low' | 'normal' | 'high';
  batchSize: number;
  concurrency: number;
}
