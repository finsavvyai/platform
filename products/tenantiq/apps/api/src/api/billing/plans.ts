import type { Plan } from './types';

export const BILLING_PLANS: Record<string, Plan> = {
  'plan-core': {
    id: 'plan-core',
    name: 'Core',
    tier: 'core',
    description: 'Security visibility for your M365 tenants',
    pricing: { monthly: 79, annual: 756, currency: 'USD' },
    features: { tenants: 5, users: 50, storage: 50, apiCalls: 50000, customReports: false, prioritySupport: false },
    limits: { maxTenants: 5, maxUsers: 50, maxStorageGB: 50, maxApiCallsPerMonth: 50000 },
  },

  'plan-professional': {
    id: 'plan-professional',
    name: 'Professional',
    tier: 'professional',
    description: 'AI-powered remediation & compliance automation',
    pricing: { monthly: 199, annual: 1908, currency: 'USD' },
    features: { tenants: 25, users: 200, storage: 500, apiCalls: 500000, customReports: true, prioritySupport: true },
    limits: { maxTenants: 25, maxUsers: 200, maxStorageGB: 500, maxApiCallsPerMonth: 500000 },
  },

  'plan-security-suite': {
    id: 'plan-security-suite',
    name: 'Security Suite',
    tier: 'security_suite',
    description: 'Full M365 security control plane',
    pricing: { monthly: 399, annual: 3828, currency: 'USD' },
    features: { tenants: 50, users: 500, storage: 2000, apiCalls: 2000000, customReports: true, prioritySupport: true },
    limits: { maxTenants: 50, maxUsers: 500, maxStorageGB: 2000, maxApiCallsPerMonth: 2000000 },
  },

  'plan-enterprise': {
    id: 'plan-enterprise',
    name: 'Enterprise',
    tier: 'enterprise',
    description: 'For MSPs at scale with custom needs',
    pricing: { monthly: 0, annual: 0, currency: 'USD' },
    features: { tenants: 9999, users: 9999, storage: 5000, apiCalls: 9999999, customReports: true, prioritySupport: true },
    limits: { maxTenants: 9999, maxUsers: 9999, maxStorageGB: 5000, maxApiCallsPerMonth: 9999999 },
  },
};

export function getPlan(planId: string): Plan | null {
  return BILLING_PLANS[planId] || null;
}

export function listPlans(): Plan[] {
  return Object.values(BILLING_PLANS);
}

export function getPlanPrice(planId: string, billingCycle: 'monthly' | 'annual'): number | null {
  const plan = getPlan(planId);
  if (!plan) return null;
  return plan.pricing[billingCycle];
}

export function calculateProration(
  currentPlan: Plan,
  newPlan: Plan,
  daysRemaining: number,
  totalDaysInMonth: number = 30
): number {
  const currentDailyRate = currentPlan.pricing.monthly / totalDaysInMonth;
  const newDailyRate = newPlan.pricing.monthly / totalDaysInMonth;

  const unusedCredit = currentDailyRate * daysRemaining;
  const newCharge = newDailyRate * daysRemaining;

  return newCharge - unusedCredit;
}

export function canUpgrade(fromTier: string, toTier: string): boolean {
  const tierOrder = { core: 0, professional: 1, security_suite: 2, enterprise: 3 };
  const from = tierOrder[fromTier as keyof typeof tierOrder] ?? -1;
  const to = tierOrder[toTier as keyof typeof tierOrder] ?? -1;
  return to > from;
}

export function canDowngrade(fromTier: string, toTier: string): boolean {
  const tierOrder = { core: 0, professional: 1, security_suite: 2, enterprise: 3 };
  const from = tierOrder[fromTier as keyof typeof tierOrder] ?? -1;
  const to = tierOrder[toTier as keyof typeof tierOrder] ?? -1;
  return to < from;
}

export function getAnnualDiscount(monthlyPrice: number, annualPrice: number): number {
  const yearlyIfMonthly = monthlyPrice * 12;
  const savings = yearlyIfMonthly - annualPrice;
  return (savings / yearlyIfMonthly) * 100;
}

/** Volume discount tiers for Professional plan (per-tenant/month). */
export const VOLUME_TIERS = [
  { minTenants: 1, maxTenants: 9, monthly: 199, annual: 159 },
  { minTenants: 10, maxTenants: 24, monthly: 159, annual: 127 },
  { minTenants: 25, maxTenants: 49, monthly: 139, annual: 111 },
  { minTenants: 50, maxTenants: Infinity, monthly: 120, annual: 96 },
] as const;

/** Get the per-tenant price for Professional based on tenant count. */
export function getVolumePrice(
  tenantCount: number,
  cycle: 'monthly' | 'annual' = 'monthly',
): number {
  const tier = VOLUME_TIERS.find(
    (t) => tenantCount >= t.minTenants && tenantCount <= t.maxTenants,
  );
  return tier ? tier[cycle] : VOLUME_TIERS[0][cycle];
}
