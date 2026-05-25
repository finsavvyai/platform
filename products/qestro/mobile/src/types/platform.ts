export interface Integration {
  id: string;
  name: string;
  type: string;
  status: 'connected' | 'disconnected' | 'error';
  config?: Record<string, unknown>;
  lastSyncAt?: string;
}

export interface NotificationRule {
  id: string;
  name: string;
  event: string;
  channel: string;
  enabled: boolean;
  config?: Record<string, unknown>;
}

export interface BillingPlan {
  id: string;
  name: string;
  price: number;
  interval: 'monthly' | 'yearly';
  features: string[];
}

export interface InsightsOverview {
  passRate: number;
  totalExecutions: number;
  avgDuration: number;
  topFailures: { name: string; count: number }[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export type Theme = 'dark' | 'light';
