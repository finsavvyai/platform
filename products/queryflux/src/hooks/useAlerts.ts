/**
 * Alerts Hook
 *
 * Manages alert state with React Query
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, queryKeys } from '../services/enhanced-api-services';

// ============================================================================
// Types
// ============================================================================

export interface Alert {
  id: string;
  userID: string;
  connectionID: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  threshold: number;
  currentValue: number;
  status: 'active' | 'resolved' | 'muted';
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  mutedAt?: string;
}

export interface AlertFilters {
  severity?: string;
  status?: string;
  connectionId?: string;
  page?: number;
  pageSize?: number;
}

export interface AlertStats {
  total: number;
  active: number;
  resolved: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Get all alerts with optional filters
 */
export function useAlerts(filters?: AlertFilters) {
  const queryClient = useQueryClient();

  const {
    data: alerts = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.alerts.list(filters || {}),
    queryFn: () => api.alerts.getAll(filters),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (alertId: string) => api.alerts.acknowledge(alertId),
    onSuccess: async (_, alertId) => {
      // Invalidate specific alert and list
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.alerts.detail(alertId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.alerts.lists() }),
      ]);
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (alertId: string) => api.alerts.resolve(alertId),
    onSuccess: async (_, alertId) => {
      // Invalidate specific alert and list
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.alerts.detail(alertId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.alerts.lists() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.alerts.active() }),
      ]);
    },
  });

  const muteMutation = useMutation({
    mutationFn: ({ alertId, durationHours }: { alertId: string; durationHours?: number }) =>
      api.alerts.mute(alertId, durationHours),
    onSuccess: async (_, variables) => {
      // Invalidate specific alert and list
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.alerts.detail(variables.alertId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.alerts.lists() }),
      ]);
    },
  });

  return {
    alerts,
    isLoading,
    error,

    // Mutations
    acknowledgeAlert: acknowledgeMutation.mutateAsync,
    resolveAlert: resolveMutation.mutateAsync,
    muteAlert: muteMutation.mutateAsync,

    // Mutation states
    isAcknowledging: acknowledgeMutation.isPending,
    isResolving: resolveMutation.isPending,
    isMuting: muteMutation.isPending,

    // Mutation errors
    acknowledgeError: acknowledgeMutation.error,
    resolveError: resolveMutation.error,
    muteError: muteMutation.error,
  };
}

/**
 * Get active alerts only
 */
export function useActiveAlerts() {
  const {
    data: activeAlerts = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.alerts.active(),
    queryFn: () => api.alerts.getActive(),
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });

  const { resolveAlert, muteAlert } = useAlerts();

  return {
    activeAlerts,
    isLoading,
    error,
    resolveAlert,
    muteAlert,
  };
}

/**
 * Alert count by severity for dashboard
 */
export function useAlertCounts() {
  const { alerts } = useAlerts();

  const counts = {
    total: alerts.length,
    active: alerts.filter((a) => a.status === 'active').length,
    resolved: alerts.filter((a) => a.status === 'resolved').length,
    muted: alerts.filter((a) => a.status === 'muted').length,
    critical: alerts.filter((a) => a.severity === 'critical' && a.status === 'active').length,
    high: alerts.filter((a) => a.severity === 'high' && a.status === 'active').length,
    medium: alerts.filter((a) => a.severity === 'medium' && a.status === 'active').length,
    low: alerts.filter((a) => a.severity === 'low' && a.status === 'active').length,
  };

  return counts;
}
