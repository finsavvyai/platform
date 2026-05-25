/**
 * Redis Cache Implementation for Claude Agent Platform
 *
 * Provides Redis-based distributed caching with:
 * - Connection pooling and failover
 * - Multi-tier caching support
 * - Compression and serialization
 * - Health monitoring and metrics
 */

import Redis, { Redis as RedisClient, Cluster as RedisCluster } from 'ioredis';
import { EventEmitter } from 'events';
import { compress, decompress } from 'lz4-napi';
import {
  CacheOptions,
  CacheResult,
  CacheMetadata,
  CacheStats,
  CacheConfig,
  HealthCheckResult,
  BackendHealth,
  CacheEvent
} from './interfaces';

export class RedisCache extends EventEmitter {
  private client: RedisClient | RedisCluster;
  private config: CacheConfig['redis'];
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    hitRate: 0,
    memoryUsage: 0,
    keyCount: 0,
  };
  private lastHealthCheck: Date | null = null;
  private isConnected = false;

  constructor(config: CacheConfig['redis']) {
    super();
    this.config = config;
    this.client = this.createClient();
    this.setupEventHandlers();
  }

  private createClient(): RedisClient {
    const client = new Redis({
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.db,
      keyPrefix: this.config.keyPrefix,
      retryDelayOnFailover: this.config.retryDelayOnFailover,
      maxRetriesPerRequest: this.config.maxRetriesPerRequest,
      lazyConnect: this.config.lazyConnect,
      connectTimeout: this.config.connectTimeout,
      commandTimeout: this.config.commandTimeout,
    });

    return client;
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.isConnected = true;
      this.emit('connected');
    });

    this.client.on('error', (error) => {
      this.isConnected = false;
      this.emit('error', error);
    });

    this.client.on('close', () => {
      this.isConnected = false;
      this.emit('disconnected');
    });

    this.client.on('reconnecting', () => {
      this.emit('reconnecting');
    });
  }

  async get<T = any>(key: string): Promise<CacheResult<T | null>> {
    const startTime = Date.now();

    try {
      const data = await this.client.get(key);

      if (data === null) {
        this.stats.misses++;
        this.updateHitRate();

        return {
          value: null,
          hit: false,
          source: 'redis',
        };
      }

      const parsed = JSON.parse(data);
      let value = parsed.value;
      const metadata = parsed.metadata;

      // Decompress if needed
      if (metadata.compressed) {
        value = JSON.parse(decompress(Buffer.from(value, 'base64')).toString());
      }

      this.stats.hits++;
      this.updateHitRate();

      this.emit('get', {
        type: 'get',
        key,
        backend: 'redis',
        timestamp: new Date(),
        hit: true,
      } as CacheEvent);

      return {
        value,
        hit: true,
        source: 'redis',
        ttl: metadata.expiresAt - Date.now(),
        metadata,
      };
    } catch (error) {
      this.stats.misses++;
      this.updateHitRate();

      this.emit('error', error);

      return {
        value: null,
        hit: false,
        source: 'redis',
      };
    } finally {
      this.emit('operationComplete', {
        operation: 'get',
        duration: Date.now() - startTime,
      });
    }
  }

  async set<T = any>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<boolean> {
    const startTime = Date.now();
    const ttl = options.ttl || 300000; // 5 minutes default
    const now = Date.now();

    try {
      let serializedValue = value;
      let compressed = false;
      let size = 0;

      // Serialize and compress if needed
      if (options.serialize !== false && typeof value === 'object') {
        serializedValue = JSON.stringify(value);

        if (options.compress && serializedValue.length > 1024) {
          const compressedBuffer = compress(Buffer.from(serializedValue));
          serializedValue = compressedBuffer.toString('base64');
          compressed = true;
        }
      }

      size = Buffer.byteLength(typeof serializedValue === 'string' ? serializedValue : JSON.stringify(serializedValue));

      const metadata: CacheMetadata = {
        createdAt: now,
        expiresAt: now + ttl,
        accessCount: 0,
        lastAccessed: now,
        tags: options.tags,
        size,
        compressed,
        version: '1.0.0',
      };

      const data = {
        value: serializedValue,
        metadata,
      };

      await this.client.setex(key, Math.ceil(ttl / 1000), JSON.stringify(data));

      this.stats.sets++;

      this.emit('set', {
        type: 'set',
        key,
        backend: 'redis',
        timestamp: new Date(),
        ttl,
        size,
      } as CacheEvent);

      return true;
    } catch (error) {
      this.emit('error', error);
      return false;
    } finally {
      this.emit('operationComplete', {
        operation: 'set',
        duration: Date.now() - startTime,
      });
    }
  }

  async delete(key: string): Promise<boolean> {
    const startTime = Date.now();

    try {
      const result = await this.client.del(key);
      this.stats.deletes++;

      this.emit('delete', {
        type: 'delete',
        key,
        backend: 'redis',
        timestamp: new Date(),
      } as CacheEvent);

      return result > 0;
    } catch (error) {
      this.emit('error', error);
      return false;
    } finally {
      this.emit('operationComplete', {
        operation: 'delete',
        duration: Date.now() - startTime,
      });
    }
  }

  async clear(pattern?: string): Promise<number> {
    const startTime = Date.now();

    try {
      let keys: string[] = [];

      if (pattern) {
        keys = await this.client.keys(pattern);
      } else {
        // Get all keys with our prefix
        keys = await this.client.keys(`${this.config.keyPrefix}*`);
      }

      if (keys.length === 0) {
        return 0;
      }

      const result = await this.client.del(...keys);
      this.stats.deletes += result;

      this.emit('clear', {
        type: 'clear',
        key: pattern || '*',
        backend: 'redis',
        timestamp: new Date(),
        count: result,
      } as CacheEvent);

      return result;
    } catch (error) {
      this.emit('error', error);
      return 0;
    } finally {
      this.emit('operationComplete', {
        operation: 'clear',
        duration: Date.now() - startTime,
      });
    }
  }

  async invalidateByTags(tags: string[]): Promise<number> {
    // This would require maintaining a tag index
    // For now, we'll implement a simple approach
    const patterns = tags.map(tag => `*tag:${tag}*`);
    let totalDeleted = 0;

    for (const pattern of patterns) {
      totalDeleted += await this.clear(pattern);
    }

    return totalDeleted;
  }

  async getStats(): Promise<CacheStats> {
    try {
      const info = await this.client.info('memory');
      const dbSize = await this.client.dbsize();

      // Parse Redis memory info
      const memoryMatch = info.match(/used_memory:(\d+)/);
      const memoryUsed = memoryMatch ? parseInt(memoryMatch[1]) : 0;

      this.stats.memoryUsage = memoryUsed;
      this.stats.keyCount = dbSize;

      return { ...this.stats };
    } catch (error) {
      this.emit('error', error);
      return { ...this.stats };
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const issues: string[] = [];

    try {
      const responseTime = Date.now() - startTime;

      // Test Redis connection
      const pong = await this.client.ping();
      const connected = pong === 'PONG';

      if (!connected) {
        issues.push('Redis connection failed');
      }

      // Get memory info
      const info = await this.client.info('memory');
      const memoryMatch = info.match(/used_memory:(\d+)/);
      const memoryUsed = memoryMatch ? parseInt(memoryMatch[1]) : 0;

      // Check if Redis memory usage is high (>80% of maxmemory if set)
      const maxmemoryMatch = info.match(/maxmemory:(\d+)/);
      if (maxmemoryMatch) {
        const maxmemory = parseInt(maxmemoryMatch[1]);
        const memoryUsage = memoryUsed / maxmemory;
        if (memoryUsage > 0.8) {
          issues.push(`Redis memory usage is high: ${(memoryUsage * 100).toFixed(1)}%`);
        }
      }

      const backendHealth: BackendHealth = {
        connected,
        responseTime,
        lastCheck: new Date(),
      };

      if (!connected) {
        backendHealth.error = 'Redis not responding';
      }

      this.lastHealthCheck = new Date();

      return {
        status: issues.length === 0 ? 'healthy' : issues.length <= 2 ? 'degraded' : 'unhealthy',
        backends: {
          redis: backendHealth,
        },
        metrics: {
          operations: {
            get: this.stats.hits + this.stats.misses,
            set: this.stats.sets,
            delete: this.stats.deletes,
            clear: 0, // Not tracked separately
          },
          performance: {
            avgGetTime: 0, // Would need to track this
            avgSetTime: 0, // Would need to track this
            totalOperations: this.stats.hits + this.stats.misses + this.stats.sets + this.stats.deletes,
          },
          memory: {
            used: memoryUsed,
            available: 0, // Would need total system memory
            percentage: 0, // Would need total system memory
          },
          redis: {
            connected,
            memory: memoryUsed,
            keys: this.stats.keyCount,
            operations: this.stats.hits + this.stats.misses + this.stats.sets + this.stats.deletes,
          },
        },
        lastCheck: this.lastHealthCheck,
        issues,
      };
    } catch (error) {
      const backendHealth: BackendHealth = {
        connected: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date(),
      };

      return {
        status: 'unhealthy',
        backends: {
          redis: backendHealth,
        },
        metrics: {
          operations: {
            get: this.stats.hits + this.stats.misses,
            set: this.stats.sets,
            delete: this.stats.deletes,
            clear: 0,
          },
          performance: {
            avgGetTime: 0,
            avgSetTime: 0,
            totalOperations: this.stats.hits + this.stats.misses + this.stats.sets + this.stats.deletes,
          },
          memory: {
            used: 0,
            available: 0,
            percentage: 0,
          },
        },
        lastCheck: new Date(),
        issues: [`Redis connection error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      };
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  // Utility methods
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.emit('error', error);
      return false;
    }
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, Math.ceil(ttl / 1000));
      return result === 1;
    } catch (error) {
      this.emit('error', error);
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      const result = await this.client.ttl(key);
      return result * 1000; // Convert to milliseconds
    } catch (error) {
      this.emit('error', error);
      return -1;
    }
  }
}
