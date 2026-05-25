import type { IntegrationDefinition } from '../../types/integration.js';

export const m365TenantIQ: IntegrationDefinition = {
  slug: 'microsoft-365',
  name: 'Microsoft 365 Tenant IQ',
  description: 'Full tenant intelligence — Outlook, SharePoint, OneDrive, Exchange, and Copilot activity.',
  category: 'productivity',
  icon: 'microsoft',
  color: '#0078D4',
  tier: 'team',
  docsUrl: '/docs/integrations/microsoft-365',
  features: [
    'Unified audit log ingestion via Management API',
    'Outlook mail flow rule monitoring',
    'SharePoint external sharing alerts',
    'OneDrive sync and sharing auditing',
    'Exchange transport rule changes',
    'Copilot for M365 usage analytics',
    'Tenant security score correlation',
  ],
  configFields: [
    { key: 'tenantId', label: 'Entra Tenant ID', type: 'text', required: true },
    { key: 'clientId', label: 'App Registration Client ID', type: 'text', required: true },
    { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
  ],
  webhookSupported: true,
  agentSupported: true,
};

export const outlookIntegration: IntegrationDefinition = {
  slug: 'outlook',
  name: 'Outlook / Exchange Online',
  description: 'Monitor email security rules, phishing reports, and Copilot drafts in Outlook.',
  category: 'productivity',
  icon: 'outlook',
  color: '#0078D4',
  tier: 'pro',
  docsUrl: '/docs/integrations/outlook',
  features: [
    'Mail flow rule change detection',
    'Phishing report ingestion',
    'Auto-forward rule alerts',
    'Copilot draft audit trail',
  ],
  configFields: [
    { key: 'tenantId', label: 'Entra Tenant ID', type: 'text', required: true },
    { key: 'clientId', label: 'Client ID', type: 'text', required: true },
    { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
  ],
  webhookSupported: true,
  agentSupported: true,
};

export const notionIntegration: IntegrationDefinition = {
  slug: 'notion',
  name: 'Notion',
  description: 'Monitor Notion workspace changes, AI usage, and external sharing.',
  category: 'productivity',
  icon: 'notion',
  color: '#FFFFFF',
  tier: 'pro',
  docsUrl: '/docs/integrations/notion',
  features: [
    'Page and database change auditing',
    'External share link detection',
    'Notion AI usage tracking',
    'Integration token activity monitoring',
  ],
  configFields: [
    { key: 'notionApiKey', label: 'Internal Integration Token', type: 'password', required: true },
  ],
  webhookSupported: false,
  agentSupported: false,
};

export const jiraIntegration: IntegrationDefinition = {
  slug: 'jira',
  name: 'Jira',
  description: 'Create security tickets automatically and track remediation in Jira.',
  category: 'productivity',
  icon: 'jira',
  color: '#0052CC',
  tier: 'pro',
  docsUrl: '/docs/integrations/jira',
  features: [
    'Auto-create tickets for critical findings',
    'Bi-directional status sync',
    'Custom field mapping',
    'Sprint-based remediation tracking',
  ],
  configFields: [
    { key: 'jiraUrl', label: 'Jira Cloud URL', type: 'url', required: true, placeholder: 'https://your-org.atlassian.net' },
    { key: 'jiraEmail', label: 'Email', type: 'text', required: true },
    { key: 'jiraApiToken', label: 'API Token', type: 'password', required: true },
    { key: 'projectKey', label: 'Project Key', type: 'text', required: true },
  ],
  webhookSupported: true,
  agentSupported: false,
};

export const linearIntegration: IntegrationDefinition = {
  slug: 'linear',
  name: 'Linear',
  description: 'Route security findings to Linear issues with automated triage.',
  category: 'productivity',
  icon: 'linear',
  color: '#5E6AD2',
  tier: 'pro',
  docsUrl: '/docs/integrations/linear',
  features: [
    'Auto-create issues from findings',
    'Priority mapping from severity',
    'Team and project routing',
    'Status sync on remediation',
  ],
  configFields: [
    { key: 'linearApiKey', label: 'API Key', type: 'password', required: true },
    { key: 'teamId', label: 'Team ID', type: 'text', required: true },
  ],
  webhookSupported: true,
  agentSupported: false,
};

export const productivityIntegrations = [
  m365TenantIQ, outlookIntegration, notionIntegration,
  jiraIntegration, linearIntegration,
] as const;
