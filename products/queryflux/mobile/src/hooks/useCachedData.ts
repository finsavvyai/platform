import { useEffect, useState, useCallback } from 'react';
import { offlineManager } from '../services/offline';

interface UseCachedDataOptions {
  cacheKey: string;
  fetcher: () => Promise<any>;
  staleTime?: number; // milliseconds
  enabled?: boolean;
  retryCount?: number;
  onError?: (error: Error) => void;
  onSuccess?: (data: any) => void;
}

interface UseCachedDataResult<T> {
  data: T | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}

export const useCachedData = <T = any>({
  cacheKey,
  fetcher,
  staleTime = 5 * 60 * 1000, // 5 minutes
  enabled = true,
  retryCount = 3,
  onError,
  onSuccess,
}: UseCachedDataOptions): UseCachedDataResult<T> => {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastFetch, setLastFetch] = useState<number | null>(null);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!enabled) return;

    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      // Try to get cached data first
      if (!forceRefresh) {
        const cachedData = await offlineManager.getCachedData<{
          data: T;
          timestamp: number;
        }>(cacheKey);

        if (cachedData) {
          const age = Date.now() - cachedData.timestamp;
          if (age < staleTime) {
            setData(cachedData.data);
            setIsLoading(false);
            onSuccess?.(cachedData.data);
            return;
          }
        }
      }

      // Fetch fresh data
      const freshData = await fetcher();

      // Cache the data
      await offlineManager.cacheData(cacheKey, {
        data: freshData,
        timestamp: Date.now(),
      }, staleTime);

      setData(freshData);
      setLastFetch(Date.now());
      onSuccess?.(freshData);
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Unknown error');
      setError(errorObj);
      setIsError(true);
      onError?.(errorObj);
    } finally {
      setIsLoading(false);
    }
  }, [cacheKey, fetcher, staleTime, enabled, onError, onSuccess]);

  const refetch = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  const invalidate = useCallback(async () => {
    // Remove from cache and refetch
    try {
      const cacheKeyForDeletion = `cache_${cacheKey}`;
      await offlineManager.cache.delete(cacheKey);
      await refetch();
    } catch (error) {
      console.error('Failed to invalidate cache:', error);
    }
  }, [cacheKey, refetch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    isError,
    error,
    refetch,
    invalidate,
  };
};

// Hook for offline-aware queries with automatic queuing
export const useOfflineQuery = <T = any>({
  cacheKey,
  fetcher,
  queueWhenOffline = true,
  ...options
}: UseCachedDataOptions & { queueWhenOffline?: boolean }) => {
  const result = useCachedData<T>({ cacheKey, fetcher, ...options });

  const executeWithQueue = useCallback(async () => {
    try {
      // Try to fetch data
      await result.refetch();
    } catch (error) {
      // If offline and queuing is enabled, add to queue
      if (queueWhenOffline) {
        try {
          await offlineManager.queueOperation('query', {
            cacheKey,
            query: fetcher.toString(), // Simplified - in real app, this would be more complex
          }, 'normal');

          console.log('Query added to offline queue');
        } catch (queueError) {
          console.error('Failed to add query to queue:', queueError);
        }
      }
      throw error;
    }
  }, [result.refetch, queueWhenOffline, cacheKey, fetcher]);

  return {
    ...result,
    executeWithQueue,
  };
};