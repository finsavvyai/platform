/** Kill chain, remediation, MCP, and supply chain endpoints */
export const killChainSection = {
  title: 'Kill Chain Analysis',
  description: 'AI-powered attack kill chain detection',
  endpoints: [
    {
      method: 'GET',
      path: '/api/kill-chain/rules',
      auth: 'bearer',
      description: 'List kill chain detection rules',
      response: { data: 'KillChainRule[]' },
    },
    {
      method: 'GET',
      path: '/api/kill-chain/incidents',
      auth: 'bearer (alert.read)',
      description: 'List detected kill chain incidents',
      response: { data: 'KillChainIncident[]' },
    },
    {
      method: 'POST',
      path: '/api/kill-chain/evaluate',
      auth: 'bearer (alert.read)',
      description: 'Evaluate events against kill chain rules',
      requestBody: { events: 'SecurityEvent[]' },
      response: { data: '{ matches, incidents }' },
    },
  ],
} as const;

export const remediationSection = {
  title: 'Remediation',
  description: 'Automated remediation playbooks and execution',
  endpoints: [
    {
      method: 'GET',
      path: '/api/remediation/playbooks',
      auth: 'bearer',
      description: 'List remediation playbooks',
      response: { data: 'Playbook[]' },
    },
    {
      method: 'POST',
      path: '/api/remediation/playbooks',
      auth: 'bearer (policy.create)',
      description: 'Create a remediation playbook',
      requestBody: { name: 'string', steps: 'Step[]', trigger: 'object' },
      response: { data: 'Playbook' },
    },
    {
      method: 'DELETE',
      path: '/api/remediation/playbooks/:id',
      auth: 'bearer (policy.delete)',
      description: 'Delete a playbook',
      response: 'null (204)',
    },
    {
      method: 'GET',
      path: '/api/remediation/runs',
      auth: 'bearer',
      description: 'List remediation run history',
      response: { data: 'RemediationRun[]' },
    },
    {
      method: 'POST',
      path: '/api/remediation/runs',
      auth: 'bearer (policy.create)',
      description: 'Trigger a manual remediation run',
      requestBody: { playbookId: 'string', findingId: 'string?' },
      response: { data: 'RemediationRun' },
    },
    {
      method: 'POST',
      path: '/api/remediation/runs/auto-trigger',
      auth: 'bearer (policy.create)',
      description: 'Process auto-trigger rules for pending findings',
      response: { data: '{ triggered: number }' },
    },
    {
      method: 'GET',
      path: '/api/remediation/runs/:id',
      auth: 'bearer',
      description: 'Get remediation run detail and logs',
      response: { data: 'RemediationRun' },
    },
  ],
} as const;

export const mcpSection = {
  title: 'MCP Monitoring & Guardian',
  description: 'Monitor and secure MCP server connections',
  endpoints: [
    {
      method: 'GET',
      path: '/api/mcp',
      auth: 'bearer',
      description: 'List MCP server monitoring data',
      response: { data: 'McpServer[]' },
    },
    {
      method: 'POST',
      path: '/api/mcp/invocations',
      auth: 'bearer',
      description: 'Track an MCP tool invocation',
      requestBody: { serverId: 'string', tool: 'string', result: 'object' },
      response: { data: 'Invocation' },
    },
    {
      method: 'GET',
      path: '/api/mcp/alerts',
      auth: 'bearer',
      description: 'List MCP security alerts',
      response: { data: 'McpAlert[]' },
    },
    {
      method: 'POST',
      path: '/api/mcp/scan',
      auth: 'bearer',
      description: 'Scan MCP server configuration for vulnerabilities',
      requestBody: { serverConfig: 'object' },
      response: { data: '{ findings, riskScore }' },
    },
    {
      method: 'POST',
      path: '/api/mcp/guardian/scan',
      auth: 'bearer',
      description: 'Deep scan an MCP server for supply chain risks',
      requestBody: { serverName: 'string', config: 'object' },
      response: { data: 'ScanResult' },
    },
    {
      method: 'GET',
      path: '/api/mcp/guardian/servers',
      auth: 'bearer',
      description: 'List MCP servers with trust status',
      response: { data: 'GuardianServer[]' },
    },
    {
      method: 'POST',
      path: '/api/mcp/guardian/servers/:id/quarantine',
      auth: 'bearer',
      description: 'Quarantine a suspicious MCP server',
      response: { data: '{ status: quarantined }' },
    },
  ],
} as const;

export const supplyChainSection = {
  title: 'Supply Chain Security',
  description: 'Dependency and supply chain scanning',
  endpoints: [
    {
      method: 'GET',
      path: '/api/supply-chain/status',
      auth: 'bearer',
      description: 'Get supply chain security status overview',
      response: { data: '{ score, issues }' },
    },
    {
      method: 'POST',
      path: '/api/supply-chain/scan-skill',
      auth: 'bearer',
      description: 'Scan a skill package for supply chain risks',
      requestBody: { skillId: 'string' },
      response: { data: 'ScanResult' },
    },
    {
      method: 'POST',
      path: '/api/supply-chain/scan-mcp',
      auth: 'bearer',
      description: 'Scan an MCP server for supply chain risks',
      requestBody: { serverConfig: 'object' },
      response: { data: 'ScanResult' },
    },
  ],
} as const;
