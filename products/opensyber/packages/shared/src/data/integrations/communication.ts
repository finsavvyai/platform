import type { IntegrationDefinition } from '../../types/integration.js';

export const slackIntegration: IntegrationDefinition = {
  slug: 'slack',
  name: 'Slack',
  description: 'Receive OpenSyber alerts in Slack and monitor Slack bot AI agent activity.',
  category: 'communication',
  icon: 'slack',
  color: '#4A154B',
  tier: 'free',
  docsUrl: '/docs/integrations/slack',
  features: [
    'Alert delivery to channels',
    'Interactive incident response buttons',
    'Slack bot command auditing',
    'AI chatbot activity monitoring',
  ],
  configFields: [
    { key: 'slackWebhookUrl', label: 'Incoming Webhook URL', type: 'url', required: true },
    { key: 'slackBotToken', label: 'Bot Token (optional)', type: 'password', required: false, helpText: 'For monitoring Slack AI bots' },
  ],
  webhookSupported: true,
  agentSupported: true,
};

export const teamsIntegration: IntegrationDefinition = {
  slug: 'microsoft-teams',
  name: 'Microsoft Teams',
  description: 'Send alerts to Teams channels and monitor Teams Copilot interactions.',
  category: 'communication',
  icon: 'teams',
  color: '#6264A7',
  tier: 'free',
  docsUrl: '/docs/integrations/teams',
  features: [
    'Adaptive card alert delivery',
    'Teams Copilot interaction monitoring',
    'Channel bot command auditing',
    'Meeting AI summary tracking',
  ],
  configFields: [
    { key: 'teamsWebhookUrl', label: 'Incoming Webhook URL', type: 'url', required: true },
  ],
  webhookSupported: true,
  agentSupported: true,
};

export const pagerdutyIntegration: IntegrationDefinition = {
  slug: 'pagerduty',
  name: 'PagerDuty',
  description: 'Escalate critical security incidents to PagerDuty on-call.',
  category: 'communication',
  icon: 'pagerduty',
  color: '#06AC38',
  tier: 'pro',
  docsUrl: '/docs/integrations/pagerduty',
  features: [
    'Incident creation from critical alerts',
    'Auto-resolve on remediation',
    'Severity mapping',
    'Service dependency awareness',
  ],
  configFields: [
    { key: 'pagerdutyApiKey', label: 'Events API v2 Key', type: 'password', required: true },
    { key: 'serviceId', label: 'Service ID', type: 'text', required: true },
  ],
  webhookSupported: true,
  agentSupported: false,
};

export const discordIntegration: IntegrationDefinition = {
  slug: 'discord',
  name: 'Discord',
  description: 'Post security alerts and reports to Discord channels via webhooks.',
  category: 'communication',
  icon: 'discord',
  color: '#5865F2',
  tier: 'free',
  docsUrl: '/docs/integrations/discord',
  features: [
    'Rich embed alert messages',
    'Severity-based channel routing',
    'Daily digest summaries',
    'Discord bot AI monitoring',
  ],
  configFields: [
    { key: 'discordWebhookUrl', label: 'Webhook URL', type: 'url', required: true },
  ],
  webhookSupported: true,
  agentSupported: false,
};

export const communicationIntegrations = [
  slackIntegration, teamsIntegration,
  pagerdutyIntegration, discordIntegration,
] as const;
