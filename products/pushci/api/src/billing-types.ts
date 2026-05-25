export type PlanId = "free" | "pro" | "team" | "enterprise";

export interface PlanFeatures {
  ai_diagnosis: boolean;
  ai_edit: boolean;
  cloud_minutes: number;
  cloud_schedules: number;
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
      ai_edit: false,
      cloud_minutes: 0,
      cloud_schedules: 0,
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
      ai_edit: true,
      cloud_minutes: 500,
      cloud_schedules: 3,
      team_size: 1,
      deploy_targets: 22,
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
      ai_edit: true,
      cloud_minutes: 2000,
      cloud_schedules: 50,
      team_size: 25,
      deploy_targets: 22,
      priority_support: true,
      sso: true,
      audit_logs: true,
    },
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    price_monthly: 25,
    price_annual: 250,
    features: {
      ai_diagnosis: true,
      ai_edit: true,
      cloud_minutes: -1,
      cloud_schedules: -1,
      team_size: -1,
      deploy_targets: 22,
      priority_support: true,
      sso: true,
      audit_logs: true,
    },
  },
};
