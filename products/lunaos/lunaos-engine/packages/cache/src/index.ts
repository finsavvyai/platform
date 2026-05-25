/**
 * Cache Service Module for Claude Agent Platform
 *
 * Provides unified caching interface with multiple backends:
 * - Redis for distributed caching
 * - Memory for local caching
 * - Multi-tier caching strategies
 */

export { CacheService } from './cache-service';
export { RedisCache } from './redis';
export { MemoryCache } from './memory';
export {
  CacheOptions,
  CacheResult,
  CacheConfig,
  CacheBackend,
  CacheTier
} from './interfaces';

// Re-export commonly used types and utilities
export type {
  CacheStats,
  CacheMetrics,
  HealthCheckResult
} from './interfaces';

/**
 * Default cache configuration
 */
export const DEFAULT_CACHE_CONFIG = {
  // Redis configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: 'claude-agent:',
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  },

  // Memory cache configuration
  memory: {
    maxEntries: 1000,
    maxAge: 5 * 60 * 1000, // 5 minutes
    updateAgeOnGet: true,
    checkPeriod: 10 * 60 * 1000, // 10 minutes
  },

  // Cache tiers configuration
  tiers: {
    l1: { backend: 'memory', ttl: 10000 },      // 10 seconds
    l2: { backend: 'redis', ttl: 300000 },      // 5 minutes
    l3: { backend: 'redis', ttl: 3600000 },     // 1 hour
  },

  // Default TTL settings
  defaultTTL: {
    userSessions: 24 * 60 * 60 * 1000,      // 24 hours
    apiResults: 5 * 60 * 1000,              // 5 minutes
    agentConfigs: 60 * 60 * 1000,           // 1 hour
    taskResults: 24 * 60 * 60 * 1000,       // 24 hours
    ragContexts: 60 * 60 * 1000,            // 1 hour
    tokenOptimizations: 30 * 60 * 1000,     // 30 minutes
  },
} as const;
