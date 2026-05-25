/** Agent reports, secret access logs, and NHI endpoints */
export const agentReportSection = {
  title: 'Agent Reports',
  description: 'Generate and download security reports',
  endpoints: [
    {
      method: 'POST',
      path: '/api/agents/reports/generate',
      auth: 'bearer (agent.policy.read, pdfReports plan)',
      description: 'Generate a PDF security report',
      requestBody: { type: 'string', dateRange: 'object?' },
      response: { data: '{ reportId, status }' },
    },
    {
      method: 'GET',
      path: '/api/agents/reports',
      auth: 'bearer (agent.policy.read)',
      description: 'List generated reports',
      response: { data: 'Report[]' },
    },
    {
      method: 'GET',
      path: '/api/agents/reports/:id/download',
      auth: 'bearer (agent.policy.read)',
      description: 'Download a generated report',
      response: 'File download (PDF)',
    },
  ],
} as const;

export const agentSecretAccessSection = {
  title: 'Agent Secret Access',
  description: 'Track which agents access which secrets',
  endpoints: [
    {
      method: 'GET',
      path: '/api/agents/secret-access',
      auth: 'bearer',
      description: 'List all agent secret access records',
      response: { data: 'SecretAccessRecord[]' },
    },
    {
      method: 'GET',
      path: '/api/agents/secret-access/:agentId',
      auth: 'bearer',
      description: 'Get secret access for a specific agent',
      response: { data: 'SecretAccessRecord[]' },
    },
    {
      method: 'POST',
      path: '/api/agents/secret-access',
      auth: 'bearer',
      description: 'Log a secret access event',
      requestBody: { agentId: 'string', secretKey: 'string', action: 'string' },
      response: { data: 'SecretAccessRecord' },
    },
  ],
} as const;

export const nhiSection = {
  title: 'NHI Manager',
  description: 'Non-human identity lifecycle management',
  endpoints: [
    {
      method: 'GET',
      path: '/api/nhi/agents',
      auth: 'bearer',
      description: 'List all non-human identities',
      response: { data: 'NhiAgent[]' },
    },
    {
      method: 'GET',
      path: '/api/nhi/agents/orphaned',
      auth: 'bearer',
      description: 'List orphaned NHIs without active owners',
      response: { data: 'NhiAgent[]' },
    },
    {
      method: 'GET',
      path: '/api/nhi/agents/summary',
      auth: 'bearer',
      description: 'Get NHI inventory summary',
      response: { data: '{ total, active, suspended, orphaned }' },
    },
    {
      method: 'POST',
      path: '/api/nhi/agents',
      auth: 'bearer',
      description: 'Register a new non-human identity',
      requestBody: { name: 'string', type: 'string' },
      response: { data: 'NhiAgent' },
    },
    {
      method: 'PATCH',
      path: '/api/nhi/agents/:id',
      auth: 'bearer',
      description: 'Update NHI metadata',
      response: { data: 'NhiAgent' },
    },
    {
      method: 'POST',
      path: '/api/nhi/agents/:id/suspend',
      auth: 'bearer',
      description: 'Suspend a non-human identity',
      response: { data: '{ status: suspended }' },
    },
  ],
} as const;
