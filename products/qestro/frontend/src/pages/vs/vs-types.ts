export type CellValue = 'yes' | 'no' | 'partial';

export interface FeatureRow {
  feature: string;
  qestro: CellValue;
  competitor: CellValue;
  note?: string;
}

export interface PricingTier {
  tier: string;
  price: string;
  seats?: string;
  notes: string;
}

export interface VsPageData {
  slug: 'cypress' | 'playwright' | 'testim';
  competitor: string;
  tagline: string;
  hero: {
    chooseQestro: string;
    chooseCompetitor: string;
    bothGreat: string;
  };
  features: FeatureRow[];
  pricing: {
    qestro: PricingTier[];
    competitor: PricingTier[];
  };
  wins: {
    qestroParagraphs: string[];
    competitorParagraph: string;
  };
  seo: {
    title: string;
    description: string;
    canonical: string;
  };
}

export const QESTRO_PRICING: PricingTier[] = [
  { tier: 'Free', price: '$0', seats: 'Unlimited devs', notes: '5 projects, 100 runs/mo. No credit card.' },
  { tier: 'Starter', price: '$99/mo', seats: 'Unlimited devs', notes: '50 projects, 5K runs/mo, browser + mobile + API.' },
  { tier: 'Pro', price: '$499/mo', seats: 'Unlimited devs', notes: '500 projects, 50K runs/mo, CI/CD + self-healing.' },
  { tier: 'Enterprise', price: 'Contact', notes: 'SSO/SAML, on-prem option, custom SLAs.' },
];
