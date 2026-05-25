import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from './api';

// Types
export type SubscriptionTier = 'free' | 'starter' | 'professional' | 'enterprise';
export type SubscriptionStatus = 'active' | 'trial' | 'past_due' | 'cancelled' | 'suspended';
export type BillingPeriod = 'monthly' | 'yearly';

export interface Subscription {
  id: string;
  user_id: string;
  organization_id?: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billing_period: BillingPeriod;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  stripe_subscription_id?: string;
  created_at: string;
  updated_at: string;
}

export interface UsageSummary {
  period_start: string;
  period_end: string;
  api_requests: { used: number; limit: number };
  workflow_executions: { used: number; limit: number };
  browser_sessions: { used: number; limit: number };
  agent_executions: { used: number; limit: number };
  document_processing: { used: number; limit: number };
  storage_gb: { used: number; limit: number };
}

export interface Invoice {
  id: string;
  subscription_id: string;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  invoice_url?: string;
  invoice_pdf?: string;
  period_start: string;
  period_end: string;
  created_at: string;
  paid_at?: string;
}

export interface PricingTier {
  tier: SubscriptionTier;
  name: string;
  description: string;
  monthly_price: number;
  yearly_price: number;
  features: string[];
  limits: {
    api_requests: number;
    workflow_executions: number;
    browser_sessions: number;
    agent_executions: number;
    document_processing: number;
    storage_gb: number;
  };
  highlighted?: boolean;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account';
  brand?: string;
  last4: string;
  exp_month?: number;
  exp_year?: number;
  is_default: boolean;
}

export interface CreateSubscriptionRequest {
  tier: SubscriptionTier;
  billing_period: BillingPeriod;
  payment_method_id?: string;
}

export interface UpdateSubscriptionRequest {
  tier?: SubscriptionTier;
  billing_period?: BillingPeriod;
}

// Pricing data
export const PRICING_TIERS: PricingTier[] = [
  {
    tier: 'free',
    name: 'Free',
    description: 'Get started with basic automation',
    monthly_price: 0,
    yearly_price: 0,
    features: [
      'Up to 100 API calls/month',
      '5 workflow executions/month',
      '2 browser sessions',
      'Basic support',
      'Community access',
    ],
    limits: {
      api_requests: 100,
      workflow_executions: 5,
      browser_sessions: 2,
      agent_executions: 10,
      document_processing: 5,
      storage_gb: 1,
    },
  },
  {
    tier: 'starter',
    name: 'Starter',
    description: 'For small teams getting started',
    monthly_price: 29,
    yearly_price: 290,
    features: [
      'Up to 5,000 API calls/month',
      '100 workflow executions/month',
      '10 browser sessions',
      'Email support',
      'Basic analytics',
      'API access',
    ],
    limits: {
      api_requests: 5000,
      workflow_executions: 100,
      browser_sessions: 10,
      agent_executions: 100,
      document_processing: 50,
      storage_gb: 10,
    },
  },
  {
    tier: 'professional',
    name: 'Professional',
    description: 'For growing businesses',
    monthly_price: 99,
    yearly_price: 990,
    highlighted: true,
    features: [
      'Up to 50,000 API calls/month',
      'Unlimited workflow executions',
      '50 browser sessions',
      'Priority support',
      'Advanced analytics',
      'Custom integrations',
      'SSO support',
    ],
    limits: {
      api_requests: 50000,
      workflow_executions: -1, // unlimited
      browser_sessions: 50,
      agent_executions: 1000,
      document_processing: 500,
      storage_gb: 100,
    },
  },
  {
    tier: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations',
    monthly_price: 499,
    yearly_price: 4990,
    features: [
      'Unlimited API calls',
      'Unlimited workflow executions',
      'Unlimited browser sessions',
      '24/7 dedicated support',
      'Custom analytics & reporting',
      'Custom integrations',
      'SSO & SAML',
      'SLA guarantee',
      'On-premise deployment option',
    ],
    limits: {
      api_requests: -1,
      workflow_executions: -1,
      browser_sessions: -1,
      agent_executions: -1,
      document_processing: -1,
      storage_gb: -1,
    },
  },
];

// API functions
export const fetchSubscription = async (): Promise<Subscription | null> => {
  try {
    const response = await api.get('/billing/subscription');
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

export const createSubscription = async (data: CreateSubscriptionRequest): Promise<Subscription> => {
  const response = await api.post('/billing/subscription', data);
  return response.data;
};

export const updateSubscription = async (data: UpdateSubscriptionRequest): Promise<Subscription> => {
  const response = await api.put('/billing/subscription', data);
  return response.data;
};

export const cancelSubscription = async (): Promise<Subscription> => {
  const response = await api.post('/billing/subscription/cancel');
  return response.data;
};

export const reactivateSubscription = async (): Promise<Subscription> => {
  const response = await api.post('/billing/subscription/reactivate');
  return response.data;
};

export const fetchUsageSummary = async (): Promise<UsageSummary> => {
  try {
    const response = await api.get('/billing/usage');
    return response.data;
  } catch {
    // Return default usage if endpoint not available
    return {
      period_start: new Date().toISOString(),
      period_end: new Date().toISOString(),
      api_requests: { used: 0, limit: 100 },
      workflow_executions: { used: 0, limit: 5 },
      browser_sessions: { used: 0, limit: 2 },
      agent_executions: { used: 0, limit: 10 },
      document_processing: { used: 0, limit: 5 },
      storage_gb: { used: 0, limit: 1 },
    };
  }
};

export const fetchInvoices = async (): Promise<Invoice[]> => {
  try {
    const response = await api.get('/billing/invoices');
    return response.data;
  } catch {
    return [];
  }
};

export const fetchPaymentMethods = async (): Promise<PaymentMethod[]> => {
  try {
    const response = await api.get('/billing/payment-methods');
    return response.data;
  } catch {
    return [];
  }
};

export const addPaymentMethod = async (paymentMethodId: string): Promise<PaymentMethod> => {
  const response = await api.post('/billing/payment-methods', { payment_method_id: paymentMethodId });
  return response.data;
};

export const removePaymentMethod = async (id: string): Promise<void> => {
  await api.delete(`/billing/payment-methods/${id}`);
};

export const setDefaultPaymentMethod = async (id: string): Promise<void> => {
  await api.post(`/billing/payment-methods/${id}/default`);
};

export const createCheckoutSession = async (tier: SubscriptionTier, billingPeriod: BillingPeriod): Promise<{ url: string }> => {
  const response = await api.post('/billing/checkout', { tier, billing_period: billingPeriod });
  return response.data;
};

export const createPortalSession = async (): Promise<{ url: string }> => {
  const response = await api.post('/billing/portal');
  return response.data;
};

// React Query hooks
export const useSubscription = () => {
  return useQuery('subscription', fetchSubscription, {
    staleTime: 60000, // 1 minute
  });
};

export const useCreateSubscription = () => {
  const queryClient = useQueryClient();
  
  return useMutation(createSubscription, {
    onSuccess: () => {
      queryClient.invalidateQueries('subscription');
      queryClient.invalidateQueries('usageSummary');
    },
  });
};

export const useUpdateSubscription = () => {
  const queryClient = useQueryClient();
  
  return useMutation(updateSubscription, {
    onSuccess: () => {
      queryClient.invalidateQueries('subscription');
    },
  });
};

export const useCancelSubscription = () => {
  const queryClient = useQueryClient();
  
  return useMutation(cancelSubscription, {
    onSuccess: () => {
      queryClient.invalidateQueries('subscription');
    },
  });
};

export const useUsageSummary = () => {
  return useQuery('usageSummary', fetchUsageSummary, {
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  });
};

export const useInvoices = () => {
  return useQuery('invoices', fetchInvoices, {
    staleTime: 60000,
  });
};

export const usePaymentMethods = () => {
  return useQuery('paymentMethods', fetchPaymentMethods, {
    staleTime: 60000,
  });
};

export const useCreateCheckoutSession = () => {
  return useMutation(
    ({ tier, billingPeriod }: { tier: SubscriptionTier; billingPeriod: BillingPeriod }) =>
      createCheckoutSession(tier, billingPeriod)
  );
};

export const useCreatePortalSession = () => {
  return useMutation(createPortalSession);
};

// Utility functions
export const getTierByName = (tier: SubscriptionTier): PricingTier | undefined => {
  return PRICING_TIERS.find(t => t.tier === tier);
};

export const formatPrice = (price: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(price);
};

export const getUsagePercentage = (used: number, limit: number): number => {
  if (limit === -1) return 0; // unlimited
  if (limit === 0) return 100;
  return Math.min((used / limit) * 100, 100);
};

export const isUsageNearLimit = (used: number, limit: number, threshold: number = 0.8): boolean => {
  if (limit === -1) return false; // unlimited
  return used / limit >= threshold;
};

