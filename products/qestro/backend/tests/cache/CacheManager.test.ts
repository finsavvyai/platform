/**
 * CacheManager Tests
 */

import { CacheManager } from '../../src/services/cache/CacheManager.js';

describe('CacheManager', () => {
  let cache: CacheManager;

  beforeEach(() => {
    cache = new CacheManager({
      maxSizeBytes: 10 * 1024 * 1024, // 10MB
      maxEntriesL1: 1000,
      evictionPolicy: 'lru',
      defaultTtlSeconds: 3600,
      enableL2: false,
    });
  });

  it('should set and get cache values', async () => {
    await cache.set('test-key', { value: 'test-data' });

    const result = await cache.get('test-key');

    expect(result).toEqual({ value: 'test-data' });
  });

  it('should return null for missing keys', async () => {
    const result = await cache.get('nonexistent');

    expect(result).toBeNull();
  });

  it('should delete cache entries', async () => {
    await cache.set('test-key', 'test-value');

    await cache.delete('test-key');

    const result = await cache.get('test-key');

    expect(result).toBeNull();
  });

  it('should invalidate by pattern', async () => {
    await cache.set('user:1:profile', { id: 1 });
    await cache.set('user:2:profile', { id: 2 });
    await cache.set('post:1:data', { id: 1 });

    const count = await cache.invalidatePattern('user:.*:profile');

    expect(count).toBe(2);

    const result1 = await cache.get('user:1:profile');
    const result2 = await cache.get('post:1:data');

    expect(result1).toBeNull();
    expect(result2).toEqual({ id: 1 });
  });

  it('should respect TTL expiration', async () => {
    await cache.set('ttl-key', 'value', 1);

    let result = await cache.get('ttl-key');
    expect(result).toBe('value');

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 1100));

    result = await cache.get('ttl-key');
    expect(result).toBeNull();
  });

  it('should track cache statistics', async () => {
    await cache.set('key1', 'value1');
    await cache.set('key2', 'value2');

    await cache.get('key1'); // Hit
    await cache.get('key1'); // Hit
    await cache.get('nonexistent'); // Miss

    const stats = cache.getStats();

    expect(stats.hitsL1).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.entriesL1).toBe(2);
  });

  it('should calculate hit rate', async () => {
    await cache.set('key1', 'value1');

    await cache.get('key1'); // Hit
    await cache.get('key1'); // Hit
    await cache.get('key1'); // Hit
    await cache.get('missing'); // Miss

    const stats = cache.getStats();

    expect(stats.hitRate).toBeCloseTo(0.75, 1);
  });

  it('should track event history', async () => {
    await cache.set('key1', 'value1');
    await cache.get('key1');
    await cache.get('missing');

    const events = cache.getEventHistory(10);

    expect(events.length).toBeGreaterThan(0);
    expect(events.some((e) => e.type === 'set')).toBe(true);
    expect(events.some((e) => e.type === 'hit')).toBe(true);
    expect(events.some((e) => e.type === 'miss')).toBe(true);
  });

  it('should evict entries on size limit (LRU)', async () => {
    const smallCache = new CacheManager({
      maxSizeBytes: 500,
      maxEntriesL1: 1000,
      evictionPolicy: 'lru',
      defaultTtlSeconds: 3600,
      enableL2: false,
    });

    const largeValue = 'x'.repeat(100);

    // Fill cache
    for (let i = 0; i < 10; i++) {
      await smallCache.set(`key-${i}`, largeValue);
    }

    // Access first keys to prevent eviction
    await smallCache.get('key-0');
    await smallCache.get('key-1');

    const stats = smallCache.getStats();

    // Should have evicted least recently used entries
    expect(stats.entriesL1).toBeLessThan(10);
  });

  it('should clear all caches', async () => {
    await cache.set('key1', 'value1');
    await cache.set('key2', 'value2');

    await cache.clear();

    const result1 = await cache.get('key1');
    const result2 = await cache.get('key2');

    expect(result1).toBeNull();
    expect(result2).toBeNull();
    expect(cache.getStats().entriesL1).toBe(0);
  });

  it('should track access count for LFU', async () => {
    cache = new CacheManager({
      maxSizeBytes: 10 * 1024 * 1024,
      maxEntriesL1: 1000,
      evictionPolicy: 'lfu',
      defaultTtlSeconds: 3600,
      enableL2: false,
    });

    await cache.set('key1', 'value1');
    await cache.set('key2', 'value2');

    // Access key1 multiple times
    for (let i = 0; i < 5; i++) {
      await cache.get('key1');
    }

    // key2 accessed once
    await cache.get('key2');

    const stats = cache.getStats();

    expect(stats.hitsL1).toBe(6);
  });

  it('should handle complex objects', async () => {
    const complex = {
      nested: {
        array: [1, 2, 3],
        object: { a: 'b' },
      },
      timestamp: Date.now(),
    };

    await cache.set('complex', complex);

    const result = await cache.get('complex');

    expect(result).toEqual(complex);
  });
});
