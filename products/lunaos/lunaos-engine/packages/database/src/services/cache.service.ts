import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import { PromiseLike } from 'promises';

export interface CacheOptions {
  /**
   * Time to live in seconds
   */
  ttl?: number;

  /**
   * Whether to use a specific key prefix
   */
  prefix?: string;

  /**
   * Whether to compress the value
   */
  compress?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  operations: number;
  hitRate: number;
  memoryUsage: {
    used: string;
    peak: string;
    free: string;
  };
  keyCount: number;
}

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client: RedisClientType;
  private isConnected = false;
  private retryCount = 0;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second

  // Statistics
  private stats = {
    hits: 0,
    misses: 0,
    operations: 0,
  };

  constructor(private readonly configService: ConfigService) {
    this.client = this.createClient();
    this.setupEventHandlers();
  }

  private createClient(): RedisClientType {
    const redisConfig = this.configService.get('redis');

    return createClient({
      url: redisConfig.url,
      maxRetriesPerRequest: redisConfig.maxRetriesPerRequest || 3,
      retryDelayOnFailover: redisConfig.retryDelayOnFailover || 100,
      lazyConnect: true,
      socket: {
        keepAlive: redisConfig.keepAlive || 30000,
        connectTimeout: redisConfig.connectionTimeout || 10000,
      },
    });
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.isConnected = true;
      this.logger.log('Redis client connected');
    });

    this.client.on('error', (err: Error) => {
      this.isConnected = false;
      this.logger.error('Redis error:', err);
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      this.logger.log('Redis client ready');
    });

    this.client.on('end', () => {
      this.isConnected = false;
      this.logger.warn('Redis client disconnected');
    });

    this.client.on('reconnecting', () => {
      this.logger.log('Redis client reconnecting...');
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.connect();
    } catch (error) {
      this.logger.error('Failed to connect to Redis on module init:', error);
    }
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      await this.client.connect();
      this.retryCount = 0;
    } catch (error) {
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        this.logger.warn(`Redis connection failed, retrying (${this.retryCount}/${this.maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.connect();
      }
      this.logger.error('Failed to connect to Redis after all retries:', error);
      throw error;
    }
  }

  /**
   * Get a value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    this.stats.operations++;

    try {
      const value = await this.client.get(this.buildKey(key));
      if (value) {
        this.stats.hits++;
        return JSON.parse(value) as T;
      }
      this.stats.misses++;
      return null;
    } catch (error) {
      this.logger.error(`Failed to get cache key: ${key}`, error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set a value in cache with optional TTL
   */
  async set<T = any>(
    key: string,
    value: T,
    options?: CacheOptions
  ): Promise<boolean> {
    try {
      const serializedValue = JSON.stringify(value);
      const fullKey = this.buildKey(key);

      const setOptions: any = {};
      if (options?.ttl) {
        setOptions.EX = options.ttl;
      }

      await this.client.set(fullKey, serializedValue, setOptions);
      return true;
    } catch (error) {
      this.logger.error(`Failed to set cache key: ${key}`, error);
      return false;
    }
  }

  /**
   * Set value with TTL
   */
  async setex<T = any>(
    key: string,
    ttlSeconds: number,
    value: T,
    options?: Omit<CacheOptions, 'ttl'>
  ): Promise<boolean> {
    return this.set(key, value, { ...options, ttl: ttlSeconds });
  }

  /**
   * Delete a key from cache
   */
  async del(key: string): Promise<boolean> {
    try {
      const result = await this.client.del(this.buildKey(key));
      return result > 0;
    } catch (error) {
      this.logger.error(`Failed to delete cache key: ${key}`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys
   */
  async delMany(keys: string[]): Promise<number> {
    try {
      const fullKeys = keys.map(key => this.buildKey(key));
      const result = await this.client.del(fullKeys);
      return result;
    } catch (error) {
      this.logger.error(`Failed to delete multiple cache keys`, error);
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(this.buildKey(key));
      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to check cache key existence: ${key}`, error);
      return false;
    }
  }

  /**
   * Set value only if key doesn't exist
   */
  async setnx<T = any>(key: string, value: T): Promise<boolean> {
    try {
      const serializedValue = JSON.stringify(value);
      const result = await this.client.setnx(this.buildKey(key), serializedValue);
      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to setnx cache key: ${key}`, error);
      return false;
    }
  }

  /**
   * Increment a numeric value
   */
  async incr(key: string, increment = 1): Promise<number | null> {
    try {
      const result = await this.client.incrby(this.buildKey(key), increment);
      return result;
    } catch (error) {
      this.logger.error(`Failed to increment cache key: ${key}`, error);
      return null;
    }
  }

  /**
   * Decrement a numeric value
   */
  async decr(key: string, decrement = 1): Promise<number | null> {
    try {
      const result = await this.client.decrby(this.buildKey(key), decrement);
      return result;
    } catch (error) {
      this.logger.error(`Failed to decrement cache key: ${key}`, error);
      return null;
    }
  }

  /**
   * Set expiration on a key
   */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const result = await this.client.expire(this.buildKey(key), ttlSeconds);
      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to set expiration on cache key: ${key}`, error);
      return false;
    }
  }

  /**
   * Get TTL of a key
   */
  async ttl(key: string): Promise<number | null> {
    try {
      const result = await this.client.ttl(this.buildKey(key));
      return result >= 0 ? result : null;
    } catch (error) {
      this.logger.error(`Failed to get TTL for cache key: ${key}`, error);
      return null;
    }
  }

  /**
   * Find keys matching pattern
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      const keys = await this.client.keys(this.buildKey(pattern));
      return keys.map(key => this.removePrefix(key));
    } catch (error) {
      this.logger.error(`Failed to find keys with pattern: ${pattern}`, error);
      return [];
    }
  }

  /**
   * Get value or set with default function
   */
  async getOrSet<T = any>(
    key: string,
    defaultValue: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await defaultValue();
    await this.set(key, value, options);
    return value;
  }

  /**
   * Cache with automatic refresh on expiration
   */
  async cached<T = any>(
    key: string,
    fetcher: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    await this.set(key, value, options);
    return value;
  }

  /**
   * Pipeline multiple operations
   */
  async pipeline<T extends any[]>(operations: {
    type: 'get' | 'set' | 'del' | 'incr' | 'decr';
    key: string;
    value?: any;
    ttl?: number;
  }[]): Promise<PromiseLike<T>> {
    const multi = this.client.multi();

    for (const op of operations) {
      const fullKey = this.buildKey(op.key);

      switch (op.type) {
        case 'get':
          multi.get(fullKey);
          break;
        case 'set':
          multi.set(fullKey, JSON.stringify(op.value), op.ttl ? { EX: op.ttl } : {});
          break;
        case 'del':
          multi.del(fullKey);
          break;
        case 'incr':
          multi.incrby(fullKey, op.value || 1);
          break;
        case 'decr':
          multi.decrby(fullKey, op.value || 1);
          break;
      }
    }

    return multi.exec() as PromiseLike<T>;
  }

  /**
   * Clear cache
   */
  async clear(): Promise<boolean> {
    try {
      await this.client.flushdb();
      this.logger.warn('Cache cleared');
      return true;
    } catch (error) {
      this.logger.error('Failed to clear cache', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      const [used, peak, free, keys] = await this.pipeline([
        { type: 'info', key: 'memory' },
        { type: 'info', key: 'keyspace' }
      ]);

      const hitRate = this.stats.operations > 0
        ? this.stats.hits / this.stats.operations
        : 0;

      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        operations: this.stats.operations,
        hitRate,
        memoryUsage: {
          used: this.formatMemorySize(used?.used_memory_human || '0B'),
          peak: this.formatMemorySize(used?.maxmemory_human || '0B'),
          free: this.formatMemorySize(used?.maxmemory_human || '0B'),
        },
        keyCount: keys?.length || 0,
      };
    } catch (error) {
      this.logger.error('Failed to get cache stats', error);
      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        operations: this.stats.operations,
        hitRate: 0,
        memoryUsage: {
          used: '0B',
          peak: '0B',
          free: '0B',
        },
        keyCount: 0,
      };
    }
  }

  /**
   * Reset cache statistics
   */
  async resetStats(): Promise<void> {
    this.stats = {
      hits: 0,
      misses: 0,
      operations: 0,
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    connected: boolean;
    responseTime: number;
    stats: CacheStats;
  }> {
    const startTime = Date.now();

    try {
      await this.client.ping();
      const responseTime = Date.now() - startTime;

      return {
        connected: true,
        responseTime,
        stats: await this.getStats(),
      };
    } catch (error) {
      return {
        connected: false,
        responseTime: Date.now() - startTime,
        stats: await this.getStats(),
      };
    }
  }

  onModuleDestroy(): void {
    if (this.client) {
      this.client.quit().catch(error => {
        this.logger.error('Error closing Redis connection:', error);
      });
    }
  }

  private buildKey(key: string): string {
    const prefix = this.configService.get('cache.prefix', 'claude:');
    return `${prefix}${key}`;
  }

  private removePrefix(key: string): string {
    const prefix = this.configService.get('cache.prefix', 'claude:');
    return key.startsWith(prefix) ? key.substring(prefix.length) : key;
  }

  private formatMemorySize(size: string): string {
    if (!size) return '0B';
    return size.trim();
  }
}
