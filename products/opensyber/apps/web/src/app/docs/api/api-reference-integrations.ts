/** Integrations, connectors, notifications, and API keys */
export const integrationSection = {
  title: 'Integrations',
  description: 'Manage third-party integrations (GitHub, GitLab, etc.)',
  endpoints: [
    {
      method: 'GET',
      path: '/api/integrations',
      auth: 'bearer',
      description: 'List all configured integrations',
      response: { data: 'Integration[]' },
    },
    {
      method: 'POST',
      path: '/api/integrations',
      auth: 'bearer',
      description: 'Create a new integration connection',
      requestBody: { provider: 'string', config: 'object' },
      response: { data: 'Integration' },
    },
    {
      method: 'DELETE',
      path: '/api/integrations/:id',
      auth: 'bearer',
      description: 'Disconnect an integration',
      response: 'null (204)',
    },
    {
      method: 'GET',
      path: '/api/integrations/:id/events',
      auth: 'bearer',
      description: 'List events received from an integration',
      response: { data: 'IntegrationEvent[]' },
    },
    {
      method: 'GET',
      path: '/api/integrations/health',
      auth: 'bearer',
      description: 'Get health status of all integrations',
      response: { data: 'IntegrationHealth[]' },
    },
    {
      method: 'GET',
      path: '/api/integrations/health/:connectionId/events',
      auth: 'bearer',
      description: 'Get health events for a specific connection',
      response: { data: 'HealthEvent[]' },
    },
    {
      method: 'GET',
      path: '/api/integrations/slo',
      auth: 'bearer',
      description: 'SLO dashboard for integration reliability',
      response: { data: 'SloMetrics' },
    },
  ],
} as const;

export const connectorSection = {
  title: 'Connectors',
  description: 'Lightweight integration connectors',
  endpoints: [
    {
      method: 'GET',
      path: '/api/connectors',
      auth: 'bearer',
      description: 'List available connectors',
      response: { data: 'Connector[]' },
    },
    {
      method: 'POST',
      path: '/api/connectors/:slug/install',
      auth: 'bearer',
      description: 'Install a connector',
      requestBody: { config: 'object' },
      response: { data: '{ slug, status }' },
    },
    {
      method: 'DELETE',
      path: '/api/connectors/:slug',
      auth: 'bearer',
      description: 'Uninstall a connector',
      response: 'null (204)',
    },
    {
      method: 'GET',
      path: '/api/connectors/:slug/status',
      auth: 'bearer',
      description: 'Check connector health status',
      response: { data: '{ slug, connected, lastPing }' },
    },
  ],
} as const;

export const notificationSection = {
  title: 'Notification Channels',
  description: 'Configure alert delivery channels',
  endpoints: [
    {
      method: 'GET',
      path: '/api/security/user/notification-channels',
      auth: 'bearer',
      description: 'List user notification channels',
      response: { data: 'NotificationChannel[]' },
    },
    {
      method: 'POST',
      path: '/api/security/user/notification-channels',
      auth: 'bearer',
      description: 'Add a notification channel (Slack, email, PagerDuty, etc.)',
      requestBody: { type: 'string', config: 'object' },
      response: { data: 'NotificationChannel' },
    },
    {
      method: 'DELETE',
      path: '/api/security/user/notification-channels/:id',
      auth: 'bearer',
      description: 'Remove a notification channel',
      response: 'null (204)',
    },
  ],
} as const;

export const apiKeySection = {
  title: 'API Keys',
  description: 'Manage API keys for programmatic access and event ingestion',
  endpoints: [
    {
      method: 'GET',
      path: '/api/keys',
      auth: 'bearer',
      description: 'List API keys (secrets masked)',
      response: { data: 'ApiKey[]' },
    },
    {
      method: 'POST',
      path: '/api/keys',
      auth: 'bearer',
      description: 'Generate a new API key',
      requestBody: { name: 'string', instanceId: 'string?' },
      response: { data: '{ id, key, name }' },
    },
    {
      method: 'DELETE',
      path: '/api/keys/:id',
      auth: 'bearer',
      description: 'Revoke an API key',
      response: 'null (204)',
    },
  ],
} as const;

export const webhookLogSection = {
  title: 'Webhook Logs',
  description: 'View and retry webhook deliveries',
  endpoints: [
    {
      method: 'GET',
      path: '/api/webhooks/logs',
      auth: 'bearer (audit.view)',
      description: 'List webhook delivery logs',
      response: { data: 'WebhookLog[]' },
    },
    {
      method: 'GET',
      path: '/api/webhooks/logs/:id',
      auth: 'bearer (audit.view)',
      description: 'Get webhook log detail',
      response: { data: 'WebhookLog' },
    },
    {
      method: 'POST',
      path: '/api/webhooks/logs/:id/retry',
      auth: 'bearer (audit.view)',
      description: 'Retry a failed webhook delivery',
      response: { data: '{ status, retried }' },
    },
  ],
} as const;
