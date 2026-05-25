export type PlanId = "free" | "pro" | "team";
export type BillingPeriod = "monthly" | "annual";

export interface PlanFeatures {
  ai_diagnosis: boolean;
  cloud_minutes: number;
  team_size: number;
  deploy_targets: number;
  priority_support: boolean;
  sso: boolean;
  audit_logs: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  price_monthly: number;
  price_annual: number;
  features: PlanFeatures;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    price_monthly: 0,
    price_annual: 0,
    features: {
      ai_diagnosis: false,
      cloud_minutes: 0,
      team_size: 1,
      deploy_targets: 2,
      priority_support: false,
      sso: false,
      audit_logs: false,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    price_monthly: 9,
    price_annual: 90,
    features: {
      ai_diagnosis: true,
      cloud_minutes: 500,
      team_size: 1,
      deploy_targets: 16,
      priority_support: true,
      sso: false,
      audit_logs: false,
    },
  },
  team: {
    id: "team",
    name: "Team",
    price_monthly: 29,
    price_annual: 290,
    features: {
      ai_diagnosis: true,
      cloud_minutes: 2000,
      team_size: 25,
      deploy_targets: 16,
      priority_support: true,
      sso: true,
      audit_logs: true,
    },
  },
};

export interface CheckoutRequest {
  plan: "pro" | "team";
  period: BillingPeriod;
}

export interface CheckoutResponse {
  url: string;
}

export interface PortalResponse {
  url: string;
}

export function getPriceEnvKey(plan: "pro" | "team", period: BillingPeriod): string {
  const p = plan.toUpperCase();
  const d = period.toUpperCase();
  return `STRIPE_PRICE_${p}_${d}`;
}
