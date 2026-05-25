export type PlanTier = 'core' | 'professional' | 'security_suite' | 'enterprise';
export type BillingCycle = 'monthly' | 'annual';
export type PaymentStatus = 'pending' | 'success' | 'failure' | 'cancelled';
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'expired';

export interface Plan {
  id: string;
  name: string;
  tier: PlanTier;
  description: string;
  pricing: {
    monthly: number;
    annual: number;
    currency: string;
  };
  features: {
    tenants: number;
    users: number;
    storage: number;
    apiCalls: number;
    customReports: boolean;
    prioritySupport: boolean;
  };
  limits: {
    maxTenants: number;
    maxUsers: number;
    maxStorageGB: number;
    maxApiCallsPerMonth: number;
  };
}

export interface Subscription {
  id: string;
  orgId: string;
  planId: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currentPrice: number;
  currency: string;
  startDate: Date;
  renewalDate: Date;
  cancellationDate?: Date;
  autoRenew: boolean;
  metadata?: Record<string, any>;
}

export interface CheckoutSession {
  id: string;
  sessionId: string;
  orgId: string;
  planId: string;
  billingCycle: BillingCycle;
  amount: number;
  currency: string;
  redirectUrl: string;
  expiresAt: Date;
  status: PaymentStatus;
  createdAt: Date;
}

export interface Payment {
  id: string;
  sessionId: string;
  orgId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method: string;
  reference: string;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface Invoice {
  id: string;
  orgId: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  issueDate: Date;
  dueDate: Date;
  paidAt?: Date;
  downloadUrl: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
}

export interface PaymentMethod {
  id: string;
  orgId: string;
  type: 'card' | 'bank_account';
  lastFour: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  createdAt: Date;
}

export interface WebhookEvent {
  id: string;
  event: string;
  timestamp: Date;
  data: Record<string, any>;
  signature: string;
}

export interface CheckoutRequest {
  planId: string;
  billingCycle: BillingCycle;
  coupon?: string;
  tenantId?: string;
}

export interface UpgradeRequest {
  planId: string;
  effectiveDate?: Date;
}

export interface CancelRequest {
  reason?: string;
  feedback?: string;
  effectiveDate?: Date;
}

export interface RefundRequest {
  amount?: number;
  reason: string;
}

export interface UsageStats {
  current: number;
  limit: number;
  percentage: number;
  resetDate?: Date;
}

export interface BillingAccount {
  id: string;
  orgId: string;
  email: string;
  name: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  taxId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Coupon {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  maxUses?: number;
  usedCount: number;
  validFrom: Date;
  validTo: Date;
  minAmount?: number;
  applicable: string[];
}
