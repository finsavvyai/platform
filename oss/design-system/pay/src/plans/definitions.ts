export interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  stripePriceId?: string;
  lemonSqueezyVariantId?: string;
}

export const STARTER_PLAN: Plan = {
  id: 'starter',
  name: 'Starter',
  price: 29,
  currency: 'USD',
  interval: 'month',
  features: [
    'Up to 5 accounts',
    'Basic budgeting',
    'Transaction tracking',
    'Email support',
  ],
  stripePriceId: 'price_starter_monthly',
  lemonSqueezyVariantId: 'variant_starter_monthly',
};

export const PRO_PLAN: Plan = {
  id: 'pro',
  name: 'Pro',
  price: 79,
  currency: 'USD',
  interval: 'month',
  features: [
    'Unlimited accounts',
    'Advanced analytics',
    'Investment tracking',
    'Tax reports',
    'API access',
    'Priority support',
  ],
  stripePriceId: 'price_pro_monthly',
  lemonSqueezyVariantId: 'variant_pro_monthly',
};

export const ENTERPRISE_PLAN: Plan = {
  id: 'enterprise',
  name: 'Enterprise',
  price: 299,
  currency: 'USD',
  interval: 'month',
  features: [
    'Everything in Pro',
    'Custom integrations',
    'Dedicated account manager',
    'SLA guarantee',
    'Advanced security',
    'White-label options',
    'Audit logging',
  ],
  stripePriceId: 'price_enterprise_monthly',
  lemonSqueezyVariantId: 'variant_enterprise_monthly',
};

export const PLANS_BY_ID: Record<string, Plan> = {
  [STARTER_PLAN.id]: STARTER_PLAN,
  [PRO_PLAN.id]: PRO_PLAN,
  [ENTERPRISE_PLAN.id]: ENTERPRISE_PLAN,
};

export function getPlanById(id: string): Plan | null {
  return PLANS_BY_ID[id] || null;
}

export function getAllPlans(): Plan[] {
  return [STARTER_PLAN, PRO_PLAN, ENTERPRISE_PLAN];
}
