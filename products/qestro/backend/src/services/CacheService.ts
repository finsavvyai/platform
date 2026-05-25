/**
 * Redis Caching Service
 * High-performance caching solution for API responses, sessions, and data
 */

import Redis from 'ioredis';
import { logger } from '../utils/logger.js';
import { config } from '../config/config.js';

export interface CacheConfig {
  key: string;
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Cache tags for invalidation
  compress?: boolean; // Enable compression for large data
  serialize?: boolean; // Enable serialization
}

export interface CacheOptions {
  prefix?: string;
  defaultTTL?: number;
  enableCompression?: boolean;
  enableMetrics?: boolean;
}

export class CacheService {
  private redis: Redis;
  private config: CacheOptions;
  private metrics: {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
    errors: number;
  };

  constructor(options: CacheOptions = {}) {
    this.config = {
      prefix: options.prefix || 'qestro:',
      defaultTTL: options.defaultTTL || 3600, // 1 hour
      enableCompression: options.enableCompression || true,
      enableMetrics: options.enableMetrics || true,
    };

    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
    };

    // Initialize Redis connection
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableReadyCheck: true,
      connectTimeout: 30000,
      commandTimeout: 5000,
      maxmemoryPolicy: 'allkeys-lru', // LRU eviction policy
    } as any);

    // Redis event listeners
    this.redis.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    this.redis.on('error', (error) => {
      logger.error('Redis connection error:', error);
      this.metrics.errors++;
    });

    this.redis.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });

    this.redis.on('close', () => {
      logger.warn('Redis connection closed');
    });
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    try {
      await this.redis.connect();
      logger.info('Cache service connected to Redis');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      await this.redis.disconnect();
      logger.info('Cache service disconnected from Redis');
    } catch (error) {
      logger.error('Error disconnecting from Redis:', error);
    }
  }

  /**
   * Generate cache key with prefix
   */
  private generateKey(key: string): string {
    return `${this.config.prefix}${key}`;
  }

  /**
   * Prepare data for caching
   */
  private async prepareData(data: any, compress: boolean): Promise<string> {
    const serialized = JSON.stringify(data);

    if (compress && serialized.length > 1024) { // Compress only if > 1KB
      try {
        const zlib = await import('zlib');
        const compressed = zlib.deflateSync(Buffer.from(serialized));
        return 'compressed:' + compressed.toString('base64');
      } catch (error) {
        logger.warn('Failed to compress cache data:', error);
        return serialized;
      }
    }

    return serialized;
  }

  /**
   * Decompress cache data if needed
   */
  private async decompressData(data: string): Promise<any> {
    try {
      if (data.startsWith('compressed:')) {
        const zlib = await import('zlib');
        const compressed = Buffer.from(data.substring(11), 'base64');
        const decompressed = zlib.inflateSync(compressed);
        return JSON.parse(decompressed.toString());
      }
      return JSON.parse(data);
    } catch (error) {
      logger.error('Failed to decompress cache data:', error);
      throw error;
    }
  }

  /**
   * Set cache data
   */
  async set<T>(config: CacheConfig, data: T): Promise<boolean> {
    try {
      const key = this.generateKey(config.key);
      const ttl = config.ttl || this.config.defaultTTL;
      const compress = config.compress !== false && this.config.enableCompression;

      const preparedData = await this.prepareData(data, compress);

      if (config.tags && config.tags.length > 0) {
        // Store tags for this key
        const tagKey = `${key}:tags`;
        await this.redis.sadd(tagKey, ...config.tags);
        await this.redis.expire(tagKey, ttl);

        // Add key to tag sets
        for (const tag of config.tags) {
          const tagSetKey = `${this.config.prefix}tags:${tag}`;
          await this.redis.sadd(tagSetKey, key);
          await this.redis.expire(tagSetKey, ttl);
        }
      }

      const result = await this.redis.setex(key, ttl, preparedData);

      if (this.config.enableMetrics) {
        this.metrics.sets++;
      }

      logger.debug(`Cache set: ${config.key} (TTL: ${ttl}s)`);
      return result === 'OK';

    } catch (error) {
      logger.error(`Failed to set cache for key ${config.key}:`, error);
      if (this.config.enableMetrics) {
        this.metrics.errors++;
      }
      return false;
    }
  }

  /**
   * Get cache data
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cacheKey = this.generateKey(key);
      const data = await this.redis.get(cacheKey);

      if (data === null) {
        if (this.config.enableMetrics) {
          this.metrics.misses++;
        }
        logger.debug(`Cache miss: ${key}`);
        return null;
      }

      const result = await this.decompressData(data);

      if (this.config.enableMetrics) {
        this.metrics.hits++;
      }

      logger.debug(`Cache hit: ${key}`);
      return result;

    } catch (error) {
      logger.error(`Failed to get cache for key ${key}:`, error);
      if (this.config.enableMetrics) {
        this.metrics.errors++;
      }
      return null;
    }
  }

  /**
   * Delete cache data
   */
  async delete(key: string): Promise<boolean> {
    try {
      const cacheKey = this.generateKey(key);

      // Get tags for this key before deletion
      const tagKey = `${cacheKey}:tags`;
      const tags = await this.redis.smembers(tagKey);

      // Remove key from tag sets
      for (const tag of tags) {
        const tagSetKey = `${this.config.prefix}tags:${tag}`;
        await this.redis.srem(tagSetKey, cacheKey);
      }

      // Delete tags key and main key
      await this.redis.del(tagKey);
      const result = await this.redis.del(cacheKey);

      if (this.config.enableMetrics) {
        this.metrics.deletes++;
      }

      logger.debug(`Cache delete: ${key}`);
      return result > 0;

    } catch (error) {
      logger.error(`Failed to delete cache for key ${key}:`, error);
      if (this.config.enableMetrics) {
        this.metrics.errors++;
      }
      return false;
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTag(tag: string): Promise<number> {
    try {
      const tagSetKey = `${this.config.prefix}tags:${tag}`;
      const keys = await this.redis.smembers(tagSetKey);

      if (keys.length === 0) {
        logger.debug(`No keys found for tag: ${tag}`);
        return 0;
      }

      // Delete all keys and their tag sets
      const pipeline = this.redis.pipeline();
      for (const key of keys) {
        pipeline.del(key);
        pipeline.del(`${key}:tags`);
      }
      pipeline.del(tagSetKey);

      const results = await pipeline.exec();
      const deletedCount = results?.filter(([err, result]) => (result as number) > 0).length || 0;

      if (this.config.enableMetrics) {
        this.metrics.deletes += deletedCount;
      }

      logger.info(`Invalidated ${deletedCount} cache entries for tag: ${tag}`);
      return deletedCount;

    } catch (error) {
      logger.error(`Failed to invalidate cache by tag ${tag}:`, error);
      if (this.config.enableMetrics) {
        this.metrics.errors++;
      }
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const cacheKey = this.generateKey(key);
      const result = await this.redis.exists(cacheKey);
      return result === 1;
    } catch (error) {
      logger.error(`Failed to check cache existence for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get TTL for key
   */
  async ttl(key: string): Promise<number> {
    try {
      const cacheKey = this.generateKey(key);
      return await this.redis.ttl(cacheKey);
    } catch (error) {
      logger.error(`Failed to get TTL for key ${key}:`, error);
      return -1;
    }
  }

  /**
   * Extend TTL for key
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const cacheKey = this.generateKey(key);
      const result = await this.redis.expire(cacheKey, ttl);
      return result === 1;
    } catch (error) {
      logger.error(`Failed to set expiration for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get multiple keys
   */
  async mget<T>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();

    if (keys.length === 0) {
      return results;
    }

    try {
      const cacheKeys = keys.map(key => this.generateKey(key));
      const values = await this.redis.mget(...cacheKeys);

      for (let i = 0; i < keys.length; i++) {
        const value = values[i];
        if (value === null) {
          results.set(keys[i], null);
          if (this.config.enableMetrics) {
            this.metrics.misses++;
          }
        } else {
          try {
            const decompressed = await this.decompressData(value);
            results.set(keys[i], decompressed);
            if (this.config.enableMetrics) {
              this.metrics.hits++;
            }
          } catch (error) {
            logger.error(`Failed to decompress cache data for key ${keys[i]}:`, error);
            results.set(keys[i], null);
            if (this.config.enableMetrics) {
              this.metrics.errors++;
            }
          }
        }
      }

      return results;

    } catch (error) {
      logger.error('Failed to get multiple cache keys:', error);
      if (this.config.enableMetrics) {
        this.metrics.errors++;
      }

      // Return empty results on error
      for (const key of keys) {
        results.set(key, null);
      }

      return results;
    }
  }

  /**
   * Set multiple keys
   */
  async mset<T>(items: Array<{ config: CacheConfig; data: T }>): Promise<boolean[]> {
    const results: boolean[] = [];

    if (items.length === 0) {
      return results;
    }

    try {
      const pipeline = this.redis.pipeline();

      for (const item of items) {
        const key = this.generateKey(item.config.key);
        const ttl = item.config.ttl || this.config.defaultTTL;
        const compress = item.config.compress !== false && this.config.enableCompression;

        pipeline.setex(key, ttl, await this.prepareData(item.data, compress));

        // Handle tags if provided
        if (item.config.tags && item.config.tags.length > 0) {
          const tagKey = `${key}:tags`;
          pipeline.sadd(tagKey, ...item.config.tags);
          pipeline.expire(tagKey, ttl);

          for (const tag of item.config.tags) {
            const tagSetKey = `${this.config.prefix}tags:${tag}`;
            pipeline.sadd(tagSetKey, key);
            pipeline.expire(tagSetKey, ttl);
          }
        }
      }

      const execResults = await pipeline.exec();

      for (const result of execResults || []) {
        const [err, response] = result;
        const success = !err && response === 'OK';
        results.push(success);

        if (this.config.enableMetrics) {
          if (success) {
            this.metrics.sets++;
          } else {
            this.metrics.errors++;
          }
        }
      }

      logger.debug(`Cache mset: ${items.length} items`);
      return results;

    } catch (error) {
      logger.error('Failed to set multiple cache keys:', error);
      if (this.config.enableMetrics) {
        this.metrics.errors += items.length;
      }

      // Return false results on error
      return items.map(() => false);
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<boolean> {
    try {
      const pattern = `${this.config.prefix}*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length === 0) {
        return true;
      }

      const result = await this.redis.del(...keys);

      if (this.config.enableMetrics) {
        this.metrics.deletes += result;
      }

      logger.info(`Cache cleared: ${result} keys deleted`);
      return result > 0;

    } catch (error) {
      logger.error('Failed to clear cache:', error);
      if (this.config.enableMetrics) {
        this.metrics.errors++;
      }
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getMetrics(): {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
    errors: number;
    hitRate: number;
  } {
    const total = this.metrics.hits + this.metrics.misses;
    const hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0;

    return {
      ...this.metrics,
      hitRate: Math.round(hitRate * 100) / 100, // Round to 2 decimal places
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
    };
  }

  /**
   * Get Redis info
   */
  async getRedisInfo(): Promise<any> {
    try {
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');
      const stats = await this.redis.info('stats');

      return {
        memory: this.parseRedisInfo(info),
        keyspace: this.parseRedisInfo(keyspace),
        stats: this.parseRedisInfo(stats),
      };
    } catch (error) {
      logger.error('Failed to get Redis info:', error);
      return null;
    }
  }

  /**
   * Parse Redis info response
   */
  private parseRedisInfo(info: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = info.split('\r\n');

    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          result[key] = value;
        }
      }
    }

    return result;
  }

  /**
   * Health check for Redis
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    latency: number;
    error?: string;
  }> {
    try {
      const startTime = Date.now();
      await this.redis.ping();
      const latency = Date.now() - startTime;

      // Check if Redis is responsive and not under high memory pressure
      const info = await this.redis.info('memory');
      const memoryInfo = this.parseRedisInfo(info);
      const maxMemory = parseInt(memoryInfo.maxmemory || '0');
      const usedMemory = parseInt(memoryInfo.used_memory || '0');

      const memoryUsagePercent = maxMemory > 0 ? (usedMemory / maxMemory) * 100 : 0;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      if (latency > 1000 || memoryUsagePercent > 90) {
        status = 'degraded';
      }

      if (latency > 5000 || memoryUsagePercent > 95) {
        status = 'unhealthy';
      }

      return { status, latency };

    } catch (error) {
      logger.error('Redis health check failed:', error);
      return {
        status: 'unhealthy',
        latency: -1,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService({
  prefix: process.env.CACHE_PREFIX || 'qestro:',
  defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '3600'),
  enableCompression: process.env.CACHE_ENABLE_COMPRESSION !== 'false',
  enableMetrics: process.env.CACHE_ENABLE_METRICS !== 'false',
});

export default cacheService;