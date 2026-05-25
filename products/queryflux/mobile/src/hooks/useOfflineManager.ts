import { useEffect, useState } from 'react';
import NetInfo from '@react-native-netinfo/netinfo';
import { offlineManager } from '../services/offline';

export interface OfflineStatus {
  isOnline: boolean;
  connectionType: string | null;
  sync: {
    isSyncing: boolean;
    pendingOperationsCount: number;
    lastSync: string | null;
  };
  queue: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    isProcessing: boolean;
  };
  cache: {
    totalSize: number;
    entryCount: number;
    hitCount: number;
    missCount: number;
    oldestEntry?: string;
    newestEntry?: string;
  };
}

const useOfflineManager = () => {
  const [status, setStatus] = useState<OfflineStatus | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeOffline = async () => {
      try {
        await offlineManager.initialize();
        setIsInitialized(true);

        // Get initial status
        const initialStatus = await offlineManager.getOfflineStatus();
        setStatus(initialStatus);

        // Set up status updates
        const interval = setInterval(async () => {
          try {
            const currentStatus = await offlineManager.getOfflineStatus();
            setStatus(currentStatus);
          } catch (error) {
            console.error('Failed to update offline status:', error);
          }
        }, 5000); // Update every 5 seconds

        // Set up network change listener
        const unsubscribe = NetInfo.addEventListener(async (state) => {
          const currentStatus = await offlineManager.getOfflineStatus();
          setStatus(currentStatus);
        });

        return () => {
          clearInterval(interval);
          unsubscribe();
        };
      } catch (error) {
        console.error('Failed to initialize offline manager:', error);
        setIsInitialized(false);
      }
    };

    initializeOffline();
  }, []);

  const syncNow = async (): Promise<boolean> => {
    try {
      const result = await offlineManager.syncNow();
      // Update status after sync
      const currentStatus = await offlineManager.getOfflineStatus();
      setStatus(currentStatus);
      return result;
    } catch (error) {
      console.error('Failed to sync:', error);
      return false;
    }
  };

  const clearAllData = async (): Promise<void> => {
    try {
      await offlineManager.clearAllOfflineData();
      // Update status after clearing
      const currentStatus = await offlineManager.getOfflineStatus();
      setStatus(currentStatus);
    } catch (error) {
      console.error('Failed to clear offline data:', error);
    }
  };

  const cacheData = async <T>(key: string, data: T, maxAge?: number): Promise<void> => {
    return offlineManager.cacheData(key, data, maxAge);
  };

  const getCachedData = async <T>(key: string): Promise<T | null> => {
    return offlineManager.getCachedData<T>(key);
  };

  const queueOperation = async (
    type: 'query' | 'alert_acknowledgment' | 'alert_resolution' | 'connection_update',
    data: any,
    priority?: 'low' | 'normal' | 'high' | 'critical'
  ): Promise<string> => {
    return offlineManager.queueOperation(type, data, priority);
  };

  return {
    status,
    isInitialized,
    syncNow,
    clearAllData,
    cacheData,
    getCachedData,
    queueOperation,
  };
};

export default useOfflineManager;