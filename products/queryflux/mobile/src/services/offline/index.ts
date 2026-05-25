// Offline services exports
export { SyncService, syncService } from './SyncService';
export { CacheService, cacheService } from './CacheService';
export { OfflineQueueService, offlineQueueService } from './OfflineQueueService';

// Combined offline manager
import { SyncService } from './SyncService';
import { CacheService } from './CacheService';
import { OfflineQueueService } from './OfflineQueueService';
import NetInfo from '@react-native-netinfo/netinfo';

interface OfflineManagerConfig {
  sync?: Partial<SyncService['config']>;
  cache?: Partial<CacheService['config']>;
  queue?: Partial<OfflineQueueService['config']>;
}

export class OfflineManager {
  private syncService: SyncService;
  private cacheService: CacheService;
  private queueService: OfflineQueueService;
  private initialized: boolean = false;

  constructor(config: OfflineManagerConfig = {}) {
    this.syncService = new SyncService(config.sync);
    this.cacheService = new CacheService(config.cache);
    this.queueService = new OfflineQueueService(config.queue);
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      console.log('Initializing Offline Manager...');

      // Test AsyncStorage availability
      await this.testStorage();

      this.initialized = true;
      console.log('Offline Manager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Offline Manager:', error);
      throw error;
    }
  }

  private async testStorage(): Promise<void> {
    const testKey = 'offline_manager_test';
    const testValue = { timestamp: Date.now() };

    await AsyncStorage.setItem(testKey, JSON.stringify(testValue));
    const stored = await AsyncStorage.getItem(testKey);
    const parsed = stored ? JSON.parse(stored) : null;

    if (!parsed || parsed.timestamp !== testValue.timestamp) {
      throw new Error('AsyncStorage test failed');
    }

    await AsyncStorage.removeItem(testKey);
  }

  // Getters for services
  public get sync() {
    return this.syncService;
  }

  public get cache() {
    return this.cacheService;
  }

  public get queue() {
    return this.queueService;
  }

  // Convenience methods
  public async cacheData<T>(key: string, data: T, maxAge?: number): Promise<void> {
    return this.cacheService.set(key, data, maxAge);
  }

  public async getCachedData<T>(key: string): Promise<T | null> {
    return this.cacheService.get<T>(key);
  }

  public async queueOperation(
    type: 'query' | 'alert_acknowledgment' | 'alert_resolution' | 'connection_update',
    data: any,
    priority?: 'low' | 'normal' | 'high' | 'critical'
  ): Promise<string> {
    return this.queueService.enqueue(type, data, priority);
  }

  public async syncNow(): Promise<boolean> {
    return this.syncService.syncPendingOperations();
  }

  public async getOfflineStatus() {
    const networkState = await NetInfo.fetch();
    const [syncStatus, queueStats, cacheStats] = await Promise.all([
      this.syncService.getSyncStatus(),
      this.queueService.getQueueStats(),
      this.cacheService.getStats(),
    ]);

    return {
      isOnline: networkState.isConnected && networkState.isInternetReachable,
      connectionType: networkState.type,
      sync: syncStatus,
      queue: queueStats,
      cache: cacheStats,
    };
  }

  public async clearAllOfflineData(): Promise<void> {
    await Promise.all([
      this.syncService.clearPendingOperations(),
      this.cacheService.clear(),
      this.queueService.clearQueue(),
    ]);

    console.log('All offline data cleared');
  }

  public cleanup(): void {
    this.syncService.cleanup();
    this.cacheService.cleanup();
    this.queueService.cleanup();
    this.initialized = false;
  }
}

// Global offline manager instance
export const offlineManager = new OfflineManager();