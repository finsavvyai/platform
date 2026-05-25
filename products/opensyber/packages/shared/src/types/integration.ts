// ─── Integration Types ──────────────────────────────────────────────────────

export type IntegrationCategory =
  | 'cloud'
  | 'ide'
  | 'ai-agent'
  | 'devops'
  | 'communication'
  | 'identity'
  | 'monitoring'
  | 'productivity';

export type IntegrationStatus =
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'pending';

export interface IntegrationDefinition {
  slug: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  icon: string;
  color: string;
  tier: 'free' | 'pro' | 'team';
  docsUrl: string;
  features: string[];
  configFields: IntegrationConfigField[];
  webhookSupported: boolean;
  agentSupported: boolean;
}

export interface IntegrationConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'select';
  placeholder?: string;
  required: boolean;
  options?: string[];
  helpText?: string;
}

export interface IntegrationConnection {
  id: string;
  userId: string;
  instanceId: string;
  integrationSlug: string;
  status: IntegrationStatus;
  lastSyncAt: string | null;
  eventsReceived: number;
  createdAt: string;
}

export const INTEGRATION_CATEGORY_LABELS: Record<
  IntegrationCategory,
  string
> = {
  cloud: 'Cloud Providers',
  ide: 'IDEs & Editors',
  'ai-agent': 'AI Agents & Copilots',
  devops: 'DevOps & CI/CD',
  communication: 'Communication',
  identity: 'Identity & Access',
  monitoring: 'Monitoring & Observability',
  productivity: 'Productivity & SaaS',
};
