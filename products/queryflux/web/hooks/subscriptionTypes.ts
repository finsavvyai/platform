/**
 * Subscription Management — shared types
 */

export interface Subscription {
  id: string;
  lemonSqueezyId: string;
  customerId: string;
  teamId?: string;
  planId: string;
  planName: string;
  status: SubscriptionStatus;
  trialEndsAt?: string;
  renewsAt?: string;
  endsAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
  features: SubscriptionFeatures;
}

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'cancelled' | 'unpaid' | 'paused';

export interface SubscriptionFeatures {
  maxTeams: number;
  maxMembersPerTeam: number;
  maxConnections: number;
  maxQueriesPerMonth: number;
  maxStorageGB: number;
  aiQueriesEnabled: boolean;
  voiceEnabled: boolean;
  codeGeneration: boolean;
  advancedAnalytics: boolean;
  prioritySupport: boolean;
  customBranding: boolean;
  apiAccess: boolean;
  ssoEnabled: boolean;
  auditLogRetention: number;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  trialDays: number;
  features: SubscriptionFeatures;
  lemonSqueezyVariantId: string;
  lemonSqueezyProductId: string;
}

export interface UsageRecord {
  userId: string;
  teamId: string;
  metric: string;
  count: number;
  periodStart: string;
  periodEnd: string;
}

export interface CreateCheckoutRequest {
  variantId: string;
  customerEmail?: string;
  customerName?: string;
  teamId?: string;
  customData?: Record<string, string>;
  testMode?: boolean;
}

export interface CreateCheckoutResponse {
  checkoutUrl: string;
  checkoutId: string;
}

export interface UpdateSubscriptionRequest {
  planId: string;
  teamId?: string;
}

export interface CancelSubscriptionRequest {
  reason?: string;
}

export interface UseSubscriptionManagementReturn {
  createCheckout: (request: CreateCheckoutRequest) => Promise<CreateCheckoutResponse>;
  updateSubscription: (request: UpdateSubscriptionRequest) => Promise<Subscription>;
  cancelSubscription: (request: CancelSubscriptionRequest) => Promise<void>;
  reactivateSubscription: () => Promise<Subscription>;
  subscription: Subscription | null;
  plans: SubscriptionPlan[];
  usage: UsageRecord[];
  featureAccess: Record<string, boolean>;
  hasFeatureAccess: (feature: string) => boolean;
  isOverLimit: (metric: string) => boolean;
  getRemainingQuota: (metric: string) => number;
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isCancelling: boolean;
  error: Error | null;
}
