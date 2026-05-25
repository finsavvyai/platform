export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number; // in cents
  currency: string;
  interval: 'month' | 'year';
  features: PlanFeature[];
  limits: PlanLimits;
  stripePriceId: string;
  lemonSqueezyVariantId?: string;
  popular?: boolean;
  trialDays?: number;
}

export interface PlanFeature {
  name: string;
  description: string;
  included: boolean;
  limit?: number;
}

export interface PlanLimits {
  recordingsPerMonth: number;
  testExecutionsPerMonth: number;
  teamMembers: number;
  projectsLimit: number;
  storageGB: number;
  apiCallsPerMonth: number;
  retentionDays: number;
  parallelTests: number;
  integrations: string[]; // ['slack', 'teams', 'github', 'jira']
  supportLevel: 'community' | 'email' | 'priority' | 'dedicated';
  customBranding: boolean;
  ssoEnabled: boolean;
  auditLogs: boolean;
}

export interface UserSubscription {
  id: string;
  userId: string;
  planId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  status: 'incomplete' | 'incomplete_expired' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialStart?: Date;
  trialEnd?: Date;
  canceledAt?: Date;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Usage {
  userId: string;
  period: string; // YYYY-MM format
  recordingCount: number;
  testExecutionCount: number;
  storageUsedMB: number;
  apiCallCount: number;
  lastUpdated: Date;
}

export interface Invoice {
  id: string;
  userId: string;
  stripeInvoiceId: string;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  periodStart: Date;
  periodEnd: Date;
  paidAt?: Date;
  dueDate: Date;
  hostedInvoiceUrl?: string;
  invoicePdf?: string;
  createdAt: Date;
}

export interface PaymentMethod {
  id: string;
  userId: string;
  stripePaymentMethodId: string;
  type: 'card' | 'bank_account';
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  isDefault: boolean;
  createdAt: Date;
}

export interface BillingAddress {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export interface Customer {
  id: string;
  userId: string;
  stripeCustomerId: string;
  email: string;
  name?: string;
  phone?: string;
  billingAddress?: BillingAddress;
  taxIds?: Array<{
    type: string;
    value: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionChangeRequest {
  userId: string;
  newPlanId: string;
  prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice';
  effectiveDate?: 'immediate' | 'next_cycle';
}

export interface UsageAlert {
  id: string;
  userId: string;
  type: 'recording_limit' | 'execution_limit' | 'storage_limit' | 'api_limit';
  threshold: number; // percentage (80, 90, 100)
  triggered: boolean;
  notificationSent: boolean;
  createdAt: Date;
}

export interface Coupon {
  id: string;
  code: string;
  stripeCouponId: string;
  percentOff?: number;
  amountOff?: number;
  currency?: string;
  duration: 'forever' | 'once' | 'repeating';
  durationInMonths?: number;
  maxRedemptions?: number;
  timesRedeemed: number;
  validFrom: Date;
  validUntil?: Date;
  active: boolean;
  createdAt: Date;
}