// Pricing-tier id contract shared by the /pricing page, the
// /checkout/[plan] route, and the api/checkout/create LemonSqueezy
// handler. Pricing tiers are kept in lockstep with COMMERCIAL.md
// (Free / Team / Business / Enterprise as of 2026-05-20).

export type CheckoutPlan = "free" | "team" | "business" | "enterprise";

const VALID_PLANS: ReadonlyArray<CheckoutPlan> = [
  "free",
  "team",
  "business",
  "enterprise",
];

export const toPlan = (
  value: string | string[] | undefined,
): CheckoutPlan | null => {
  if (!value || Array.isArray(value)) return null;
  return (VALID_PLANS as ReadonlyArray<string>).includes(value)
    ? (value as CheckoutPlan)
    : null;
};

export const getSiteUrl = (): string =>
  process.env.NEXT_PUBLIC_SITE_URL || "https://sdlc.cc";

// Per-tier fallback URL used when dynamic LemonSqueezy checkout
// creation is not configured (missing API key / store id / variant
// id) or when a tier intentionally does not run through LemonSqueezy
// (Free → GitHub, Enterprise → sales contact).
export const getCheckoutFallbackTarget = (plan: CheckoutPlan): string => {
  const storeUrl =
    process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_URL ||
    "https://finsavvy.lemonsqueezy.com";

  switch (plan) {
    case "free":
      return "https://github.com/finsavvyai/sdlc-platform";
    case "enterprise":
      return "mailto:commercial@sdlc.cc";
    case "team":
      return (
        process.env.LEMONSQUEEZY_TEAM_CHECKOUT_URL ||
        process.env.NEXT_PUBLIC_LEMONSQUEEZY_TEAM_URL ||
        storeUrl
      );
    case "business":
      return (
        process.env.LEMONSQUEEZY_BUSINESS_CHECKOUT_URL ||
        process.env.NEXT_PUBLIC_LEMONSQUEEZY_BUSINESS_URL ||
        storeUrl
      );
  }
};

// Per-tier LemonSqueezy variant id. Returns null for tiers that do
// not run through LemonSqueezy (free, enterprise) and for tiers
// whose env var has not yet been populated post-Wave-4 product
// creation.
export const getCheckoutVariantId = (plan: CheckoutPlan): string | null => {
  if (plan === "team") {
    return process.env.LEMONSQUEEZY_VARIANT_ID_TEAM || null;
  }
  if (plan === "business") {
    return process.env.LEMONSQUEEZY_VARIANT_ID_BUSINESS || null;
  }
  return null;
};

export const getCheckoutStoreId = (): string | null =>
  process.env.LEMONSQUEEZY_STORE_ID || null;

// Plans that route through LemonSqueezy dynamic checkout. Used by
// /checkout/[plan] to decide whether to POST to /api/checkout/create
// or to redirect straight to the fallback target.
export const isDynamicCheckoutPlan = (plan: CheckoutPlan): boolean =>
  plan === "team" || plan === "business";
