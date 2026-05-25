import { SubscriptionPlan, PlanLimits } from "../types/subscription.js";

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "free",
    name: "Free",
    description: "Perfect for trying out Questro",
    price: 0,
    currency: "usd",
    interval: "month",
    stripePriceId: "", // No Stripe price for free plan
    features: [
      {
        name: "Test Recording",
        description: "Record web and mobile tests",
        included: true,
        limit: 10,
      },
      {
        name: "Test Execution",
        description: "Run automated tests",
        included: true,
        limit: 50,
      },
      {
        name: "Team Members",
        description: "Collaborate with your team",
        included: true,
        limit: 1,
      },
      {
        name: "Projects",
        description: "Organize your tests",
        included: true,
        limit: 2,
      },
      {
        name: "Storage",
        description: "Store recordings and artifacts",
        included: true,
        limit: 1,
      },
      {
        name: "Export Formats",
        description: "Puppeteer, Playwright, Cypress",
        included: true,
      },
      {
        name: "Community Support",
        description: "Community forum support",
        included: true,
      },
      {
        name: "Data Retention",
        description: "Keep your test data",
        included: true,
        limit: 30,
      },
    ],
    limits: {
      recordingsPerMonth: 10,
      testExecutionsPerMonth: 50,
      teamMembers: 1,
      projectsLimit: 2,
      storageGB: 1,
      apiCallsPerMonth: 1000,
      retentionDays: 30,
      parallelTests: 1,
      integrations: [],
      supportLevel: "community",
      customBranding: false,
      ssoEnabled: false,
      auditLogs: false,
    },
  },
  {
    id: "starter",
    name: "Early Access",
    description: "For small teams getting started with automation",
    price: 2900, // $29/month
    currency: "usd",
    interval: "month",
    stripePriceId: "", // Not using Stripe
    lemonSqueezyVariantId: "1006098", // LEMONSQUEEZY_EARLY_ACCESS_VARIANT_ID
    trialDays: 14,
    features: [
      {
        name: "Test Recording",
        description: "Record web and mobile tests",
        included: true,
        limit: 100,
      },
      {
        name: "Test Execution",
        description: "Run automated tests",
        included: true,
        limit: 500,
      },
      {
        name: "Team Members",
        description: "Collaborate with your team",
        included: true,
        limit: 3,
      },
      {
        name: "Projects",
        description: "Organize your tests",
        included: true,
        limit: 10,
      },
      {
        name: "Storage",
        description: "Store recordings and artifacts",
        included: true,
        limit: 10,
      },
      {
        name: "All Export Formats",
        description: "Puppeteer, Playwright, Cypress, Selenium",
        included: true,
      },
      {
        name: "Email Support",
        description: "Email support within 24 hours",
        included: true,
      },
      {
        name: "Basic Integrations",
        description: "Slack, GitHub",
        included: true,
      },
      {
        name: "Data Retention",
        description: "Keep your test data",
        included: true,
        limit: 90,
      },
      {
        name: "Parallel Execution",
        description: "Run tests in parallel",
        included: true,
        limit: 3,
      },
    ],
    limits: {
      recordingsPerMonth: 100,
      testExecutionsPerMonth: 500,
      teamMembers: 3,
      projectsLimit: 10,
      storageGB: 10,
      apiCallsPerMonth: 10000,
      retentionDays: 90,
      parallelTests: 3,
      integrations: ["slack", "github"],
      supportLevel: "email",
      customBranding: false,
      ssoEnabled: false,
      auditLogs: false,
    },
  },
  {
    id: "professional",
    name: "Pro",
    description: "For growing teams that need more power",
    price: 9900, // $99/month
    currency: "usd",
    interval: "month",
    stripePriceId: "", // Not using Stripe
    lemonSqueezyVariantId: "1006101", // LEMONSQUEEZY_PRO_VARIANT_ID
    popular: true,
    trialDays: 14,
    features: [
      {
        name: "Unlimited Recording",
        description: "Record as many tests as you need",
        included: true,
      },
      {
        name: "Test Execution",
        description: "Run automated tests",
        included: true,
        limit: 2000,
      },
      {
        name: "Team Members",
        description: "Collaborate with your team",
        included: true,
        limit: 10,
      },
      {
        name: "Unlimited Projects",
        description: "Organize your tests",
        included: true,
      },
      {
        name: "Storage",
        description: "Store recordings and artifacts",
        included: true,
        limit: 50,
      },
      {
        name: "All Export Formats",
        description: "Every format we support",
        included: true,
      },
      {
        name: "Priority Support",
        description: "Priority email support within 4 hours",
        included: true,
      },
      {
        name: "Advanced Integrations",
        description: "Slack, GitHub, Teams, Discord, JIRA",
        included: true,
      },
      {
        name: "Data Retention",
        description: "Keep your test data",
        included: true,
        limit: 365,
      },
      {
        name: "Parallel Execution",
        description: "Run tests in parallel",
        included: true,
        limit: 10,
      },
      {
        name: "Advanced Analytics",
        description: "Detailed test analytics and reporting",
        included: true,
      },
      {
        name: "Custom Branding",
        description: "White-label the interface",
        included: true,
      },
    ],
    limits: {
      recordingsPerMonth: -1, // Unlimited
      testExecutionsPerMonth: 2000,
      teamMembers: 10,
      projectsLimit: -1, // Unlimited
      storageGB: 50,
      apiCallsPerMonth: 50000,
      retentionDays: 365,
      parallelTests: 10,
      integrations: ["slack", "github", "teams", "discord", "jira"],
      supportLevel: "priority",
      customBranding: true,
      ssoEnabled: false,
      auditLogs: true,
    },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For large organizations with advanced needs",
    price: 29900, // $299/month
    currency: "usd",
    interval: "month",
    stripePriceId: "", // Not using Stripe
    lemonSqueezyVariantId: "1006102", // LEMONSQUEEZY_ENTERPRISE_VARIANT_ID
    trialDays: 30,
    features: [
      {
        name: "Unlimited Everything",
        description: "No limits on usage",
        included: true,
      },
      {
        name: "Unlimited Team Members",
        description: "Entire organization access",
        included: true,
      },
      {
        name: "Unlimited Storage",
        description: "Store as much as you need",
        included: true,
      },
      {
        name: "All Export Formats",
        description: "Every format we support",
        included: true,
      },
      {
        name: "Dedicated Support",
        description: "Dedicated customer success manager",
        included: true,
      },
      {
        name: "All Integrations",
        description: "Every integration available",
        included: true,
      },
      {
        name: "Unlimited Data Retention",
        description: "Keep your data forever",
        included: true,
      },
      {
        name: "Unlimited Parallel Execution",
        description: "Scale as needed",
        included: true,
      },
      {
        name: "Advanced Analytics",
        description: "Enterprise reporting and dashboards",
        included: true,
      },
      {
        name: "Full Custom Branding",
        description: "Complete white-label solution",
        included: true,
      },
      {
        name: "SSO Integration",
        description: "SAML, OIDC, Active Directory",
        included: true,
      },
      {
        name: "Audit Logs",
        description: "Complete audit trail",
        included: true,
      },
      {
        name: "SLA Guarantee",
        description: "99.9% uptime SLA",
        included: true,
      },
      {
        name: "On-premise Deployment",
        description: "Deploy in your infrastructure",
        included: true,
      },
      {
        name: "Custom Integrations",
        description: "Build custom integrations",
        included: true,
      },
    ],
    limits: {
      recordingsPerMonth: -1, // Unlimited
      testExecutionsPerMonth: -1, // Unlimited
      teamMembers: -1, // Unlimited
      projectsLimit: -1, // Unlimited
      storageGB: -1, // Unlimited
      apiCallsPerMonth: -1, // Unlimited
      retentionDays: -1, // Unlimited
      parallelTests: -1, // Unlimited
      integrations: [
        "slack",
        "github",
        "teams",
        "discord",
        "jira",
        "webhook",
        "zapier",
        "custom",
      ],
      supportLevel: "dedicated",
      customBranding: true,
      ssoEnabled: true,
      auditLogs: true,
    },
  },
];

// Annual plans (20% discount)
export const ANNUAL_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    ...SUBSCRIPTION_PLANS[1], // Early Access
    id: "starter-annual",
    name: "Early Access Annual",
    price: 27840, // $29 * 12 * 0.8 = $278.40/year
    interval: "year",
    stripePriceId: "",
    lemonSqueezyVariantId: "", // Add if you create annual variants
  },
  {
    ...SUBSCRIPTION_PLANS[2], // Pro
    id: "professional-annual",
    name: "Pro Annual",
    price: 95040, // $99 * 12 * 0.8 = $950.40/year
    interval: "year",
    stripePriceId: "",
    lemonSqueezyVariantId: "", // Add if you create annual variants
  },
  {
    ...SUBSCRIPTION_PLANS[3], // Enterprise
    id: "enterprise-annual",
    name: "Enterprise Annual",
    price: 287040, // $299 * 12 * 0.8 = $2,870.40/year
    interval: "year",
    stripePriceId: "",
    lemonSqueezyVariantId: "", // Add if you create annual variants
  },
];

export const ALL_PLANS = [...SUBSCRIPTION_PLANS, ...ANNUAL_SUBSCRIPTION_PLANS];

export function getPlanById(planId: string): SubscriptionPlan | undefined {
  return ALL_PLANS.find((plan) => plan.id === planId);
}

export function getPlanByStripePrice(
  stripePriceId: string,
): SubscriptionPlan | undefined {
  return ALL_PLANS.find((plan) => plan.stripePriceId === stripePriceId);
}

export function getPlanByLemonSqueezyVariant(
  variantId: string,
): SubscriptionPlan | undefined {
  return ALL_PLANS.find((plan) => plan.lemonSqueezyVariantId === variantId);
}

export function isFeatureAvailable(planId: string, feature: string): boolean {
  const plan = getPlanById(planId);
  if (!plan) return false;

  const planFeature = plan.features.find((f) => f.name === feature);
  return planFeature?.included || false;
}

export function getUsageLimit(
  planId: string,
  limitType: keyof PlanLimits,
): number {
  const plan = getPlanById(planId);
  if (!plan) return 0;

  const limit = plan.limits[limitType];
  return typeof limit === "number" ? limit : 0;
}

export function canUpgrade(
  currentPlanId: string,
  targetPlanId: string,
): boolean {
  const currentPlan = getPlanById(currentPlanId);
  const targetPlan = getPlanById(targetPlanId);

  if (!currentPlan || !targetPlan) return false;

  // Free can upgrade to anything
  if (currentPlan.id === "free") return true;

  // Can upgrade to higher price plans
  return targetPlan.price > currentPlan.price;
}

export function canDowngrade(
  currentPlanId: string,
  targetPlanId: string,
): boolean {
  const currentPlan = getPlanById(currentPlanId);
  const targetPlan = getPlanById(targetPlanId);

  if (!currentPlan || !targetPlan) return false;

  // Can downgrade to lower price plans (but not to free from paid)
  if (targetPlan.id === "free" && currentPlan.id !== "free") return false;

  return targetPlan.price < currentPlan.price;
}
