/** Billing types for LemonSqueezy integration. */

export type Tier = 'free' | 'dev' | 'growth' | 'scale' | 'enterprise';

export interface TierLimits {
  callsPerDay: number;
  maxProjects: number;
}

/** Quotas mirror landing-page pricing grid. -1 = unlimited. */
export const TIER_LIMITS: Record<Tier, TierLimits> = {
  free:       { callsPerDay: 1_000,     maxProjects: 1 },
  dev:        { callsPerDay: 15_000,    maxProjects: -1 },
  growth:     { callsPerDay: 150_000,   maxProjects: -1 },
  scale:      { callsPerDay: 1_500_000, maxProjects: -1 },
  enterprise: { callsPerDay: -1,        maxProjects: -1 },
};

export interface SubscriptionRecord {
  projectId: string;
  lsCustomerId: string;
  lsSubscriptionId: string;
  lsVariantId: string;
  tier: Tier;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

export interface UsageRecord {
  projectId: string;
  date: string;
  tokensIn: number;
  tokensOut: number;
  totalCalls: number;
}

export interface DailyUsageSummary {
  tokensIn: number;
  tokensOut: number;
  totalCalls: number;
  limitCalls: number;
  remaining: number;
}

/** LemonSqueezy webhook event names we handle. */
export type LSEventName =
  | 'subscription_created'
  | 'subscription_updated'
  | 'subscription_cancelled'
  | 'subscription_expired'
  | 'subscription_payment_failed'
  | 'subscription_payment_recovered'
  | 'order_created';

/** Shape of a LemonSqueezy webhook payload (minimal, type-only). */
export interface LSWebhookEvent {
  meta: {
    event_name: string;
    custom_data?: { project_id?: string };
  };
  data: {
    id: string;
    attributes: Record<string, unknown>;
  };
}

/** Maps LemonSqueezy variant IDs to ClawPipe tiers. */
export interface VariantToTierMap {
  [variantId: string]: Tier;
}
