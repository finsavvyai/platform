/**
 * Pricing tier data for the AMLIQ Brain pricing page.
 *
 * Source of truth: `decisive_plan_90day.md` locked decision #7.
 *   Starter    $0/mo  + $400/agent action — OFAC public sanctions only
 *   Pro        $20K/mo + $300/agent action — ComplyAdvantage integrated
 *   Enterprise $80K/mo + $250/agent action — Dow Jones Risk customer-licensed
 *
 * Kept out of `src/pages/pricing/index.astro` to honour the portfolio
 * 200-line cap and to make the structured copy reviewable in isolation
 * (e.g. by GTM / legal) without diff noise from layout.
 */

export interface PricingCta {
  readonly href: string;
  readonly label: string;
}

export interface PricingTier {
  readonly name: string;
  readonly tagline: string;
  readonly platformPrice: string;
  readonly platformUnit: string;
  readonly agentPrice: string;
  readonly agentUnit: string;
  readonly features: readonly string[];
  readonly cta: PricingCta;
  readonly highlight?: boolean;
  readonly badge?: string;
}

export const TIERS: readonly PricingTier[] = [
  {
    name: 'Starter',
    tagline:
      'Get hands-on with AMLIQ Brain. Public sanctions only, single tenant.',
    platformPrice: '$0',
    platformUnit: '/month',
    agentPrice: '$400',
    agentUnit: ' per agent action',
    features: [
      '1 of 3 Brain agents (Alert Triage)',
      'OFAC public sanctions screening',
      '2 MCP connectors (Slack + RSS)',
      '90-day audit retention',
      'Multi-tenant isolation — schema per tenant',
      'Community support',
    ],
    cta: { href: '/contact?plan=starter', label: 'Start free' },
  },
  {
    name: 'Pro',
    tagline: 'For compliance teams running daily ops on AMLIQ Brain.',
    platformPrice: '$20,000',
    platformUnit: '/month',
    agentPrice: '$300',
    agentUnit: ' per agent action',
    features: [
      'All 3 Brain agents (SAR Draft, Reg Change, Alert Triage)',
      'ComplyAdvantage sanctions + PEP screening',
      '6 MCP connectors (Slack, Confluence, Drive, Jira, Teams, RSS)',
      '90-day audit retention with tamper-evident chain',
      'Multi-tenant isolation — schema per tenant',
      'SSO (Google, Microsoft, Okta)',
      'SOC 2 Type 1 report access',
      'Business-hours support — 1-business-day SLA',
    ],
    cta: { href: '/contact?plan=pro', label: 'Talk to sales' },
    highlight: true,
    badge: 'Recommended',
  },
  {
    name: 'Enterprise',
    tagline:
      'For regulated FIs with custom data sources and 24/7 ops.',
    platformPrice: '$80,000',
    platformUnit: '/month',
    agentPrice: '$250',
    agentUnit: ' per agent action',
    features: [
      'All 3 Brain agents + custom-agent SDK',
      'Dow Jones Risk feed (customer-licensed)',
      '6 MCP connectors + custom connector quota',
      'Custom audit retention (default 7 years)',
      'Multi-tenant isolation — schema per tenant',
      'SAML SSO + SCIM provisioning',
      'SOC 2 Type 2 report access',
      '24/7 support — 1-hour critical SLA',
      'Dedicated Customer Success Manager',
      'Self-hosted deployment available',
    ],
    cta: { href: '/contact?plan=enterprise', label: 'Contact sales' },
  },
];

export interface ComparisonRow {
  readonly feature: string;
  readonly cells: readonly [string, string, string];
  readonly emphasis?: boolean;
}

export const COMPARISON: readonly ComparisonRow[] = [
  {
    feature: 'Brain agents',
    cells: [
      'Alert Triage',
      'SAR Draft · Reg Change · Alert Triage',
      'All 3 + custom-agent SDK',
    ],
    emphasis: true,
  },
  {
    feature: 'Sanctions screening',
    cells: [
      'OFAC public lists',
      'ComplyAdvantage (Pro partnership)',
      'Dow Jones Risk (customer-licensed)',
    ],
    emphasis: true,
  },
  {
    feature: 'MCP connector library',
    cells: ['2', '6', '6 + custom quota'],
  },
  {
    feature: 'Audit retention',
    cells: ['90 days', '90 days', '7 years (customisable)'],
  },
  {
    feature: 'Tamper-evident audit chain',
    cells: ['✓', '✓', '✓'],
  },
  {
    feature: 'Multi-tenant isolation (schema per tenant)',
    cells: ['✓', '✓', '✓'],
  },
  {
    feature: 'SSO',
    cells: ['—', 'Google · Microsoft · Okta', 'SAML + SCIM'],
  },
  {
    feature: 'SOC 2 report access',
    cells: ['—', 'Type 1', 'Type 1 + Type 2'],
  },
  {
    feature: 'Custom data retention policy',
    cells: ['—', '—', '✓'],
  },
  {
    feature: '24/7 support',
    cells: ['—', '—', '1-hour critical SLA'],
  },
  {
    feature: 'Self-hosted deployment',
    cells: ['—', '—', '✓'],
  },
];
