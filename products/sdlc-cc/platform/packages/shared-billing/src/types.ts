/**
 * SDLC.ai Billing System Types
 * Supports both Stripe and LemonSqueezy payment processors
 */

// Payment Processor Types
export type PaymentProcessor = 'stripe' | 'lemonsqueezy';

// Billing Configuration
export interface BillingConfig {
  processor: PaymentProcessor;
  apiKey: string;
  signingSecret: string;
  storeId?: string; // For LemonSqueezy
  testMode?: boolean;
  webhookUrl?: string;
  successUrl?: string;
  cancelUrl?: string;
  // Supabase integration
  supabaseUrl: string;
  supabaseServiceKey: string;
}

// Customer Management
export interface Customer {
  id: string;
  email: string;
  name?: string;
  userId: string;
  organizationId?: string;
  processor: PaymentProcessor;
  processorCustomerId: string; // stripe_customer_id or lemon_squeezy_id
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// Subscription Tiers
export type SubscriptionTier = 'starter' | 'professional' | 'enterprise';

export interface TierConfiguration {
  starter: TierDetails;
  professional: TierDetails;
  enterprise: TierDetails;
}

export interface TierDetails {
  price: number; // Monthly price in USD
  currency: string;
  products: SDLCQuotas;
  features: string[];
  processorPriceIds?: {
    stripe?: string; // Stripe price ID
    lemonsqueezy?: string; // LemonSqueezy variant ID
  };
}

export interface SDLCQuotas {
  rag: {
    queriesPerMonth: number; // -1 for unlimited
    maxDocuments: number;
    maxTokensPerQuery: number;
  };
  vectorSearch: {
    indexCount: number;
    queriesPerMonth: number;
  };
  dlp: {
    scansPerMonth: number;
    customPolicies: number;
  };
  compliance: {
    frameworks: string[];
    checksPerMonth: number;
    riskAssessments: number;
  };
  api: {
    rateLimit: number; // requests per minute
    storageMB: number;
    teamMembers: number;
  };
}

// Subscription Management
export interface Subscription {
  id: string;
  customerId: string;
  userId: string;
  tenantId?: string;
  tier: SubscriptionTier;
  processor: PaymentProcessor;
  processorSubscriptionId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEnd?: Date;
  quota: SDLCQuotas;
  usage: SDLCUsage;
  createdAt: Date;
  updatedAt: Date;
}

export type SubscriptionStatus =
  | 'active'
  | 'cancelled'
  | 'expired'
  | 'past_due'
  | 'paused'
  | 'unpaid'
  | 'on_trial'
  | 'incomplete'
  | 'incomplete_expired';

export interface SDLCUsage {
  rag: {
    queries: number;
    documentsProcessed: number;
  };
  vectorSearch: {
    queries: number;
    indexesUsed: number;
  };
  dlp: {
    scans: number;
  };
  compliance: {
    checks: number;
    riskAssessments: number;
  };
  api: {
    requests: number;
    storageMBUsed: number;
  };
}

// Subscription Operations
export interface CreateSubscriptionParams {
  userId: string;
  email: string;
  tier: SubscriptionTier;
  tenantId?: string;
  organizationId?: string;
  processor?: PaymentProcessor;
  successUrl?: string;
  cancelUrl?: string;
  trialDays?: number;
}

export interface UpdateSubscriptionParams {
  subscriptionId: string;
  tier?: SubscriptionTier;
  cancelAtPeriodEnd?: boolean;
  metadata?: Record<string, unknown>;
}

export interface CancelSubscriptionParams {
  subscriptionId: string;
  immediately?: boolean;
  reason?: string;
  feedback?: string;
}

// Checkout Sessions
export interface CheckoutSession {
  id: string;
  url: string;
  customerId: string;
  subscriptionId?: string;
  userId: string;
  productId: string;
  tier: SubscriptionTier;
  processor: PaymentProcessor;
  amount: number;
  currency: string;
  expiresAt: Date;
  successUrl?: string;
  cancelUrl?: string;
}

// Usage Tracking
export interface UsageRecord {
  id: string;
  userId: string;
  subscriptionId?: string;
  productId: string;
  metric: string;
  quantity: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  billingCycle: string; // YYYY-MM format
}

export interface TrackUsageParams {
  userId: string;
  productId: string;
  metric: string;
  quantity: number;
  subscriptionId?: string;
  metadata?: Record<string, unknown>;
}

export interface UsageQuota {
  userId: string;
  productId: string;
  metric: string;
  limit: number;
  used: number;
  remaining: number;
  billingCycle: string;
}

export interface QuotaExceeded {
  userId: string;
  productId: string;
  metric: string;
  limit: number;
  used: number;
  overage: number;
  suggestedTier: SubscriptionTier;
}

// Invoices and Billing
export interface Invoice {
  id: string;
  customerId: string;
  subscriptionId?: string;
  userId: string;
  processor: PaymentProcessor;
  processorInvoiceId: string;
  number: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  dueDate: Date;
  paidAt?: Date;
  pdfUrl?: string;
  invoiceUrl?: string;
  lineItems: InvoiceLineItem[];
  tax?: number;
  total: number;
  created: Date;
}

export type InvoiceStatus =
  | 'draft'
  | 'open'
  | 'paid'
  | 'void'
  | 'uncollectible';

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  proration: boolean;
  period?: {
    start: Date;
    end: Date;
  };
}

// Bundle Management
export interface BundleUpgradeOffer {
  currentProducts: string[];
  currentMonthlyCost: number;
  bundleType: 'professional' | 'enterprise';
  bundleMonthlyCost: number;
  monthlySavings: number;
  savingsPercent: number;
  includedProducts: string[];
  upgradeSavings: {
    monthly: number;
    annual: number;
  };
}

// Organization Billing
export interface OrganizationBilling {
  id: string;
  organizationId: string;
  name: string;
  tier: SubscriptionTier;
  memberCount: number;
  activeSubscriptions: number;
  monthlyCost: number;
  usage: SDLCUsage;
  quota: SDLCQuotas;
  nextBillingDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Webhook Events
export interface WebhookEvent {
  id: string;
  type: string;
  processor: PaymentProcessor;
  data: unknown;
  signature: string;
  timestamp: Date;
}

export interface WebhookResult {
  success: boolean;
  processed: boolean;
  error?: string;
}

// Billing Analytics
export interface BillingAnalytics {
  period: {
    start: Date;
    end: Date;
  };
  revenue: {
    monthlyRecurring: number;
    oneTimePayments: number;
    total: number;
  };
  subscriptions: {
    total: number;
    active: number;
    churned: number;
    upgrades: number;
    downgrades: number;
  };
  usage: {
    totalRequests: number;
    topProducts: Array<{
      productId: string;
      usage: number;
    }>;
    topUsers: Array<{
      userId: string;
      usage: number;
    }>;
  };
  customers: {
    total: number;
    new: number;
    churned: number;
    avgLifetimeValue: number;
  };
}

// API Responses
export interface BillingResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

// Error Types
export class BillingError extends Error {
  public readonly code: string;
  public readonly details?: unknown;
  public readonly processor?: PaymentProcessor;
  public readonly timestamp: Date;

  constructor(options: {
    code: string;
    message: string;
    details?: unknown;
    processor?: PaymentProcessor;
    timestamp: Date;
  }) {
    super(options.message);
    this.name = 'BillingError';
    this.code = options.code;
    this.details = options.details;
    this.processor = options.processor || 'stripe';
    this.timestamp = options.timestamp;
  }
}

// Migration Types (for data migration between processors)
export interface CustomerMigration {
  fromProcessor: PaymentProcessor;
  toProcessor: PaymentProcessor;
  customerId: string;
  userId: string;
  preserveSubscriptions: boolean;
}

export interface SubscriptionMigration {
  fromProcessor: PaymentProcessor;
  toProcessor: PaymentProcessor;
  subscriptionId: string;
  preserveUsage: boolean;
}

// Notification Types
export interface BillingNotification {
  type: 'subscription_created' | 'subscription_cancelled' | 'payment_succeeded' | 'payment_failed' | 'quota_exceeded' | 'upgrade_suggested';
  userId: string;
  data: unknown;
  channels: ('email' | 'in_app' | 'webhook')[];
  template?: string;
  sendAt?: Date;
}

// Configuration Constants
export const DEFAULT_TIER_CONFIGS: TierConfiguration = {
  starter: {
    price: 99,
    currency: 'USD',
    products: {
      rag: { queriesPerMonth: 1000, maxDocuments: 100, maxTokensPerQuery: 4096 },
      vectorSearch: { indexCount: 3, queriesPerMonth: 5000 },
      dlp: { scansPerMonth: 500, customPolicies: 3 },
      compliance: { frameworks: ['GDPR'], checksPerMonth: 50, riskAssessments: 10 },
      api: { rateLimit: 100, storageMB: 10240, teamMembers: 3 },
    },
    features: [
      'Basic RAG pipeline',
      'PII detection',
      'Audit logging',
      '10GB storage',
      'GDPR compliance',
      'Email support',
    ],
  },
  professional: {
    price: 499,
    currency: 'USD',
    products: {
      rag: { queriesPerMonth: 10000, maxDocuments: 1000, maxTokensPerQuery: 16384 },
      vectorSearch: { indexCount: 20, queriesPerMonth: 50000 },
      dlp: { scansPerMonth: 5000, customPolicies: 20 },
      compliance: { frameworks: ['GDPR', 'HIPAA', 'FINRA', 'PCI-DSS'], checksPerMonth: 500, riskAssessments: 100 },
      api: { rateLimit: 1000, storageMB: 102400, teamMembers: 15 },
    },
    features: [
      'Advanced RAG pipeline',
      'Full PII detection & redaction',
      'All compliance frameworks',
      '100GB storage',
      'Priority support',
      'Custom integrations',
      'Realtime streaming',
      'Developer portal access',
    ],
  },
  enterprise: {
    price: 0, // Custom pricing
    currency: 'USD',
    products: {
      rag: { queriesPerMonth: -1, maxDocuments: -1, maxTokensPerQuery: -1 },
      vectorSearch: { indexCount: -1, queriesPerMonth: -1 },
      dlp: { scansPerMonth: -1, customPolicies: -1 },
      compliance: { frameworks: ['GDPR', 'HIPAA', 'FINRA', 'PCI-DSS', 'SOC2', 'ISO27001'], checksPerMonth: -1, riskAssessments: -1 },
      api: { rateLimit: -1, storageMB: -1, teamMembers: -1 },
    },
    features: [
      'Enterprise RAG pipeline',
      'Zero-trust architecture',
      'All compliance frameworks',
      'Unlimited storage',
      'Dedicated support',
      'Custom SLA',
      'On-premise deployment',
      'SAML SSO',
      'White-label options',
    ],
  },
};