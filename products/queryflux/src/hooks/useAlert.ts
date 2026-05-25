/**
 * Single Alert + Stats + Batch Hooks
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, queryKeys } from '../services/enhanced-api-services';

/**
 * Get single alert by ID
 */
export function useAlert(id: string) {
  const queryClient = useQueryClient();

  const {
    data: alert,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.alerts.detail(id),
    queryFn: () => api.alerts.getById(id),
    enabled: !!id,
    staleTime: 60 * 1000, // 1 minute
  });

  const resolveMutation = useMutation({
    mutationFn: () => api.alerts.resolve(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.alerts.detail(id) });
    },
  });

  const muteMutation = useMutation({
    mutationFn: (durationHours?: number) => api.alerts.mute(id, durationHours),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.alerts.detail(id) });
    },
  });

  return {
    alert,
    isLoading,
    error,
    resolveAlert: () => resolveMutation.mutate(),
    muteAlert: (durationHours?: number) => muteMutation.mutate(durationHours),
    isResolving: resolveMutation.isPending,
    isMuting: muteMutation.isPending,
    resolveError: resolveMutation.error,
    muteError: muteMutation.error,
  };
}

/**
 * Get alert statistics
 */
export function useAlertStats(days: number = 7) {
  const {
    data: stats,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.alerts.stats(days),
    queryFn: () => api.alerts.getStats(days),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  return { stats, isLoading, error };
}

/**
 * Batch operations on alerts
 */
export function useBatchAlertOperations() {
  const queryClient = useQueryClient();

  const batchResolveMutation = useMutation({
    mutationFn: async (alertIds: string[]) => {
      const results = await Promise.allSettled(
        alertIds.map((id) => api.alerts.resolve(id))
      );
      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length > 0) {
        throw new Error(`${failures.length} alerts failed to resolve`);
      }
      return results;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.alerts.active() });
    },
  });

  return {
    batchResolve: batchResolveMutation.mutateAsync,
    isBatchResolving: batchResolveMutation.isPending,
    batchResolveError: batchResolveMutation.error,
  };
}
