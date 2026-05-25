/**
 * MCP tool definitions for TenantIQ — 15 tools with JSON Schema inputs.
 * Each tool maps to a TenantIQ API endpoint.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  apiMethod: 'GET' | 'POST' | 'PATCH';
  apiPath: string;
}

export const TOOLS: ToolDefinition[] = [
  {
    name: 'tenantiq.list_tenants',
    description: 'List all connected Microsoft 365 tenants',
    inputSchema: { type: 'object', properties: {} },
    apiMethod: 'GET',
    apiPath: '/api/tenants',
  },
  {
    name: 'tenantiq.get_dashboard',
    description: 'Get dashboard metrics for a specific tenant',
    inputSchema: {
      type: 'object',
      properties: { tenantId: { type: 'string', description: 'Tenant ID' } },
      required: ['tenantId'],
    },
    apiMethod: 'GET',
    apiPath: '/api/tenants/:tenantId/dashboard',
  },
  {
    name: 'tenantiq.run_cis_scan',
    description: 'Trigger a CIS benchmark scan for the current tenant',
    inputSchema: { type: 'object', properties: {} },
    apiMethod: 'POST',
    apiPath: '/api/cis-benchmark/scan',
  },
  {
    name: 'tenantiq.get_cis_results',
    description: 'Get the latest CIS benchmark scan results',
    inputSchema: {
      type: 'object',
      properties: { section: { type: 'string', description: 'Filter by CIS section' } },
    },
    apiMethod: 'GET',
    apiPath: '/api/cis-benchmark/results',
  },
  {
    name: 'tenantiq.list_alerts',
    description: 'List security alerts with optional severity filter',
    inputSchema: {
      type: 'object',
      properties: {
        severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
        status: { type: 'string', enum: ['open', 'acknowledged', 'resolved'] },
      },
    },
    apiMethod: 'GET',
    apiPath: '/api/alerts',
  },
  {
    name: 'tenantiq.acknowledge_alert',
    description: 'Acknowledge a security alert by ID',
    inputSchema: {
      type: 'object',
      properties: { alertId: { type: 'string', description: 'Alert ID to acknowledge' } },
      required: ['alertId'],
    },
    apiMethod: 'PATCH',
    apiPath: '/api/alerts/:alertId',
  },
  {
    name: 'tenantiq.create_workflow',
    description: 'Install a workflow from a template',
    inputSchema: {
      type: 'object',
      properties: { templateId: { type: 'string', description: 'Workflow template ID' } },
      required: ['templateId'],
    },
    apiMethod: 'POST',
    apiPath: '/api/workflow-templates/:templateId/install',
  },
  {
    name: 'tenantiq.run_workflow',
    description: 'Execute a workflow by ID',
    inputSchema: {
      type: 'object',
      properties: { workflowId: { type: 'string', description: 'Workflow ID to run' } },
      required: ['workflowId'],
    },
    apiMethod: 'POST',
    apiPath: '/api/workflows/:workflowId/run',
  },
  {
    name: 'tenantiq.get_backup_status',
    description: 'Check backup job status for the current tenant',
    inputSchema: { type: 'object', properties: {} },
    apiMethod: 'GET',
    apiPath: '/api/backups/jobs',
  },
  {
    name: 'tenantiq.start_backup',
    description: 'Start a data backup for the current tenant',
    inputSchema: {
      type: 'object',
      properties: { scope: { type: 'string', enum: ['full', 'exchange', 'sharepoint', 'onedrive'] } },
    },
    apiMethod: 'POST',
    apiPath: '/api/backups/start',
  },
  {
    name: 'tenantiq.sync_psa',
    description: 'Trigger PSA sync with a connected provider',
    inputSchema: {
      type: 'object',
      properties: { provider: { type: 'string', enum: ['connectwise', 'datto', 'kaseya'] } },
      required: ['provider'],
    },
    apiMethod: 'POST',
    apiPath: '/api/integrations/:provider/sync',
  },
  {
    name: 'tenantiq.get_health_score',
    description: 'Get the overall tenant health score',
    inputSchema: { type: 'object', properties: {} },
    apiMethod: 'GET',
    apiPath: '/api/health-score',
  },
  {
    name: 'tenantiq.export_config',
    description: 'Export Microsoft 365 configuration as JSON snapshot',
    inputSchema: { type: 'object', properties: {} },
    apiMethod: 'POST',
    apiPath: '/api/config/export',
  },
  {
    name: 'tenantiq.get_storage',
    description: 'Get storage analytics for OneDrive and SharePoint',
    inputSchema: { type: 'object', properties: {} },
    apiMethod: 'GET',
    apiPath: '/api/storage-analytics',
  },
  {
    name: 'tenantiq.executive_report',
    description: 'Generate an executive summary report',
    inputSchema: {
      type: 'object',
      properties: { format: { type: 'string', enum: ['json', 'pdf'], default: 'json' } },
    },
    apiMethod: 'POST',
    apiPath: '/api/executive-report',
  },
];

/** Look up a tool by name. */
export function findTool(name: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.name === name);
}

/** Return the MCP tools/list response payload. */
export function listToolsPayload(): { tools: Array<{ name: string; description: string; inputSchema: unknown }> } {
  return {
    tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
  };
}
