/** Rule packs, uptime tracking, and DLQ admin endpoints */
export const rulePackSection = {
  title: 'Rule Packs',
  description: 'Pre-built security rule pack management',
  endpoints: [
    {
      method: 'GET',
      path: '/api/rule-packs',
      auth: 'bearer',
      description: 'List available rule packs',
      response: { data: 'RulePack[]' },
    },
    {
      method: 'POST',
      path: '/api/rule-packs/install',
      auth: 'bearer (policy.create)',
      description: 'Install a rule pack on an instance',
      requestBody: { packId: 'string', instanceId: 'string' },
      response: { data: '{ installed }' },
    },
    {
      method: 'GET',
      path: '/api/rule-packs/instances/:instanceId/active-packs',
      auth: 'bearer',
      description: 'List active rule packs for an instance',
      response: { data: 'RulePack[]' },
    },
  ],
} as const;

export const uptimeSection = {
  title: 'Uptime Monitoring',
  description: 'Instance uptime tracking',
  endpoints: [
    {
      method: 'GET',
      path: '/api/security/uptime/:instanceId',
      auth: 'bearer',
      description: 'Get uptime percentage and status',
      response: { data: '{ uptime, status, checks }' },
    },
    {
      method: 'GET',
      path: '/api/security/uptime/:instanceId/events',
      auth: 'bearer',
      description: 'List uptime events (downtimes)',
      response: { data: 'UptimeEvent[]' },
    },
  ],
} as const;

export const dlqSection = {
  title: 'Dead Letter Queue',
  description: 'Monitor and retry failed webhook deliveries',
  endpoints: [
    {
      method: 'GET',
      path: '/api/dlq',
      auth: 'bearer',
      description: 'List dead letter queue entries',
      response: { data: 'DlqEntry[]' },
    },
    {
      method: 'POST',
      path: '/api/dlq/:id/retry',
      auth: 'bearer',
      description: 'Retry a failed message',
      response: { data: '{ retried }' },
    },
    {
      method: 'DELETE',
      path: '/api/dlq/:id',
      auth: 'bearer',
      description: 'Discard a dead letter entry',
      response: 'null (204)',
    },
    {
      method: 'GET',
      path: '/api/dlq/stats',
      auth: 'bearer',
      description: 'Get DLQ statistics',
      response: { data: '{ pending, retried, discarded }' },
    },
  ],
} as const;
