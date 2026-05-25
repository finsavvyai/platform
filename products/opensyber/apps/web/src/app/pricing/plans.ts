export type PlanKey = 'free' | 'team' | 'professional' | 'enterprise' | 'mission_defender';

export interface PlanData {
  name: string;
  planKey: PlanKey;
  price: number;
  annualPrice: number;
  description: string;
  features: string[];
  cta: string;
  popular: boolean;
  contactSales: boolean;
}

/** Annual = 20% discount */
export const ANNUAL_DISCOUNT_PERCENT = 20;

function annualFromMonthly(monthly: number): number {
  return Math.round(monthly * 12 * 0.8);
}

export const plans: PlanData[] = [
  {
    name: 'Starter Shield', planKey: 'free', price: 0, annualPrice: 0,
    popular: false, contactSales: false,
    description: 'Because we\'d rather you have some protection than none. Forever free — no trial clock.',
    cta: 'Get Started Free',
    features: [
      '1 AI agent (forever)',
      '3 skills: Secret Scanner, Git Guardian, Dependency Auditor',
      'Save ~5 hours/month vs manual scanning',
      'Auto-patching (same-day CVEs)',
      'Encrypted credential vault',
      'Basic security dashboard',
      '3-day audit log retention',
      'Community support',
    ],
  },
  {
    name: 'Team', planKey: 'team', price: 299, annualPrice: annualFromMonthly(299),
    popular: true, contactSales: false,
    description: 'Save 40+ hours/month. Would have caught the Trivy attack in 340ms — not after $4.88M.',
    cta: 'Start Free Trial',
    features: [
      '3 AI agents (covers dev/staging/prod)',
      'All 47 skills + 3 skill bundles',
      'GitHub App — unlimited repos',
      'Slack, Discord, Teams + email alerts',
      'Full security dashboard + attack paths',
      '30-day audit log retention',
      'Email support (24h SLA)',
      'Typical ROI: 60x the cost in engineer hours',
    ],
  },
  {
    name: 'Professional', planKey: 'professional', price: 799,
    annualPrice: annualFromMonthly(799), popular: false, contactSales: false,
    description: 'Cut SOC 2 audit prep from 6 weeks to 3 days. 1-year log retention keeps your auditors happy.',
    cta: 'Start Free Trial',
    features: [
      '10 AI agents (multi-region ready)',
      'All skills + all bundles + AI assistant',
      'SOC 2, ISO 27001, HIPAA, GDPR auto-evidence',
      'PagerDuty + SIEM + OpsGenie integrations',
      '1-year audit log retention',
      'Priority support (4h SLA)',
      'Role-based access control (RBAC)',
      'TokenForge Cloud included ($99/mo value)',
    ],
  },
  {
    name: 'Enterprise', planKey: 'enterprise', price: 2499,
    annualPrice: annualFromMonthly(2499), popular: false, contactSales: true,
    description: 'For orgs that decided "hope" is not a security strategy',
    cta: 'Contact Sales',
    features: [
      'Unlimited agents', 'SAML / OIDC SSO', 'Custom data residency',
      'Custom SLA', '5-year audit log retention', 'Dedicated account manager',
      'Admin panel + provisioning', 'Data export (GDPR)',
      'TokenForge Enterprise included',
    ],
  },
  {
    name: 'Mission Defender', planKey: 'mission_defender', price: 9999,
    annualPrice: annualFromMonthly(9999), popular: false, contactSales: true,
    description: 'For when the board asks "what are we doing about AI security?" and you need a real answer',
    cta: 'Contact Sales',
    features: [
      'Everything in Enterprise', 'Dedicated security engineer (10h/mo)',
      'Weekly threat briefing', '24/7 incident response',
      'Red team exercises (quarterly)', 'Board-ready security reports',
      'Custom skill development', 'Executive security reviews',
      'TokenForge Enterprise included',
    ],
  },
];

export const breachStats = [
  { value: '$4.88M', label: 'Avg breach cost. Per incident.', source: 'IBM' },
  { value: '$7.2M', label: 'Avg supply chain attack. Ouch.', source: 'Ponemon' },
  { value: '204 days', label: 'Detection without monitoring. Days.', source: '' },
  { value: '340ms', label: 'Detection with OpenSyber. Ms.', source: '' },
];
