import type { IntegrationDefinition } from '../../types/integration.js';

export const entraID: IntegrationDefinition = {
  slug: 'entra-id',
  name: 'Microsoft Entra ID',
  description: 'Monitor identity events, risky sign-ins, and Conditional Access across your tenant.',
  category: 'identity',
  icon: 'microsoft',
  color: '#0078D4',
  tier: 'team',
  docsUrl: '/docs/integrations/entra-id',
  features: [
    'Risky sign-in and user detection',
    'Conditional Access policy monitoring',
    'Service principal activity auditing',
    'App consent grant tracking',
  ],
  configFields: [
    { key: 'tenantId', label: 'Entra Tenant ID', type: 'text', required: true },
    { key: 'clientId', label: 'Client ID', type: 'text', required: true },
    { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
  ],
  webhookSupported: true,
  agentSupported: true,
};

export const oktaIntegration: IntegrationDefinition = {
  slug: 'okta',
  name: 'Okta',
  description: 'Ingest Okta system log events for identity-based threat detection.',
  category: 'identity',
  icon: 'okta',
  color: '#007DC1',
  tier: 'pro',
  docsUrl: '/docs/integrations/okta',
  features: [
    'System log event streaming',
    'Suspicious activity detection',
    'MFA bypass attempt alerts',
    'App assignment change tracking',
  ],
  configFields: [
    { key: 'oktaDomain', label: 'Okta Domain', type: 'url', required: true, placeholder: 'https://your-org.okta.com' },
    { key: 'oktaApiToken', label: 'API Token', type: 'password', required: true },
  ],
  webhookSupported: true,
  agentSupported: false,
};

export const identityIntegrations = [
  entraID, oktaIntegration,
] as const;
