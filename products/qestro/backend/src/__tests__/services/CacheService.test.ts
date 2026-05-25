/**
 * Cache Service Unit Tests
 * Test Redis caching mechanisms, cache invalidation, and performance
 */

import { CacheService } from '../../services/CacheService.js';
import Redis from 'ioredis';

// Mock Redis
jest.mock('ioredis', () => {
  const mockRedis = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    ttl: jest.fn(),
    expire: jest.fn(),
    mget: jest.fn(),
    keys: jest.fn(),
    sadd: jest.fn(),
    srem: jest.fn(),
    smembers: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
    info: jest.fn(),
    pipeline: jest.fn(() => ({
      sadd: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      setex: jest.fn().mockReturnThis(),
      del: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([[null, 'OK']]),
    })),
    on: jest.fn(),
  };

  return jest.fn(() => mockRedis);
});

describe('CacheService', () => {
  let cacheService: CacheService;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    cacheService = new CacheService({
      prefix: 'test:',
      defaultTTL: 300,
      enableMetrics: true,
    });

    mockRedis = (cacheService as any).redis;
    jest.clearAllMocks();
  });

  describe('Connection Management', () => {
    test('should connect to Redis successfully', async () => {
      mockRedis.connect.mockResolvedValue(undefined);

      await cacheService.connect();

      expect(mockRedis.connect).toHaveBeenCalledTimes(1);
    });

    test('should handle connection errors', async () => {
      mockRedis.connect.mockRejectedValue(new Error('Connection failed'));

      await expect(cacheService.connect()).rejects.toThrow('Connection failed');
    });

    test('should disconnect from Redis successfully', async () => {
      mockRedis.disconnect.mockResolvedValue(undefined);

      await cacheService.disconnect();

      expect(mockRedis.disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cache Operations', () => {
    test('should set and get cache data successfully', async () => {
      const key = 'test-key';
      const data = { message: 'Hello, World!' };

      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue(JSON.stringify(data));

      // Set data
      const setResult = await cacheService.set({ key, data });
      expect(setResult).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test:test-key',
        300,
        JSON.stringify(data)
      );

      // Get data
      const getResult = await cacheService.get(key);
      expect(getResult).toEqual(data);
      expect(mockRedis.get).toHaveBeenCalledWith('test:test-key');
    });

    test('should handle cache miss', async () => {
      const key = 'non-existent-key';
      mockRedis.get.mockResolvedValue(null);

      const result = await cacheService.get(key);

      expect(result).toBeNull();
      expect(mockRedis.get).toHaveBeenCalledWith('test:non-existent-key');
    });

    test('should delete cache data successfully', async () => {
      const key = 'test-key';
      mockRedis.del.mockResolvedValue(1);
      mockRedis.smembers.mockResolvedValue([]);
      mockRedis.srem.mockResolvedValue(0);

      const result = await cacheService.delete(key);

      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('test:test-key');
    });

    test('should handle non-existent key deletion', async () => {
      const key = 'non-existent-key';
      mockRedis.del.mockResolvedValue(0);
      mockRedis.smembers.mockResolvedValue([]);

      const result = await cacheService.delete(key);

      expect(result).toBe(false);
    });

    test('should check key existence', async () => {
      const key = 'test-key';
      mockRedis.exists.mockResolvedValue(1);

      const result = await cacheService.exists(key);

      expect(result).toBe(true);
      expect(mockRedis.exists).toHaveBeenCalledWith('test:test-key');
    });

    test('should get TTL for key', async () => {
      const key = 'test-key';
      mockRedis.ttl.mockResolvedValue(300);

      const result = await cacheService.ttl(key);

      expect(result).toBe(300);
      expect(mockRedis.ttl).toHaveBeenCalledWith('test:test-key');
    });

    test('should extend TTL for key', async () => {
      const key = 'test-key';
      mockRedis.expire.mockResolvedValue(1);

      const result = await cacheService.expire(key, 600);

      expect(result).toBe(true);
      expect(mockRedis.expire).toHaveBeenCalledWith('test:test-key', 600);
    });
  });

  describe('Tag-based Cache Invalidation', () => {
    test('should set cache with tags', async () => {
      const key = 'test-key';
      const data = { message: 'test data' };
      const tags = ['user', 'profile'];

      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.sadd.mockResolvedValue(1);

      const result = await cacheService.set({ key, data, tags });

      expect(result).toBe(true);
      expect(mockRedis.sadd).toHaveBeenCalledTimes(3); // tags key + 2 tag sets
    });

    test('should invalidate cache by tag', async () => {
      const tag = 'user';
      const keys = ['test:test-key-1', 'test:test-key-2'];

      mockRedis.smembers.mockResolvedValue(keys);
      mockRedis.del.mockResolvedValue(2);
      mockRedis.srem.mockResolvedValue(1);

      const deletedCount = await cacheService.invalidateByTag(tag);

      expect(deletedCount).toBe(2);
      expect(mockRedis.smembers).toHaveBeenCalledWith('test:tags:user');
    });

    test('should handle empty tag invalidation', async () => {
      const tag = 'empty-tag';
      mockRedis.smembers.mockResolvedValue([]);

      const deletedCount = await cacheService.invalidateByTag(tag);

      expect(deletedCount).toBe(0);
    });
  });

  describe('Multi-key Operations', () => {
    test('should get multiple keys', async () => {
      const keys = ['key1', 'key2', 'key3'];
      const values = ['{"data":1}', null, '{"data":3}'];

      mockRedis.mget.mockResolvedValue(values);

      const results = await cacheService.mget(keys);

      expect(results.size).toBe(3);
      expect(results.get('key1')).toEqual({ data: 1 });
      expect(results.get('key2')).toBeNull();
      expect(results.get('key3')).toEqual({ data: 3 });
    });

    test('should set multiple keys', async () => {
      const items = [
        { config: { key: 'key1' }, data: 'value1' },
        { config: { key: 'key2' }, data: 'value2' },
      ];

      mockRedis.setex.mockResolvedValue('OK');

      const results = await cacheService.mset(items);

      expect(results).toHaveLength(2);
      expect(results.every(Boolean)).toBe(true);
    });

    test('should handle empty multi-key operations', async () => {
      const getResults = await cacheService.mget([]);
      const setResults = await cacheService.mset([]);

      expect(getResults.size).toBe(0);
      expect(setResults).toHaveLength(0);
    });
  });

  describe('Data Compression', () => {
    test('should compress large data', async () => {
      const key = 'large-data-key';
      const largeData = 'x'.repeat(2048); // Large string

      // Mock zlib
      const zlib = await import('zlib');
      const deflateSpy = jest.spyOn(zlib, 'deflateSync');
      const inflateSpy = jest.spyOn(zlib, 'inflateSync');

      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue('compressed:' + 'base64encodeddata');

      // Set large data
      await cacheService.set({ key, data: largeData });
      expect(deflateSpy).toHaveBeenCalled();

      // Get compressed data
      await cacheService.get(key);
      expect(inflateSpy).toHaveBeenCalled();

      deflateSpy.mockRestore();
      inflateSpy.mockRestore();
    });

    test('should not compress small data', async () => {
      const key = 'small-data-key';
      const smallData = 'hello';

      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue(JSON.stringify(smallData));

      await cacheService.set({ key, data: smallData });
      const result = await cacheService.get(key);

      expect(result).toBe(smallData);
    });
  });

  describe('Cache Metrics', () => {
    test('should track cache hits and misses', async () => {
      const key = 'test-key';
      const data = { message: 'test' };

      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(data));
      mockRedis.get.mockResolvedValueOnce(null);

      // Cache hit
      await cacheService.set({ key, data });
      await cacheService.get(key);

      // Cache miss
      await cacheService.get('non-existent');

      const metrics = cacheService.getMetrics();

      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(1);
      expect(metrics.sets).toBe(1);
      expect(metrics.hitRate).toBe(50);
    });

    test('should calculate hit rate correctly', async () => {
      const key = 'test-key';
      const data = { message: 'test' };

      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue(JSON.stringify(data));

      await cacheService.set({ key, data });
      await cacheService.get(key);
      await cacheService.get(key);

      const metrics = cacheService.getMetrics();

      expect(metrics.hits).toBe(2);
      expect(metrics.misses).toBe(0);
      expect(metrics.hitRate).toBe(100);
    });

    test('should reset metrics', async () => {
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue(null);

      await cacheService.set({ key: 'test', data: 'data' });
      await cacheService.get('non-existent');

      let metrics = cacheService.getMetrics();
      expect(metrics.sets).toBe(1);
      expect(metrics.misses).toBe(1);

      cacheService.resetMetrics();

      metrics = cacheService.getMetrics();
      expect(metrics.sets).toBe(0);
      expect(metrics.misses).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle Redis errors gracefully', async () => {
      const key = 'test-key';
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.get(key);

      expect(result).toBeNull();
      expect(mockRedis.get).toHaveBeenCalledWith('test:test-key');
    });

    test('should track errors in metrics', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      await cacheService.get('test-key');

      const metrics = cacheService.getMetrics();
      expect(metrics.errors).toBe(1);
    });

    test('should handle JSON parsing errors', async () => {
      const key = 'invalid-json-key';
      mockRedis.get.mockResolvedValue('invalid json data');

      const result = await cacheService.get(key);

      expect(result).toBeNull();
    });

    test('should handle decompression errors', async () => {
      const key = 'compression-error-key';
      mockRedis.get.mockResolvedValue('compressed:invalidbase64');

      const result = await cacheService.get(key);

      expect(result).toBeNull();
    });
  });

  describe('Health Check', () => {
    test('should report healthy status', async () => {
      mockRedis.ping.mockResolvedValue('PONG');
      mockRedis.info.mockResolvedValue('used_memory:1000000\nmaxmemory:10000000');

      const health = await cacheService.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.latency).toBeGreaterThan(0);
    });

    test('should report degraded status for high latency', async () => {
      mockRedis.ping.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve('PONG'), 2000))
      );
      mockRedis.info.mockResolvedValue('used_memory:1000000\nmaxmemory:10000000');

      const health = await cacheService.healthCheck();

      expect(health.status).toBe('degraded');
      expect(health.latency).toBeGreaterThan(1000);
    });

    test('should report unhealthy status for high memory usage', async () => {
      mockRedis.ping.mockResolvedValue('PONG');
      mockRedis.info.mockResolvedValue('used_memory:9500000\nmaxmemory:10000000');

      const health = await cacheService.healthCheck();

      expect(health.status).toBe('unhealthy');
    });

    test('should report unhealthy status on connection error', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection failed'));

      const health = await cacheService.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.error).toBe('Connection failed');
    });
  });

  describe('Cache Clearing', () => {
    test('should clear all cache', async () => {
      const keys = ['test:key1', 'test:key2', 'test:key3'];
      mockRedis.keys.mockResolvedValue(keys);
      mockRedis.del.mockResolvedValue(3);

      const result = await cacheService.clear();

      expect(result).toBe(true);
      expect(mockRedis.keys).toHaveBeenCalledWith('test:*');
      expect(mockRedis.del).toHaveBeenCalledWith(...keys);
    });

    test('should handle empty cache clearing', async () => {
      mockRedis.keys.mockResolvedValue([]);

      const result = await cacheService.clear();

      expect(result).toBe(true);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('Configuration', () => {
    test('should use custom TTL', async () => {
      const key = 'test-key';
      const data = { message: 'test' };
      const customTTL = 600;

      mockRedis.setex.mockResolvedValue('OK');

      await cacheService.set({ key, data, ttl: customTTL });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test:test-key',
        customTTL,
        JSON.stringify(data)
      );
    });

    test('should use default TTL when not specified', async () => {
      const key = 'test-key';
      const data = { message: 'test' };

      mockRedis.setex.mockResolvedValue('OK');

      await cacheService.set({ key, data });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test:test-key',
        300,
        JSON.stringify(data)
      );
    });

    test('should disable compression when configured', async () => {
      const cacheServiceNoCompression = new CacheService({
        enableCompression: false,
      });

      mockRedis.setex.mockResolvedValue('OK');

      await cacheServiceNoCompression.set({ key: 'test', data: 'large data'.repeat(100) });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.stringContaining('large data')
      );
    });
  });
});