import { RedisClientType } from 'redis';
import { logger } from '../utils/logger';
import { dbConnectionManager } from '../connection';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  nx?: boolean; // Only set if key doesn't exist
  xx?: boolean; // Only set if key exists
}

export interface CacheResult<T = any> {
  hit: boolean;
  data: T | null;
  source: 'cache' | 'database' | 'none';
  ttl?: number;
}

export interface BatchGetResult<T = any> {
  hits: Record<string, T>;
  misses: string[];
  source: 'cache' | 'database' | 'mixed';
}

export class RedisService {
  private client: RedisClientType;
  private keyPrefix: string;
  private defaultTtl: number;

  constructor(keyPrefix = 'claude-agent:', defaultTtl = 3600) {
    this.keyPrefix = keyPrefix;
    this.defaultTtl = defaultTtl;
  }

  public async initialize(): Promise<void> {
    this.client = dbConnectionManager.getRedisClient();
    logger.info('Redis service initialized');
  }

  private getKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  public async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      const fullKey = this.getKey(key);
      const serializedValue = JSON.stringify(value);
      const ttl = options.ttl || this.defaultTtl;

      if (options.nx) {
        await this.client.set(fullKey, serializedValue, {
          NX: true,
          EX: ttl,
        });
      } else if (options.xx) {
        await this.client.set(fullKey, serializedValue, {
          XX: true,
          EX: ttl,
        });
      } else {
        await this.client.setEx(fullKey, ttl, serializedValue);
      }

      logger.debug(`Cache SET: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      logger.error(`Cache SET error for key ${key}:`, error);
      throw error;
    }
  }

  public async get<T = any>(key: string): Promise<CacheResult<T>> {
    try {
      const fullKey = this.getKey(key);
      const value = await this.client.get(fullKey);

      if (value === null) {
        logger.debug(`Cache MISS: ${key}`);
        return {
          hit: false,
          data: null,
          source: 'none',
        };
      }

      const parsedValue = JSON.parse(value) as T;
      const ttl = await this.client.ttl(fullKey);

      logger.debug(`Cache HIT: ${key} (TTL: ${ttl}s)`);

      return {
        hit: true,
        data: parsedValue,
        source: 'cache',
        ttl,
      };
    } catch (error) {
      logger.error(`Cache GET error for key ${key}:`, error);
      return {
        hit: false,
        data: null,
        source: 'none',
      };
    }
  }

  public async mget<T = any>(keys: string[]): Promise<BatchGetResult<T>> {
    const result: BatchGetResult<T> = {
      hits: {},
      misses: [],
      source: 'cache',
    };

    try {
      const fullKeys = keys.map(key => this.getKey(key));
      const values = await this.client.mGet(fullKeys);

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const value = values[i];

        if (value === null) {
          result.misses.push(key);
        } else {
          try {
            const parsedValue = JSON.parse(value) as T;
            result.hits[key] = parsedValue;
          } catch (parseError) {
            logger.warn(`Failed to parse cached value for key ${key}:`, parseError);
            result.misses.push(key);
          }
        }
      }

      const hitCount = Object.keys(result.hits).length;
      if (hitCount === 0) {
        result.source = 'database';
      } else if (hitCount < keys.length) {
        result.source = 'mixed';
      }

      logger.debug(`Cache MGET: ${hitCount}/${keys.length} hits`);
      return result;
    } catch (error) {
      logger.error('Cache MGET error:', error);
      result.source = 'database';
      return result;
    }
  }

  public async mset<T extends Record<string, any>>(
    items: T,
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      const pipeline = this.client.multi();
      const ttl = options.ttl || this.defaultTtl;

      for (const [key, value] of Object.entries(items)) {
        const fullKey = this.getKey(key);
        const serializedValue = JSON.stringify(value);

        if (options.nx) {
          pipeline.set(fullKey, serializedValue, { NX: true, EX: ttl });
        } else if (options.xx) {
          pipeline.set(fullKey, serializedValue, { XX: true, EX: ttl });
        } else {
          pipeline.setEx(fullKey, ttl, serializedValue);
        }
      }

      await pipeline.exec();
      logger.debug(`Cache MSET: ${Object.keys(items).length} items`);
    } catch (error) {
      logger.error('Cache MSET error:', error);
      throw error;
    }
  }

  public async delete(key: string): Promise<boolean> {
    try {
      const fullKey = this.getKey(key);
      const result = await this.client.del(fullKey);
      const deleted = result > 0;

      logger.debug(`Cache DELETE: ${key} (${deleted ? 'success' : 'not found'})`);
      return deleted;
    } catch (error) {
      logger.error(`Cache DELETE error for key ${key}:`, error);
      return false;
    }
  }

  public async mdelete(keys: string[]): Promise<number> {
    try {
      const fullKeys = keys.map(key => this.getKey(key));
      const result = await this.client.del(fullKeys);

      logger.debug(`Cache MDELETE: ${result}/${keys.length} items deleted`);
      return result;
    } catch (error) {
      logger.error('Cache MDELETE error:', error);
      return 0;
    }
  }

  public async exists(key: string): Promise<boolean> {
    try {
      const fullKey = this.getKey(key);
      const result = await this.client.exists(fullKey);
      return result === 1;
    } catch (error) {
      logger.error(`Cache EXISTS error for key ${key}:`, error);
      return false;
    }
  }

  public async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const fullKey = this.getKey(key);
      const result = await this.client.expire(fullKey, ttl);

      logger.debug(`Cache EXPIRE: ${key} (TTL: ${ttl}s, ${result ? 'success' : 'not found'})`);
      return result;
    } catch (error) {
      logger.error(`Cache EXPIRE error for key ${key}:`, error);
      return false;
    }
  }

  public async ttl(key: string): Promise<number> {
    try {
      const fullKey = this.getKey(key);
      const result = await this.client.ttl(fullKey);
      return result;
    } catch (error) {
      logger.error(`Cache TTL error for key ${key}:`, error);
      return -1;
    }
  }

  public async increment(key: string, amount = 1): Promise<number> {
    try {
      const fullKey = this.getKey(key);
      const result = await this.client.incrBy(fullKey, amount);

      logger.debug(`Cache INCREMENT: ${key} by ${amount} = ${result}`);
      return result;
    } catch (error) {
      logger.error(`Cache INCREMENT error for key ${key}:`, error);
      throw error;
    }
  }

  public async decrement(key: string, amount = 1): Promise<number> {
    try {
      const fullKey = this.getKey(key);
      const result = await this.client.decrBy(fullKey, amount);

      logger.debug(`Cache DECREMENT: ${key} by ${amount} = ${result}`);
      return result;
    } catch (error) {
      logger.error(`Cache DECREMENT error for key ${key}:`, error);
      throw error;
    }
  }

  public async addToSet<T>(key: string, ...members: T[]): Promise<number> {
    try {
      const fullKey = this.getKey(key);
      const serializedMembers = members.map(member => JSON.stringify(member));
      const result = await this.client.sAdd(fullKey, serializedMembers);

      logger.debug(`Cache SADD: ${key} added ${result} members`);
      return result;
    } catch (error) {
      logger.error(`Cache SADD error for key ${key}:`, error);
      throw error;
    }
  }

  public async getSet<T = any>(key: string): Promise<T[]> {
    try {
      const fullKey = this.getKey(key);
      const members = await this.client.sMembers(fullKey);

      const parsedMembers = members.map(member => {
        try {
          return JSON.parse(member) as T;
        } catch (parseError) {
          logger.warn(`Failed to parse set member for key ${key}:`, parseError);
          return null;
        }
      }).filter(Boolean) as T[];

      logger.debug(`Cache SMEMBERS: ${key} returned ${parsedMembers.length} members`);
      return parsedMembers;
    } catch (error) {
      logger.error(`Cache SMEMBERS error for key ${key}:`, error);
      return [];
    }
  }

  public async removeFromSet<T>(key: string, ...members: T[]): Promise<number> {
    try {
      const fullKey = this.getKey(key);
      const serializedMembers = members.map(member => JSON.stringify(member));
      const result = await this.client.sRem(fullKey, serializedMembers);

      logger.debug(`Cache SREM: ${key} removed ${result} members`);
      return result;
    } catch (error) {
      logger.error(`Cache SREM error for key ${key}:`, error);
      throw error;
    }
  }

  public async setContains<T>(key: string, member: T): Promise<boolean> {
    try {
      const fullKey = this.getKey(key);
      const serializedMember = JSON.stringify(member);
      const result = await this.client.sIsMember(fullKey, serializedMember);

      return result;
    } catch (error) {
      logger.error(`Cache SISMEMBER error for key ${key}:`, error);
      return false;
    }
  }

  public async getSetSize(key: string): Promise<number> {
    try {
      const fullKey = this.getKey(key);
      const result = await this.client.sCard(fullKey);
      return result;
    } catch (error) {
      logger.error(`Cache SCARD error for key ${key}:`, error);
      return 0;
    }
  }

  public async pushToList<T>(key: string, ...items: T[]): Promise<number> {
    try {
      const fullKey = this.getKey(key);
      const serializedItems = items.map(item => JSON.stringify(item));
      const result = await this.client.rPush(fullKey, serializedItems);

      logger.debug(`Cache RPUSH: ${key} added ${items.length} items, total: ${result}`);
      return result;
    } catch (error) {
      logger.error(`Cache RPUSH error for key ${key}:`, error);
      throw error;
    }
  }

  public async getList<T = any>(key: string, start = 0, end = -1): Promise<T[]> {
    try {
      const fullKey = this.getKey(key);
      const items = await this.client.lRange(fullKey, start, end);

      const parsedItems = items.map(item => {
        try {
          return JSON.parse(item) as T;
        } catch (parseError) {
          logger.warn(`Failed to parse list item for key ${key}:`, parseError);
          return null;
        }
      }).filter(Boolean) as T[];

      logger.debug(`Cache LRANGE: ${key} returned ${parsedItems.length} items`);
      return parsedItems;
    } catch (error) {
      logger.error(`Cache LRANGE error for key ${key}:`, error);
      return [];
    }
  }

  public async getListLength(key: string): Promise<number> {
    try {
      const fullKey = this.getKey(key);
      const result = await this.client.lLen(fullKey);
      return result;
    } catch (error) {
      logger.error(`Cache LLEN error for key ${key}:`, error);
      return 0;
    }
  }

  public async popFromList<T = any>(key: string): Promise<T | null> {
    try {
      const fullKey = this.getKey(key);
      const item = await this.client.lPop(fullKey);

      if (item === null) {
        return null;
      }

      try {
        return JSON.parse(item) as T;
      } catch (parseError) {
        logger.warn(`Failed to parse popped list item for key ${key}:`, parseError);
        return null;
      }
    } catch (error) {
      logger.error(`Cache LPOP error for key ${key}:`, error);
      return null;
    }
  }

  public async clearPattern(pattern: string): Promise<number> {
    try {
      const fullPattern = this.getKey(pattern);
      const keys = await this.client.keys(fullPattern);

      if (keys.length === 0) {
        logger.debug(`Cache CLEAR: No keys found for pattern ${pattern}`);
        return 0;
      }

      const result = await this.client.del(keys);
      logger.debug(`Cache CLEAR: Deleted ${result} keys for pattern ${pattern}`);
      return result;
    } catch (error) {
      logger.error(`Cache CLEAR error for pattern ${pattern}:`, error);
      return 0;
    }
  }

  public async clearAll(): Promise<string> {
    try {
      const result = await this.client.flushDb();
      logger.warn('Cache FLUSHDB: All cache data cleared');
      return result;
    } catch (error) {
      logger.error('Cache FLUSHDB error:', error);
      throw error;
    }
  }

  public async getMemoryInfo(): Promise<{
    usedMemory: number;
    usedMemoryHuman: string;
    peakMemory: number;
    peakMemoryHuman: string;
    keyspace: number;
  }> {
    try {
      const info = await this.client.info('memory');
      const dbSize = await this.client.dbSize();

      const parseMemoryInfo = (info: string) => {
        const lines = info.split('\r\n');
        const memoryData: Record<string, string> = {};

        for (const line of lines) {
          if (line.includes(':')) {
            const [key, value] = line.split(':');
            memoryData[key] = value;
          }
        }

        return {
          usedMemory: parseInt(memoryData['used_memory'] || '0'),
          usedMemoryHuman: memoryData['used_memory_human'] || '0B',
          peakMemory: parseInt(memoryData['used_memory_peak'] || '0'),
          peakMemoryHuman: memoryData['used_memory_peak_human'] || '0B',
        };
      };

      const memoryInfo = parseMemoryInfo(info);

      return {
        ...memoryInfo,
        keyspace: dbSize,
      };
    } catch (error) {
      logger.error('Cache MEMORY INFO error:', error);
      throw error;
    }
  }

  public async getInfo(): Promise<{
    version: string;
    mode: string;
    role: string;
    connectedClients: number;
    uptimeSeconds: number;
    memoryInfo: Awaited<ReturnType<typeof this.getMemoryInfo>>;
  }> {
    try {
      const info = await this.client.info('server');
      const lines = info.split('\r\n');
      const serverData: Record<string, string> = {};

      for (const line of lines) {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          serverData[key] = value;
        }
      }

      return {
        version: serverData['redis_version'] || 'unknown',
        mode: serverData['redis_mode'] || 'standalone',
        role: serverData['role'] || 'master',
        connectedClients: parseInt(serverData['connected_clients'] || '0'),
        uptimeSeconds: parseInt(serverData['uptime_in_seconds'] || '0'),
        memoryInfo: await this.getMemoryInfo(),
      };
    } catch (error) {
      logger.error('Cache INFO error:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const redisService = new RedisService();
