// Pricing tier definitions. Kept in a plain TS module so both the
// server page and the LemonSqueezy export script can consume the
// same data. See docs/lemonsqueezy/products.{md,json} for the
// canonical product spec.

export const FREE_NOTE =
  "Or stay on AGPL-3.0 and pay $0. The code is the same —";

export type Variant = {
  label: string;
  // String placeholder until the human creates the products in
  // LemonSqueezy. The frontend will swap these for real variant IDs
  // after approval; see docs/lemonsqueezy/products.md.
  checkoutId: string;
};

export type Tier = {
  id: "commercial" | "setup" | "support";
  name: string;
  tagline: string;
  priceLabel: string;
  priceFootnote: string;
  features: string[];
  variants: Variant[];
  highlighted?: boolean;
};

export const tiers: Tier[] = [
  {
    id: "commercial",
    name: "Commercial License",
    tagline:
      "Embed sdlc.cc in a closed-source product without AGPL-3.0 source-disclosure obligations.",
    priceLabel: "$4,000",
    priceFootnote: "per seat / year · annual billing",
    highlighted: true,
    features: [
      "Lifts AGPL copyleft for derivative work product",
      "Signed PDF license agreement within 24 hours",
      "Renewal price locked for two cycles",
      "Private support channel (5 business day response)",
      "Volume discount at 10 and 50 seats",
    ],
    variants: [
      {
        label: "1 seat — $4,000 / yr",
        checkoutId: "LS_CHECKOUT_ID_COMMERCIAL_1SEAT",
      },
      {
        label: "5 seats — $19,000 / yr",
        checkoutId: "LS_CHECKOUT_ID_COMMERCIAL_5SEAT",
      },
      {
        label: "10 seats — $36,000 / yr",
        checkoutId: "LS_CHECKOUT_ID_COMMERCIAL_10SEAT",
      },
      {
        label: "50 seats — $160,000 / yr",
        checkoutId: "LS_CHECKOUT_ID_COMMERCIAL_50SEAT",
      },
    ],
  },
  {
    id: "setup",
    name: "Setup Engagement",
    tagline:
      "We deploy the gateway in your infrastructure, configure DLP for your matters, hand over the runbook.",
    priceLabel: "$5,000",
    priceFootnote: "one-time · ~1-2 weeks",
    features: [
      "Deployment in your VPC (AWS / Azure / GCP / on-prem)",
      "DLP pattern bundle tuned to your matter types",
      "SCIM + SSO wiring against your IdP",
      "Runbook handover + 1-hour transfer call",
      "Optional: bring-your-own-keys envelope encryption",
    ],
    variants: [
      {
        label: "Book setup — $5,000",
        checkoutId: "LS_CHECKOUT_ID_SETUP_ONETIME",
      },
    ],
  },
  {
    id: "support",
    name: "Support Contract",
    tagline:
      "Prioritised bug fixes, upgrade path, named contact. Monthly billing; cancel any time.",
    priceLabel: "$500 – $2,000",
    priceFootnote: "per month · three response-time tiers",
    features: [
      "Basic — response within 5 business days",
      "Pro — response within 1 business day",
      "Priority — response within 4 business hours + named contact",
      "Monthly upgrade-path check-in (Pro and Priority)",
      "Shared incident channel (Slack or email)",
    ],
    variants: [
      {
        label: "Basic — $500 / mo",
        checkoutId: "LS_CHECKOUT_ID_SUPPORT_BASIC",
      },
      {
        label: "Pro — $1,000 / mo",
        checkoutId: "LS_CHECKOUT_ID_SUPPORT_PRO",
      },
      {
        label: "Priority — $2,000 / mo",
        checkoutId: "LS_CHECKOUT_ID_SUPPORT_PRIORITY",
      },
    ],
  },
];

export const addons = [
  { name: "Setup engagement", price: "$5,000 one-time" },
  { name: "Support contract", price: "$500 – $2,000 / mo" },
  { name: "Sponsor sdlc.cc", price: "from $5" },
];
