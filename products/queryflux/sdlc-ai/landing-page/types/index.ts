export interface FormData {
  name: string;
  email: string;
  company: string;
  useCase: string;
  timeline: string;
  message: string;
}

export interface PricingPlan {
  name: string;
  price: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  lemonsqueezyId?: string;
}

export interface Feature {
  title: string;
  description: string;
  icon: string;
  details: string[];
}

export interface Metric {
  label: string;
  value: string;
  description: string;
}

export interface Testimonial {
  name: string;
  role: string;
  company: string;
  content: string;
  avatar: string;
}