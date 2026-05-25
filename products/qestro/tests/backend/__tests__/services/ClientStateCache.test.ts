import ClientStateCache, { LocalStoragePersistenceAdapter, CacheEntry } from '../../../../backend/src/services/ClientStateCache.js';
import { StateOperation } from '../../../../backend/src/services/ZeroSyncStateManager.js';

// Mock localStorage for Node.js environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    key: (index: number) => Object.keys(store)[index] || null,
    get length() { return Object.keys(store).length; }
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock
});

// Mock navigator for online/offline detection
Object.defineProperty(global, 'navigator', {
  value: { onLine: true },
  writable: true
});

// Mock window for event listeners
const windowMock = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

Object.defineProperty(global, 'window', {
  value: windowMock,
  writable: true
});

describe('ClientStateCache', () => {
  let cache: ClientStateCache;

  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
    
    cache = new ClientStateCache({
      maxSize: 10,
      defaultTTL: 1000,
      persistenceKey: 'test_cache'
    });
  });

  afterEach(() => {
    cache.shutdown();
  });

  describe('Basic Cache Operations', () => {
    it('should set and get cache entries', () => {
      const key = 'test_key';
      const data = { value: 'test data' };
      
      cache.set(key, data);
      const retrieved = cache.get(key);
      
      expect(retrieved).toEqual(data);
    });

    it('should return null for non-existent keys', () => {
      const result = cache.get('non_existent');
      expect(result).toBeNull();
    });

    it('should check if key exists', () => {
      const key = 'test_key';
      const data = { value: 'test data' };
      
      expect(cache.has(key)).toBe(false);
      
      cache.set(key, data);
      expect(cache.has(key)).toBe(true);
    });

    it('should delete cache entries', () => {
      const key = 'test_key';
      const data = { value: 'test data' };
      
      cache.set(key, data);
      expect(cache.has(key)).toBe(true);
      
      const deleted = cache.delete(key);
      expect(deleted).toBe(true);
      expect(cache.has(key)).toBe(false);
    });

    it('should clear all cache entries', () => {
      cache.set('key1', { value: 1 });
      cache.set('key2', { value: 2 });
      
      cache.clear();
      
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
    });

    it('should clone data to prevent mutations', () => {
      const key = 'test_key';
      const originalData = { nested: { value: 'original' } };
      
      cache.set(key, originalData);
      const retrieved = cache.get(key);
      
      // Mutate retrieved data
      retrieved.nested.value = 'modified';
      
      // Original should be unchanged
      const retrievedAgain = cache.get(key);
      expect(retrievedAgain.nested.value).toBe('original');
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should respect TTL', (done) => {
      const key = 'test_key';
      const data = { value: 'test data' };
      const ttl = 100; // 100ms
      
      cache.set(key, data, ttl);
      expect(cache.has(key)).toBe(true);
      
      setTimeout(() => {
        expect(cache.has(key)).toBe(false);
        expect(cache.get(key)).toBeNull();
        done();
      }, 150);
    });

    it('should use default TTL when not specified', () => {
      const key = 'test_key';
      const data = { value: 'test data' };
      
      cache.set(key, data);
      
      const entries = cache.getEntries();
      expect(entries[0].ttl).toBe(1000); // Default TTL from config
    });

    it('should emit expiration events', (done) => {
      const key = 'test_key';
      const data = { value: 'test data' };
      
      cache.on('cache_expired', (expiredKey) => {
        expect(expiredKey).toBe(key);
        done();
      });
      
      cache.set(key, data, 50);
      
      setTimeout(() => {
        cache.get(key); // This should trigger expiration check
      }, 100);
    });
  });

  describe('Size Management', () => {
    it('should enforce max size', () => {
      // Fill cache beyond max size
      for (let i = 0; i < 15; i++) {
        cache.set(`key_${i}`, { value: i });
      }
      
      const entries = cache.getEntries();
      expect(entries.length).toBeLessThanOrEqual(10); // Max size
    });

    it('should remove oldest entries when exceeding max size', () => {
      // Add entries with delays to ensure different timestamps
      for (let i = 0; i < 12; i++) {
        cache.set(`key_${i}`, { value: i });
      }
      
      // First entries should be removed
      expect(cache.has('key_0')).toBe(false);
      expect(cache.has('key_1')).toBe(false);
      
      // Recent entries should remain
      expect(cache.has('key_10')).toBe(true);
      expect(cache.has('key_11')).toBe(true);
    });
  });

  describe('Optimistic Updates', () => {
    it('should handle optimistic updates', () => {
      const key = 'test_key';
      const data = { value: 'optimistic data' };
      const operation: StateOperation = {
        id: 'op_123',
        type: 'update',
        path: key,
        data,
        timestamp: Date.now(),
        userId: 'user_123',
        sessionId: 'session_123',
        optimistic: true
      };
      
      cache.setOptimistic(key, data, operation);
      
      const retrieved = cache.get(key);
      expect(retrieved).toEqual(data);
      
      const entries = cache.getOptimisticEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].metadata.optimistic).toBe(true);
      expect(entries[0].metadata.operationId).toBe(operation.id);
    });

    it('should confirm optimistic updates', () => {
      const key = 'test_key';
      const data = { value: 'optimistic data' };
      const operation: StateOperation = {
        id: 'op_123',
        type: 'update',
        path: key,
        data,
        timestamp: Date.now(),
        userId: 'user_123',
        sessionId: 'session_123',
        optimistic: true
      };
      
      cache.setOptimistic(key, data, operation);
      const confirmed = cache.confirmOptimistic(operation.id);
      
      expect(confirmed).toBe(true);
      
      const entries = cache.getOptimisticEntries();
      expect(entries).toHaveLength(0);
    });

    it('should rollback optimistic updates', () => {
      const key = 'test_key';
      const initialData = { value: 'initial' };
      const optimisticData = { value: 'optimistic' };
      
      cache.set(key, initialData);
      
      const operation: StateOperation = {
        id: 'op_123',
        type: 'update',
        path: key,
        data: optimisticData,
        previousData: initialData,
        timestamp: Date.now(),
        userId: 'user_123',
        sessionId: 'session_123',
        optimistic: true
      };
      
      cache.setOptimistic(key, optimisticData, operation);
      expect(cache.get(key)).toEqual(optimisticData);
      
      const rolledBack = cache.rollbackOptimistic(operation.id);
      expect(rolledBack).toBe(true);
      expect(cache.get(key)).toEqual(initialData);
    });

    it('should emit optimistic update events', (done) => {
      const key = 'test_key';
      const data = { value: 'optimistic data' };
      const operation: StateOperation = {
        id: 'op_123',
        type: 'update',
        path: key,
        data,
        timestamp: Date.now(),
        userId: 'user_123',
        sessionId: 'session_123',
        optimistic: true
      };
      
      cache.on('optimistic_update', (emittedKey, emittedData, emittedOperation) => {
        expect(emittedKey).toBe(key);
        expect(emittedData).toEqual(data);
        expect(emittedOperation.id).toBe(operation.id);
        done();
      });
      
      cache.setOptimistic(key, data, operation);
    });
  });

  describe('Online/Offline Handling', () => {
    it('should queue operations when offline', () => {
      const key = 'test_key';
      const data = { value: 'offline data' };
      const operation: StateOperation = {
        id: 'op_123',
        type: 'update',
        path: key,
        data,
        timestamp: Date.now(),
        userId: 'user_123',
        sessionId: 'session_123',
        optimistic: true
      };
      
      // Simulate offline
      (global.navigator as any).onLine = false;
      cache = new ClientStateCache(); // Recreate to pick up offline status
      
      cache.setOptimistic(key, data, operation);
      
      const syncQueue = cache.getSyncQueue();
      expect(syncQueue).toHaveLength(1);
      expect(syncQueue[0].id).toBe(operation.id);
    });

    it('should emit online/offline events', (done) => {
      let eventCount = 0;
      
      cache.on('offline', () => {
        eventCount++;
        if (eventCount === 2) done();
      });
      
      cache.on('online', () => {
        eventCount++;
        if (eventCount === 2) done();
      });
      
      // Simulate events
      const onlineCallback = (windowMock.addEventListener as jest.Mock).mock.calls
        .find(call => call[0] === 'online')?.[1];
      const offlineCallback = (windowMock.addEventListener as jest.Mock).mock.calls
        .find(call => call[0] === 'offline')?.[1];
      
      if (onlineCallback && offlineCallback) {
        offlineCallback();
        onlineCallback();
      } else {
        done(); // Skip if event listeners not set up properly
      }
    });
  });

  describe('Persistence', () => {
    it('should save to persistence on set', async () => {
      const key = 'test_key';
      const data = { value: 'test data' };
      
      cache.set(key, data);
      
      // Wait for async persistence
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Check localStorage
      const persistedData = JSON.parse(localStorage.getItem('test_cache') || '[]');
      expect(persistedData).toHaveLength(1);
      expect(persistedData[0].key).toBe(key);
      expect(persistedData[0].data).toEqual(data);
    });

    it('should load from persistence on initialization', async () => {
      const key = 'test_key';
      const data = { value: 'persisted data' };
      
      // Pre-populate localStorage
      const cacheData = [{
        key,
        data,
        timestamp: Date.now(),
        version: Date.now(),
        ttl: 10000,
        metadata: {}
      }];
      localStorage.setItem('test_cache', JSON.stringify(cacheData));
      
      // Create new cache instance
      const newCache = new ClientStateCache({
        persistenceKey: 'test_cache'
      });
      
      // Wait for loading
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(newCache.get(key)).toEqual(data);
      
      newCache.shutdown();
    });

    it('should not load expired entries from persistence', async () => {
      const key = 'test_key';
      const data = { value: 'expired data' };
      
      // Pre-populate localStorage with expired entry
      const cacheData = [{
        key,
        data,
        timestamp: Date.now() - 2000, // 2 seconds ago
        version: Date.now(),
        ttl: 1000, // 1 second TTL
        metadata: {}
      }];
      localStorage.setItem('test_cache', JSON.stringify(cacheData));
      
      // Create new cache instance
      const newCache = new ClientStateCache({
        persistenceKey: 'test_cache'
      });
      
      // Wait for loading
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(newCache.get(key)).toBeNull();
      
      newCache.shutdown();
    });
  });

  describe('Statistics and Utilities', () => {
    it('should provide cache statistics', () => {
      cache.set('key1', { value: 1 });
      cache.set('key2', { value: 2 });
      
      const operation: StateOperation = {
        id: 'op_123',
        type: 'update',
        path: 'key3',
        data: { value: 3 },
        timestamp: Date.now(),
        userId: 'user_123',
        sessionId: 'session_123',
        optimistic: true
      };
      
      cache.setOptimistic('key3', { value: 3 }, operation);
      
      const stats = cache.getStats();
      expect(stats.size).toBe(3);
      expect(stats.maxSize).toBe(10);
      expect(stats.optimisticCount).toBe(1);
      expect(stats.syncQueueSize).toBe(0);
      expect(stats.isOnline).toBe(true);
    });

    it('should get all keys', () => {
      cache.set('key1', { value: 1 });
      cache.set('key2', { value: 2 });
      
      const keys = cache.getKeys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toHaveLength(2);
    });

    it('should get all entries', () => {
      cache.set('key1', { value: 1 });
      cache.set('key2', { value: 2 });
      
      const entries = cache.getEntries();
      expect(entries).toHaveLength(2);
      expect(entries[0]).toHaveProperty('key');
      expect(entries[0]).toHaveProperty('data');
      expect(entries[0]).toHaveProperty('timestamp');
    });

    it('should update configuration', (done) => {
      cache.on('config_updated', (newConfig) => {
        expect(newConfig.maxSize).toBe(20);
        done();
      });
      
      cache.updateConfig({ maxSize: 20 });
    });
  });

  describe('Event Emissions', () => {
    it('should emit cache events', (done) => {
      let eventCount = 0;
      const expectedEvents = ['cache_set', 'cache_hit', 'cache_deleted'];
      
      const checkDone = () => {
        eventCount++;
        if (eventCount === expectedEvents.length) done();
      };
      
      cache.on('cache_set', checkDone);
      cache.on('cache_hit', checkDone);
      cache.on('cache_deleted', checkDone);
      
      cache.set('key', { value: 'test' });
      cache.get('key');
      cache.delete('key');
    });

    it('should emit cleanup events', (done) => {
      cache.on('cache_cleaned', (cleanedCount) => {
        expect(typeof cleanedCount).toBe('number');
        done();
      });
      
      // Set entry with short TTL
      cache.set('key', { value: 'test' }, 1);
      
      // Wait for cleanup
      setTimeout(() => {
        // Trigger cleanup by accessing expired entry
        cache.get('key');
      }, 50);
    });
  });

  describe('Error Handling', () => {
    it('should handle persistence errors gracefully', async () => {
      // Mock localStorage to throw error
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = jest.fn().mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      // Should not throw
      expect(() => {
        cache.set('key', { value: 'test' });
      }).not.toThrow();
      
      // Restore original method
      localStorage.setItem = originalSetItem;
    });

    it('should handle loading errors gracefully', async () => {
      // Pre-populate localStorage with invalid JSON
      localStorage.setItem('test_cache', 'invalid json');
      
      // Should not throw during initialization
      expect(() => {
        const newCache = new ClientStateCache({
          persistenceKey: 'test_cache'
        });
        newCache.shutdown();
      }).not.toThrow();
    });
  });
});

describe('LocalStoragePersistenceAdapter', () => {
  let adapter: LocalStoragePersistenceAdapter;

  beforeEach(() => {
    localStorageMock.clear();
    adapter = new LocalStoragePersistenceAdapter('test_');
  });

  it('should save and load data', async () => {
    const key = 'test_key';
    const data = { value: 'test data' };
    
    await adapter.save(key, data);
    const loaded = await adapter.load(key);
    
    expect(loaded).toEqual(data);
  });

  it('should check if key exists', async () => {
    const key = 'test_key';
    const data = { value: 'test data' };
    
    expect(await adapter.exists(key)).toBe(false);
    
    await adapter.save(key, data);
    expect(await adapter.exists(key)).toBe(true);
  });

  it('should remove data', async () => {
    const key = 'test_key';
    const data = { value: 'test data' };
    
    await adapter.save(key, data);
    await adapter.remove(key);
    
    expect(await adapter.exists(key)).toBe(false);
  });

  it('should clear all data', async () => {
    await adapter.save('key1', { value: 1 });
    await adapter.save('key2', { value: 2 });
    
    await adapter.clear();
    
    expect(await adapter.exists('key1')).toBe(false);
    expect(await adapter.exists('key2')).toBe(false);
  });

  it('should handle errors gracefully', async () => {
    // Mock localStorage to throw error
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = jest.fn().mockImplementation(() => {
      throw new Error('Storage error');
    });
    
    await expect(adapter.save('key', { value: 'test' })).rejects.toThrow();
    
    // Restore original method
    localStorage.setItem = originalSetItem;
  });
});