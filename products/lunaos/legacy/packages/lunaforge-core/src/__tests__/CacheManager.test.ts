/**
 * Tests for CacheManager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CacheManager } from '../cache/CacheManager';

describe('CacheManager', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    cacheManager = new CacheManager({
      memoryMaxSize: 1024 * 1024, // 1MB
      memoryMaxEntries: 100,
      defaultTTL: 1000 // 1 second
    });
  });

  afterEach(async () => {
    await cacheManager.clear();
  });

  describe('Basic Operations', () => {
    it('should store and retrieve values', async () => {
      await cacheManager.set('key1', 'value1');
      const result = await cacheManager.get('key1');
      expect(result).toBe('value1');
    });

    it('should return null for non-existent keys', async () => {
      const result = await cacheManager.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should delete values', async () => {
      await cacheManager.set('key1', 'value1');
      await cacheManager.delete('key1');
      const result = await cacheManager.get('key1');
      expect(result).toBeNull();
    });

    it('should clear all values', async () => {
      await cacheManager.set('key1', 'value1');
      await cacheManager.set('key2', 'value2');
      await cacheManager.clear();

      const result1 = await cacheManager.get('key1');
      const result2 = await cacheManager.get('key2');
      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should respect TTL expiration', async () => {
      await cacheManager.set('key1', 'value1', 100); // 100ms TTL

      // Should be available immediately
      let result = await cacheManager.get('key1');
      expect(result).toBe('value1');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      result = await cacheManager.get('key1');
      expect(result).toBeNull();
    });

    it('should use default TTL when not specified', async () => {
      await cacheManager.set('key1', 'value1');

      // Should be available immediately
      let result = await cacheManager.get('key1');
      expect(result).toBe('value1');

      // Wait for default TTL expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      result = await cacheManager.get('key1');
      expect(result).toBeNull();
    });
  });

  describe('Capacity Management', () => {
    it('should evict entries when memory limit is exceeded', async () => {
      // Create a large value that exceeds memory limit
      const largeValue = 'x'.repeat(2 * 1024 * 1024); // 2MB

      await cacheManager.set('key1', 'value1');
      await cacheManager.set('key2', largeValue); // This should trigger eviction

      // key1 should be evicted due to LRU
      const result1 = await cacheManager.get('key1');
      expect(result1).toBeNull();

      // key2 should be present
      const result2 = await cacheManager.get('key2');
      expect(result2).toBe(largeValue);
    });

    it('should evict entries when entry limit is exceeded', async () => {
      const smallCache = new CacheManager({
        memoryMaxEntries: 2
      });

      await smallCache.set('key1', 'value1');
      await smallCache.set('key2', 'value2');
      await smallCache.set('key3', 'value3'); // Should evict key1

      const result1 = await smallCache.get('key1');
      const result2 = await smallCache.get('key2');
      const result3 = await smallCache.get('key3');

      expect(result1).toBeNull(); // Evicted
      expect(result2).toBe('value2');
      expect(result3).toBe('value3');
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used entries', async () => {
      await cacheManager.set('key1', 'value1');
      await cacheManager.set('key2', 'value2');

      // Access key1 to make it most recently used
      await cacheManager.get('key1');

      // Add entry that triggers eviction
      await cacheManager.set('key3', 'value3');

      // key2 should be evicted (least recently used)
      const result1 = await cacheManager.get('key1');
      const result2 = await cacheManager.get('key2');
      const result3 = await cacheManager.get('key3');

      expect(result1).toBe('value1');
      expect(result2).toBeNull();
      expect(result3).toBe('value3');
    });
  });

  describe('Statistics', () => {
    it('should provide accurate statistics', async () => {
      await cacheManager.set('key1', 'value1');
      await cacheManager.set('key2', 'value2');

      const stats = cacheManager.getStats();

      expect(stats.entries).toBe(2);
      expect(stats.memoryUsage).toBeGreaterThan(0);
      expect(stats.maxEntries).toBe(100);
      expect(stats.maxSize).toBe(1024 * 1024);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup expired entries', async () => {
      await cacheManager.set('key1', 'value1', 50); // Short TTL
      await cacheManager.set('key2', 'value2', 200); // Longer TTL

      // Wait for first entry to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      await cacheManager.cleanup();

      const result1 = await cacheManager.get('key1');
      const result2 = await cacheManager.get('key2');

      expect(result1).toBeNull(); // Should be cleaned up
      expect(result2).toBe('value2'); // Should still be present
    });
  });

  describe('Complex Objects', () => {
    it('should handle complex objects', async () => {
      const complexObject = {
        nested: {
          array: [1, 2, 3],
          string: 'test'
        },
        number: 42
      };

      await cacheManager.set('complex', complexObject);
      const result = await cacheManager.get('complex');

      expect(result).toEqual(complexObject);
    });
  });
});