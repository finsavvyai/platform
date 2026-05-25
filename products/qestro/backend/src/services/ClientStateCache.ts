import { EventEmitter } from 'events';
import { StateOperation, StateSnapshot } from './ZeroSyncStateManager.js';

export interface CacheEntry {
  key: string;
  data: any;
  timestamp: number;
  version: number;
  ttl?: number;
  metadata: Record<string, any>;
}

export interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
  persistenceKey: string;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
}

export interface PersistenceAdapter {
  save(key: string, data: any): Promise<void>;
  load(key: string): Promise<any>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export class LocalStoragePersistenceAdapter implements PersistenceAdapter {
  private prefix: string;

  constructor(prefix: string = 'questro_cache_') {
    this.prefix = prefix;
  }

  async save(key: string, data: any): Promise<void> {
    try {
      const serialized = JSON.stringify(data);
      localStorage.setItem(this.prefix + key, serialized);
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
      throw error;
    }
  }

  async load(key: string): Promise<any> {
    try {
      const serialized = localStorage.getItem(this.prefix + key);
      return serialized ? JSON.parse(serialized) : null;
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
      return null;
    }
  }

  async remove(key: string): Promise<void> {
    localStorage.removeItem(this.prefix + key);
  }

  async clear(): Promise<void> {
    const keys = Object.keys(localStorage).filter(key => key.startsWith(this.prefix));
    keys.forEach(key => localStorage.removeItem(key));
  }

  async exists(key: string): Promise<boolean> {
    return localStorage.getItem(this.prefix + key) !== null;
  }
}

export class IndexedDBPersistenceAdapter implements PersistenceAdapter {
  private dbName: string;
  private storeName: string;
  private version: number;
  private db: IDBDatabase | null = null;

  constructor(dbName: string = 'QuestroCache', storeName: string = 'cache', version: number = 1) {
    this.dbName = dbName;
    this.storeName = storeName;
    this.version = version;
  }

  private async openDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'key' });
        }
      };
    });
  }

  async save(key: string, data: any): Promise<void> {
    const db = await this.openDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.put({ key, data, timestamp: Date.now() });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async load(key: string): Promise<any> {
    const db = await this.openDB();
    const transaction = db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.data : null);
      };
    });
  }

  async remove(key: string): Promise<void> {
    const db = await this.openDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clear(): Promise<void> {
    const db = await this.openDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async exists(key: string): Promise<boolean> {
    const data = await this.load(key);
    return data !== null;
  }
}

export class ClientStateCache extends EventEmitter {
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;
  private persistenceAdapter: PersistenceAdapter;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private syncQueue: StateOperation[] = [];
  private isOnline: boolean = true;

  constructor(config: Partial<CacheConfig> = {}, persistenceAdapter?: PersistenceAdapter) {
    super();
    
    this.config = {
      maxSize: 1000,
      defaultTTL: 24 * 60 * 60 * 1000, // 24 hours
      persistenceKey: 'questro_state_cache',
      compressionEnabled: false,
      encryptionEnabled: false,
      ...config
    };

    this.persistenceAdapter = persistenceAdapter || new LocalStoragePersistenceAdapter();
    
    this.setupCleanup();
    this.setupOnlineDetection();
    this.loadFromPersistence();
  }

  private setupCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Cleanup every minute
  }

  private setupOnlineDetection(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.emit('online');
        this.processSyncQueue();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.emit('offline');
      });

      this.isOnline = navigator.onLine;
    }
  }

  private async loadFromPersistence(): Promise<void> {
    try {
      const persistedData = await this.persistenceAdapter.load(this.config.persistenceKey);
      if (persistedData && Array.isArray(persistedData)) {
        persistedData.forEach((entry: CacheEntry) => {
          // Check if entry is still valid
          if (!entry.ttl || Date.now() - entry.timestamp < entry.ttl) {
            this.cache.set(entry.key, entry);
          }
        });
        this.emit('cache_loaded', this.cache.size);
      }
    } catch (error) {
      console.error('Failed to load cache from persistence:', error);
    }
  }

  private async saveToPersistence(): Promise<void> {
    try {
      const cacheArray = Array.from(this.cache.values());
      await this.persistenceAdapter.save(this.config.persistenceKey, cacheArray);
    } catch (error) {
      console.error('Failed to save cache to persistence:', error);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (entry.ttl && now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => {
      this.cache.delete(key);
    });

    // Enforce max size
    if (this.cache.size > this.config.maxSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, this.cache.size - this.config.maxSize);
      toRemove.forEach(([key]) => {
        this.cache.delete(key);
      });
    }

    if (keysToDelete.length > 0) {
      this.emit('cache_cleaned', keysToDelete.length);
      this.saveToPersistence();
    }
  }

  // Cache operations

  public set(key: string, data: any, ttl?: number, metadata: Record<string, any> = {}): void {
    const entry: CacheEntry = {
      key,
      data: this.cloneData(data),
      timestamp: Date.now(),
      version: Date.now(),
      ttl: ttl || this.config.defaultTTL,
      metadata
    };

    this.cache.set(key, entry);
    this.emit('cache_set', key, data);
    
    // Async save to persistence
    this.saveToPersistence().catch(error => {
      console.error('Failed to persist cache entry:', error);
    });
  }

  public get(key: string): any {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check TTL
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.emit('cache_expired', key);
      return null;
    }

    this.emit('cache_hit', key);
    return this.cloneData(entry.data);
  }

  public has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // Check TTL
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  public delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.emit('cache_deleted', key);
      this.saveToPersistence().catch(error => {
        console.error('Failed to persist cache deletion:', error);
      });
    }
    return deleted;
  }

  public clear(): void {
    this.cache.clear();
    this.emit('cache_cleared');
    this.saveToPersistence().catch(error => {
      console.error('Failed to persist cache clear:', error);
    });
  }

  // Optimistic updates

  public setOptimistic(key: string, data: any, operation: StateOperation): void {
    const entry: CacheEntry = {
      key,
      data: this.cloneData(data),
      timestamp: Date.now(),
      version: operation.timestamp,
      ttl: this.config.defaultTTL,
      metadata: {
        optimistic: true,
        operationId: operation.id,
        operation
      }
    };

    this.cache.set(key, entry);
    this.emit('optimistic_update', key, data, operation);

    // Queue for sync when online
    if (!this.isOnline) {
      this.syncQueue.push(operation);
    }
  }

  public confirmOptimistic(operationId: string): boolean {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.metadata.optimistic && entry.metadata.operationId === operationId) {
        entry.metadata.optimistic = false;
        delete entry.metadata.operationId;
        delete entry.metadata.operation;
        
        this.emit('optimistic_confirmed', key, operationId);
        this.saveToPersistence();
        return true;
      }
    }
    return false;
  }

  public rollbackOptimistic(operationId: string): boolean {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.metadata.optimistic && entry.metadata.operationId === operationId) {
        const operation = entry.metadata.operation as StateOperation;
        
        if (operation.previousData !== undefined) {
          this.set(key, operation.previousData);
        } else {
          this.delete(key);
        }
        
        this.emit('optimistic_rolled_back', key, operationId);
        return true;
      }
    }
    return false;
  }

  // Sync queue management

  private async processSyncQueue(): Promise<void> {
    if (!this.isOnline || this.syncQueue.length === 0) {
      return;
    }

    const operations = [...this.syncQueue];
    this.syncQueue = [];

    for (const operation of operations) {
      try {
        await this.syncOperation(operation);
        this.emit('operation_synced', operation);
      } catch (error) {
        console.error('Failed to sync operation:', error);
        // Re-queue failed operations
        this.syncQueue.push(operation);
      }
    }
  }

  private async syncOperation(operation: StateOperation): Promise<void> {
    // This would typically send the operation to the server
    // For now, we'll just emit an event
    this.emit('sync_required', operation);
  }

  // Utility methods

  private cloneData(data: any): any {
    if (data === null || typeof data !== 'object') {
      return data;
    }
    
    try {
      return JSON.parse(JSON.stringify(data));
    } catch (error) {
      console.error('Failed to clone data:', error);
      return data;
    }
  }

  public getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    optimisticCount: number;
    syncQueueSize: number;
    isOnline: boolean;
  } {
    const optimisticCount = Array.from(this.cache.values())
      .filter(entry => entry.metadata.optimistic).length;

    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitRate: 0, // Would need to track hits/misses
      optimisticCount,
      syncQueueSize: this.syncQueue.length,
      isOnline: this.isOnline
    };
  }

  public getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  public getEntries(): CacheEntry[] {
    return Array.from(this.cache.values());
  }

  public getOptimisticEntries(): CacheEntry[] {
    return Array.from(this.cache.values())
      .filter(entry => entry.metadata.optimistic);
  }

  public getSyncQueue(): StateOperation[] {
    return [...this.syncQueue];
  }

  public updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('config_updated', this.config);
  }

  public shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.saveToPersistence().catch(error => {
      console.error('Failed to save cache on shutdown:', error);
    });
    
    this.removeAllListeners();
  }
}

export default ClientStateCache;