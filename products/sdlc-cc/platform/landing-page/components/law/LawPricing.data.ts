// Tier + add-on data for LawPricing. Extracted so the component
// stays under the portfolio 200-line cap. Pricing must stay in
// lockstep with COMMERCIAL.md.

export type Tier = {
  id: string;
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  features: string[];
  cta: { label: string; href?: string; checkoutId?: string; primary?: boolean };
};

export type AddOn = {
  name: string;
  price: string;
  cadence: string;
  description: string;
  checkoutId: string;
};

export const tiers: Tier[] = [
  {
    id: 'free',
    name: 'Free (self-host)',
    price: '$0',
    cadence: 'AGPL-3.0',
    blurb:
      'Clone the repo, run docker-compose up. No commercial buyout, no support.',
    features: [
      'Full privacy gateway under AGPL-3.0',
      'All five DLP presets (pii_default, secrets, legal, finance, healthcare)',
      'Browser extension + VS Code addin',
      'Community Discord',
    ],
    cta: {
      label: 'Self-host on GitHub',
      href: 'https://github.com/finsavvyai/sdlc-platform',
    },
  },
  {
    id: 'team',
    name: 'Team',
    price: '$39',
    cadence: 'per seat / mo',
    blurb: 'Lift the AGPL source-disclosure obligation for small teams.',
    features: [
      'Commercial buyout (closed-source OK)',
      'Email support, 5-day SLA',
      'Semver upgrade window',
      'All DLP presets including legal',
      '5-seat minimum',
    ],
    cta: {
      label: 'Buy Team',
      href: '/checkout/team',
      primary: true,
    },
  },
  {
    id: 'business',
    name: 'Business',
    price: '$79',
    cadence: 'per seat / mo',
    blurb:
      'Team plus store-listed extensions, bundled SAML/SCIM, priority SLA.',
    features: [
      'Everything in Team',
      'Store-listed extension builds (Chrome, Edge, Firefox, Safari)',
      'SAML 2.0 + SCIM 2.0 bundled',
      'Priority SLA (1 business day)',
      'DPA template included',
      '10-seat minimum',
    ],
    cta: {
      label: 'Buy Business',
      href: '/checkout/business',
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'from $4,000',
    cadence: 'per seat / yr',
    blurb: 'Custom DLP presets, DPA negotiation, CMEK, named on-call.',
    features: [
      'Everything in Business',
      'Custom DLP presets + Rego policy review',
      'Negotiated DPA + MSA',
      'CMEK envelope encryption',
      'Named on-call engineer',
      'Audit-log retention extensions',
    ],
    cta: {
      label: 'Email commercial@sdlc.cc',
      href: 'mailto:commercial@sdlc.cc',
    },
  },
];

export const addOns: AddOn[] = [
  {
    name: 'Setup engagement',
    price: '$5,000',
    cadence: 'one-time',
    description:
      'Two-week engagement: install on your infrastructure, integrate with your IdP, tune DLP presets to your use case, hand off to your team.',
    checkoutId: 'PLACEHOLDER_SETUP_ENGAGEMENT',
  },
  {
    name: 'Support contract',
    price: '$500 – $2,000',
    cadence: 'per month',
    description:
      'Priority response, named contact, quarterly policy review, direct line to engineering. Pricing scales with seat count.',
    checkoutId: 'PLACEHOLDER_SUPPORT_CONTRACT',
  },
];
