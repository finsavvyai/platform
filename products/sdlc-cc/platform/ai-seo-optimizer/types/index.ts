export interface Feature {
  title: string;
  description: string;
  icon: string;
  details: string[];
}

export interface PricingPlan {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
}

export interface Metric {
  label: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export interface Step {
  number: string;
  title: string;
  description: string;
  icon: string;
}
