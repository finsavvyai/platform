/** Data export, ingestion, cost, rule packs, uptime, and DLQ endpoints */
export const dataExportSection = {
  title: 'Data Export (GDPR)',
  description: 'Export user and organization data for compliance',
  endpoints: [
    {
      method: 'GET',
      path: '/api/export/agents',
      auth: 'bearer (audit.export)',
      description: 'Export all agent data',
      response: 'JSON download',
    },
    {
      method: 'GET',
      path: '/api/export/findings',
      auth: 'bearer (audit.export)',
      description: 'Export all security findings',
      response: 'JSON download',
    },
    {
      method: 'GET',
      path: '/api/export/compliance',
      auth: 'bearer (audit.export)',
      description: 'Export compliance data',
      response: 'JSON download',
    },
    {
      method: 'GET',
      path: '/api/export/assets',
      auth: 'bearer (audit.export)',
      description: 'Export asset inventory',
      response: 'JSON download',
    },
  ],
} as const;

export const ingestSection = {
  title: 'Event Ingestion',
  description: 'Ingest security events via API key authentication',
  endpoints: [
    {
      method: 'POST',
      path: '/api/ingest',
      auth: 'api-key',
      description: 'Ingest a single security event',
      requestBody: { type: 'string', severity: 'string', details: 'object' },
      response: { data: '{ eventId }' },
    },
    {
      method: 'POST',
      path: '/api/ingest/batch',
      auth: 'api-key',
      description: 'Batch ingest multiple security events',
      requestBody: { events: 'object[]' },
      response: { data: '{ ingested: number }' },
    },
    {
      method: 'POST',
      path: '/api/otel',
      auth: 'none',
      description: 'OpenTelemetry trace ingestion endpoint',
      requestBody: 'OTLP trace payload',
      response: '{ traces: number }',
    },
    {
      method: 'GET',
      path: '/api/otel/traces',
      auth: 'none',
      description: 'Query ingested OpenTelemetry traces',
      response: { data: 'Trace[]' },
    },
  ],
} as const;

export const costSection = {
  title: 'Cost Bomb Protection',
  description: 'Monitor and control AI agent spending',
  endpoints: [
    {
      method: 'POST',
      path: '/api/costs/ingest',
      auth: 'bearer',
      description: 'Ingest cost events from agent runs',
      requestBody: { events: 'CostEvent[]' },
      response: { data: '{ ingested: number }' },
    },
    {
      method: 'GET',
      path: '/api/costs/summary',
      auth: 'bearer',
      description: 'Get cost summary with budget rule evaluation',
      response: { data: '{ total, byProvider, alerts }' },
    },
    {
      method: 'GET',
      path: '/api/costs/events',
      auth: 'bearer',
      description: 'List cost events with filtering',
      queryParams: { from: 'ISO date?', to: 'ISO date?' },
      response: { data: 'CostEvent[]' },
    },
    {
      method: 'POST',
      path: '/api/costs/budgets',
      auth: 'bearer',
      description: 'Create a budget rule',
      requestBody: { name: 'string', limit: 'number', period: 'string' },
      response: { data: 'BudgetRule' },
    },
    {
      method: 'GET',
      path: '/api/costs/budgets',
      auth: 'bearer',
      description: 'List budget rules',
      response: { data: 'BudgetRule[]' },
    },
    {
      method: 'DELETE',
      path: '/api/costs/budgets/:id',
      auth: 'bearer',
      description: 'Delete a budget rule',
      response: 'null (204)',
    },
  ],
} as const;

