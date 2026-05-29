/**
 * Subscription Management Hook
 *
 * Provides subscription, billing, and feature gating functionality
 */

import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/enhanced-api-client';
import { SUBSCRIPTION_FEATURES, DEFAULT_PLANS } from './subscriptionPlans';
import { getLimitForMetric } from './subscriptionUtils';
import type {
  Subscription, SubscriptionPlan, UsageRecord,
  CreateCheckoutRequest, CreateCheckoutResponse,
  UpdateSubscriptionRequest, CancelSubscriptionRequest,
  UseSubscriptionManagementReturn,
} from './subscriptionTypes';

export type {
  Subscription, SubscriptionStatus, SubscriptionFeatures, SubscriptionPlan,
  UsageRecord, CreateCheckoutRequest, CreateCheckoutResponse,
  UpdateSubscriptionRequest, CancelSubscriptionRequest, UseSubscriptionManagementReturn,
} from './subscriptionTypes';
export { SUBSCRIPTION_FEATURES, DEFAULT_PLANS } from './subscriptionPlans';
export {
  getLimitForMetric, formatPrice, getPlanComparison, isActiveSubscription,
  getStatusColor, getStatusText, calculateSavings, getTrialDaysRemaining,
} from './subscriptionUtils';

// ============================================================================
// Hook Implementation
// ============================================================================

export function useSubscriptionManagement(teamId?: string): UseSubscriptionManagementReturn {
  const queryClient = useQueryClient();
  const [error, setError] = useState<Error | null>(null);

  const { data: subscription, isLoading: isLoadingSubscription } = useQuery({
    queryKey: ['subscription', teamId],
    queryFn: async () => {
      const endpoint = teamId ? `/api/v1/subscriptions/team/${teamId}` : '/api/v1/subscriptions/user';
      return apiClient.request<Subscription>('GET', endpoint);
    },
  });

  const featureAccess = useMemo<Record<string, boolean>>(() => {
    if (!subscription) return {};
    const f = (subscription as Subscription).features;
    const access: Record<string, boolean> = {
      [SUBSCRIPTION_FEATURES.AI_QUERIES]: f.aiQueriesEnabled,
      [SUBSCRIPTION_FEATURES.VOICE]: f.voiceEnabled,
      [SUBSCRIPTION_FEATURES.CODE_GENERATION]: f.codeGeneration,
      [SUBSCRIPTION_FEATURES.ADVANCED_ANALYTICS]: f.advancedAnalytics,
      [SUBSCRIPTION_FEATURES.PRIORITY_SUPPORT]: f.prioritySupport,
      [SUBSCRIPTION_FEATURES.CUSTOM_BRANDING]: f.customBranding,
      [SUBSCRIPTION_FEATURES.API_ACCESS]: f.apiAccess,
      [SUBSCRIPTION_FEATURES.SSO]: f.ssoEnabled,
    };
    return access;
  }, [subscription]);

  const { data: plans = DEFAULT_PLANS } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const response = await apiClient.request<SubscriptionPlan[]>('GET', '/api/v1/subscriptions/plans');
      return response;
    },
    initialData: DEFAULT_PLANS,
  });

  const { data: usage = [] } = useQuery({
    queryKey: ['subscription-usage', teamId],
    queryFn: async () => {
      const endpoint = teamId
        ? `/api/v1/subscriptions/team/${teamId}/usage`
        : '/api/v1/subscriptions/user/usage';
      const response = await apiClient.request<UsageRecord[]>('GET', endpoint);
      return response;
    },
    enabled: !!subscription,
  });

  const createCheckoutMutation = useMutation({
    mutationFn: async (request: CreateCheckoutRequest) => {
      const response = await apiClient.request<CreateCheckoutResponse>(
        'POST',
        '/api/v1/subscriptions/checkout',
        request
      );
      return response;
    },
    onSuccess: (data) => {
      // Redirect to checkout
      window.location.href = data.checkoutUrl;
    },
    onError: (err) => {
      setError(err instanceof Error ? err : new Error('Failed to create checkout'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (request: UpdateSubscriptionRequest) => {
      const response = await apiClient.request<Subscription>(
        'PUT',
        '/api/v1/subscriptions',
        request
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err : new Error('Failed to update subscription'));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (request: CancelSubscriptionRequest) => {
      await apiClient.request<void>(
        'POST',
        '/api/v1/subscriptions/cancel',
        request
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err : new Error('Failed to cancel subscription'));
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.request<Subscription>(
        'POST',
        '/api/v1/subscriptions/reactivate'
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err : new Error('Failed to reactivate subscription'));
    },
  });

  // Feature checks
  const hasFeatureAccess = useCallback((feature: string): boolean => {
    return featureAccess[feature] || false;
  }, [featureAccess]);

  const isOverLimit = useCallback((metric: string): boolean => {
    if (!subscription) return false;

    const currentUsage = usage.find(u => u.metric === metric)?.count || 0;
    const limit = getLimitForMetric(subscription.features, metric);

    return limit !== -1 && currentUsage >= limit;
  }, [subscription, usage]);

  const getRemainingQuota = useCallback((metric: string): number => {
    if (!subscription) return 0;

    const currentUsage = usage.find(u => u.metric === metric)?.count || 0;
    const limit = getLimitForMetric(subscription.features, metric);

    if (limit === -1) return -1; // unlimited
    return Math.max(0, limit - currentUsage);
  }, [subscription, usage]);

  return {
    // Subscription operations
    createCheckout: (request) => createCheckoutMutation.mutateAsync(request),
    updateSubscription: (request) => updateMutation.mutateAsync(request),
    cancelSubscription: (request) => cancelMutation.mutateAsync(request),
    reactivateSubscription: () => reactivateMutation.mutateAsync(),

    // Queries
    subscription: subscription || null,
    plans,
    usage,
    featureAccess,

    // Feature checks
    hasFeatureAccess,
    isOverLimit,
    getRemainingQuota,

    // State
    isLoading: isLoadingSubscription,
    isCreating: createCheckoutMutation.isPending,
    isUpdating: updateMutation.isPending,
    isCancelling: cancelMutation.isPending,
    error,
  };
}
