/**
 * Billing-related TypeScript types for Stripe integration
 */

export type SubscriptionPlan = 'free' | 'starter' | 'pro' | 'enterprise';

export interface PlanConfig {
  id: SubscriptionPlan;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  limits: {
    projects: number;
    testRunsPerMonth: number;
    teamMembers: number;
    features: string[];
  };
  stripeProductId?: string;
  stripePriceIdMonthly?: string;
  stripePriceIdAnnual?: string;
}

export interface SubscriptionStatus {
  userId: string;
  plan: SubscriptionPlan;
  stripeCustomerId: string;
  stripeSubscriptionId?: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageStats {
  userId: string;
  period: 'current' | 'last';
  testRuns: number;
  apiCalls: number;
  projectsCreated: number;
  dataStoredMB: number;
  resetDate?: Date;
  nextResetDate?: Date;
}

export interface QuotaStatus {
  plan: SubscriptionPlan;
  testRunsUsed: number;
  testRunsLimit: number;
  projectsUsed: number;
  projectsLimit: number;
  teamMembersUsed: number;
  teamMembersLimit: number;
  percentageUsed: number;
  isExceeded: boolean;
}

export interface CheckoutConfig {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  clientReferenceId?: string;
  metadata?: Record<string, string>;
}

export interface WebhookEvent {
  type: string;
  data: {
    object: Record<string, unknown>;
    previous_attributes?: Record<string, unknown>;
  };
}

export interface WebhookResult {
  success: boolean;
  message: string;
  action?: 'subscription_created' | 'subscription_updated' | 'subscription_deleted' | 'payment_succeeded' | 'payment_failed';
  userId?: string;
}

export interface StripeCustomer {
  id: string;
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}

export interface CheckoutSession {
  id: string;
  url: string;
  customerId: string;
}

export interface PortalSession {
  url: string;
  stripeCustomerId: string;
}

export const PLAN_CONFIGS: Record<SubscriptionPlan, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    limits: {
      projects: 5,
      testRunsPerMonth: 100,
      teamMembers: 1,
      features: ['Vibe Test Pilot', 'Community support']
    }
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 99,
    annualPrice: 950,
    limits: {
      projects: 50,
      testRunsPerMonth: 5000,
      teamMembers: 3,
      features: ['All free features', 'Self-healing', 'API testing', 'Email support']
    }
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 499,
    annualPrice: 4790,
    limits: {
      projects: 500,
      testRunsPerMonth: 50000,
      teamMembers: 10,
      features: ['All starter features', 'Mobile testing', 'Priority support', 'Custom integrations']
    }
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 0,
    annualPrice: 0,
    limits: {
      projects: 999999,
      testRunsPerMonth: 999999,
      teamMembers: 999999,
      features: ['Unlimited everything', 'On-premises option', 'SLA & compliance', '24/7 support', 'Account manager']
    }
  }
};
