import { Platform } from 'react-native';
import NetInfo from '@react-native-netinfo/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'connection' | 'query' | 'alert' | 'metric' | 'user';
  data: any;
  timestamp: string;
  retryCount: number;
  lastRetry?: string;
  error?: string;
}

interface SyncConfig {
  maxRetries: number;
  retryDelay: number;
  batchSize: number;
  syncInterval: number;
  offlineStorageLimit: number; // MB
}

const DEFAULT_CONFIG: SyncConfig = {
  maxRetries: 3,
  retryDelay: 5000, // 5 seconds
  batchSize: 10,
  syncInterval: 30000, // 30 seconds
  offlineStorageLimit: 50, // 50MB
};

export class SyncService {
  private config: SyncConfig;
  private isSyncing: boolean = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private listeners: Set<() => void> = new Set();

  constructor(config: Partial<SyncConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initialize();
  }

  private initialize = async () => {
    // Start periodic sync when online
    this.startPeriodicSync();

    // Listen for network state changes
    NetInfo.addEventListener(this.handleNetworkChange);

    // Clean up on app close (handled by React Native lifecycle)
  };

  private handleNetworkChange = (state: any) => {
    if (state.isConnected && state.isInternetReachable) {
      // Network restored, trigger sync
      this.syncPendingOperations();
    }
  };

  private startPeriodicSync = () => {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      this.syncPendingOperations();
    }, this.config.syncInterval);
  };

  public addSyncOperation = async (operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<string> => {
    const syncOp: SyncOperation = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      retryCount: 0,
      ...operation,
    };

    try {
      // Get existing operations
      const existingOps = await this.getPendingOperations();
      const updatedOps = [...existingOps, syncOp];

      // Check storage limit
      await this.checkStorageLimit(updatedOps);

      // Save operation
      await AsyncStorage.setItem('sync_operations', JSON.stringify(updatedOps));

      this.notifyListeners();

      // If online, try to sync immediately
      const networkState = await NetInfo.fetch();
      if (networkState.isConnected && networkState.isInternetReachable) {
        this.syncPendingOperations();
      }

      return syncOp.id;
    } catch (error) {
      console.error('Failed to add sync operation:', error);
      throw error;
    }
  };

  public getPendingOperations = async (): Promise<SyncOperation[]> => {
    try {
      const opsJson = await AsyncStorage.getItem('sync_operations');
      return opsJson ? JSON.parse(opsJson) : [];
    } catch (error) {
      console.error('Failed to get pending operations:', error);
      return [];
    }
  };

  public syncPendingOperations = async (): Promise<boolean> => {
    if (this.isSyncing) {
      return false;
    }

    const networkState = await NetInfo.fetch();
    if (!networkState.isConnected || !networkState.isInternetReachable) {
      return false;
    }

    this.isSyncing = true;

    try {
      const pendingOps = await this.getPendingOperations();

      if (pendingOps.length === 0) {
        return true;
      }

      // Process operations in batches
      const batches = this.chunkArray(pendingOps, this.config.batchSize);
      let failedOps: SyncOperation[] = [];

      for (const batch of batches) {
        const batchResult = await this.processBatch(batch);
        failedOps = [...failedOps, ...batchResult.failed];
      }

      // Update remaining operations
      await AsyncStorage.setItem('sync_operations', JSON.stringify(failedOps));

      // Notify listeners
      this.notifyListeners();

      return failedOps.length === 0;
    } catch (error) {
      console.error('Sync failed:', error);
      return false;
    } finally {
      this.isSyncing = false;
    }
  };

  private processBatch = async (batch: SyncOperation[]): Promise<{ success: SyncOperation[], failed: SyncOperation[] }> => {
    const success: SyncOperation[] = [];
    const failed: SyncOperation[] = [];

    for (const op of batch) {
      try {
        const result = await this.executeSyncOperation(op);
        if (result.success) {
          success.push(op);
        } else {
          failed.push({ ...op, error: result.error, retryCount: op.retryCount + 1 });
        }
      } catch (error) {
        const updatedOp = {
          ...op,
          retryCount: op.retryCount + 1,
          lastRetry: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        failed.push(updatedOp);
      }
    }

    return { success, failed };
  };

  private executeSyncOperation = async (operation: SyncOperation): Promise<{ success: boolean; error?: string }> => {
    // Simulate API call - replace with actual implementation
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    // Simulate occasional failures for retry mechanism testing
    if (Math.random() < 0.1 && operation.retryCount < this.config.maxRetries) {
      throw new Error('Simulated network error');
    }

    // Here you would make actual API calls based on operation type and entity
    switch (operation.type) {
      case 'create':
        console.log(`Creating ${operation.entity}:`, operation.data);
        break;
      case 'update':
        console.log(`Updating ${operation.entity}:`, operation.data);
        break;
      case 'delete':
        console.log(`Deleting ${operation.entity}:`, operation.data);
        break;
    }

    return { success: true };
  };

  private checkStorageLimit = async (operations: SyncOperation[]) => {
    // Calculate approximate size of operations
    const opsSize = JSON.stringify(operations).length;
    const sizeInMB = opsSize / (1024 * 1024);

    if (sizeInMB > this.config.offlineStorageLimit) {
      // Remove oldest operations
      const sortedOps = operations.sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      const opsToKeep = sortedOps.slice(-100); // Keep last 100 operations
      await AsyncStorage.setItem('sync_operations', JSON.stringify(opsToKeep));
    }
  };

  private chunkArray = <T,>(array: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  };

  public clearPendingOperations = async (): Promise<void> => {
    await AsyncStorage.removeItem('sync_operations');
    this.notifyListeners();
  };

  public getSyncStatus = async () => {
    const pendingOps = await this.getPendingOperations();
    const networkState = await NetInfo.fetch();

    return {
      isOnline: networkState.isConnected && networkState.isInternetReachable,
      isSyncing: this.isSyncing,
      pendingOperationsCount: pendingOps.length,
      lastSync: await AsyncStorage.getItem('last_sync_timestamp'),
      config: this.config,
    };
  };

  public subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notifyListeners = () => {
    this.listeners.forEach(listener => listener());
  };

  public cleanup = () => {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    this.listeners.clear();
  };
}

// Global sync service instance
export const syncService = new SyncService();