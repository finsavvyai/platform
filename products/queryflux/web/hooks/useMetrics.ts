/**
 * Metrics Hook
 *
 * Manages database metrics state with React Query
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, queryKeys } from '../services/enhanced-api-services';
import type { DatabaseMetrics, MetricsTimeRange } from './metricsTypes';

// Re-export types for backward compatibility
export type { DatabaseMetrics, MetricsTimeRange };

type DashboardMetricsMap = Record<string, DatabaseMetrics | null>;

// ============================================================================
// Hooks
// ============================================================================

/**
 * Get latest metrics for a connection
 */
export function useLatestMetrics(connectionId: string) {
  const {
    data: metrics,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.metrics.latest(connectionId),
    queryFn: () => api.metrics.getLatest(connectionId),
    enabled: !!connectionId,
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
    staleTime: 10 * 1000, // Consider data stale after 10 seconds
  });

  return {
    metrics,
    isLoading,
    error,
  };
}

/**
 * Get metrics history for a connection
 */
export function useMetricsHistory(
  connectionId: string,
  timeRange: MetricsTimeRange,
  options?: {
    limit?: number;
    offset?: number;
    enabled?: boolean;
  }
) {
  const {
    data: history = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.metrics.history(connectionId, JSON.stringify(timeRange)),
    queryFn: () =>
      api.metrics.getHistory(
        connectionId,
        timeRange.startTime,
        timeRange.endTime,
        options?.limit,
        options?.offset
      ),
    enabled: !!connectionId && (options?.enabled !== false),
    staleTime: 60 * 1000, // 1 minute
  });

  return {
    history,
    isLoading,
    error,
  };
}

/**
 * Get average metrics for a connection
 */
export function useAverageMetrics(
  connectionId: string,
  timeRange: MetricsTimeRange
) {
  const {
    data: averageMetrics,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.metrics.average(connectionId, JSON.stringify(timeRange)),
    queryFn: () =>
      api.metrics.getAverage(connectionId, timeRange.startTime, timeRange.endTime),
    enabled: !!connectionId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    averageMetrics,
    isLoading,
    error,
  };
}

/**
 * Monitoring control hook
 */
export function useMetricsMonitoring(connectionId: string) {
  const queryClient = useQueryClient();

  const startMutation = useMutation({
    mutationFn: (intervalSeconds: number) =>
      api.metrics.startMonitoring(connectionId, intervalSeconds),
    onSuccess: async () => {
      // Invalidate metrics to trigger immediate refetch
      await queryClient.invalidateQueries({
        queryKey: queryKeys.metrics.latest(connectionId),
      });
    },
  });

  const stopMutation = useMutation({
    mutationFn: () => api.metrics.stopMonitoring(connectionId),
  });

  const collectMutation = useMutation({
    mutationFn: () => api.metrics.collect(connectionId),
    onSuccess: async () => {
      // Invalidate metrics to show new data
      await queryClient.invalidateQueries({
        queryKey: queryKeys.metrics.latest(connectionId),
      });
    },
  });

  return {
    startMonitoring: startMutation.mutateAsync,
    stopMonitoring: () => stopMutation.mutate(),
    collectMetrics: () => collectMutation.mutate(),

    isStarting: startMutation.isPending,
    isStopping: stopMutation.isPending,
    isCollecting: collectMutation.isPending,

    startError: startMutation.error,
    stopError: stopMutation.error,
    collectError: collectMutation.error,
  };
}

/**
 * Aggregated metrics hook for dashboard
 */
export function useDashboardMetrics(connectionIds: string[]) {
  const connectionIdsParam = connectionIds.join(',');

  const {
    data: metricsMap = {},
    isLoading,
    error,
  } = useQuery({
    queryKey: ['metrics', 'dashboard', connectionIdsParam],
    queryFn: async (): Promise<DashboardMetricsMap> => {
      const promises = connectionIds.map(async (connectionId) => {
        try {
          const metrics = await api.metrics.getLatest(connectionId);
          return { [connectionId]: metrics };
        } catch (error) {
          console.error(`Failed to fetch metrics for ${connectionId}:`, error);
          return { [connectionId]: null };
        }
      });

      const results = await Promise.all(promises);
      return results.reduce<DashboardMetricsMap>(
        (acc, result) => ({ ...acc, ...result }),
        {}
      );
    },
    enabled: connectionIds.length > 0,
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
    staleTime: 10 * 1000,
  });

  return {
    metricsMap,
    isLoading,
    error,
  };
}
