/** Multi-cloud + SaaS posture endpoints */
export const multiCloudSection = {
  title: 'Multi-Cloud',
  description: 'Multi-cloud configuration and aggregation',
  endpoints: [
    {
      method: 'GET',
      path: '/api/cloud/configs',
      auth: 'bearer',
      description: 'List multi-cloud configurations',
      response: { data: 'MultiCloudConfig[]' },
    },
    {
      method: 'POST',
      path: '/api/cloud/configs',
      auth: 'bearer (cloud.write)',
      description: 'Create a multi-cloud config',
      response: { data: 'MultiCloudConfig' },
    },
    {
      method: 'DELETE',
      path: '/api/cloud/configs/:id',
      auth: 'bearer (cloud.write)',
      description: 'Delete a multi-cloud config',
      response: 'null (204)',
    },
    {
      method: 'GET',
      path: '/api/cloud/regions/:provider',
      auth: 'bearer',
      description: 'List available regions for a cloud provider',
      response: { data: 'Region[]' },
    },
    {
      method: 'GET',
      path: '/api/cloud/aggregate',
      auth: 'bearer',
      description: 'Aggregated view across all cloud accounts',
      response: { data: '{ accounts, totalFindings, riskScore }' },
    },
  ],
} as const;

export const saasSection = {
  title: 'SaaS Security',
  description: 'SaaS account and OAuth app monitoring',
  endpoints: [
    {
      method: 'GET',
      path: '/api/saas/accounts',
      auth: 'bearer',
      description: 'List monitored SaaS accounts',
      response: { data: 'SaasAccount[]' },
    },
    {
      method: 'POST',
      path: '/api/saas/accounts',
      auth: 'bearer',
      description: 'Add a SaaS account to monitor',
      response: { data: 'SaasAccount' },
    },
    {
      method: 'DELETE',
      path: '/api/saas/accounts/:id',
      auth: 'bearer',
      description: 'Remove a SaaS account',
      response: 'null (204)',
    },
    {
      method: 'GET',
      path: '/api/saas/oauth-apps',
      auth: 'bearer',
      description: 'List OAuth applications with access',
      response: { data: 'OAuthApp[]' },
    },
    {
      method: 'GET',
      path: '/api/saas/oauth-apps/agents',
      auth: 'bearer',
      description: 'List agent-specific OAuth apps',
      response: { data: 'OAuthApp[]' },
    },
    {
      method: 'GET',
      path: '/api/saas/oauth-risk',
      auth: 'bearer',
      description: 'Get OAuth risk assessment',
      response: { data: '{ riskScore, risky }' },
    },
    {
      method: 'POST',
      path: '/api/saas/oauth-apps',
      auth: 'bearer',
      description: 'Register a new OAuth app',
      response: { data: 'OAuthApp' },
    },
  ],
} as const;
