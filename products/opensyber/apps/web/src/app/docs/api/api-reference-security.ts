/** Security dashboard, events, network, and vulnerability endpoints */
export const securityDashboardSection = {
  title: 'Security Dashboard',
  description: 'Instance-level security monitoring and scoring',
  endpoints: [
    {
      method: 'GET',
      path: '/api/security/instances/:instanceId/dashboard',
      auth: 'bearer',
      description: 'Security dashboard with score, events, and categories',
      response: { data: '{ score, events, categories }' },
    },
    {
      method: 'GET',
      path: '/api/security/instances/:instanceId/events',
      auth: 'bearer',
      description: 'List security events for an instance',
      queryParams: { severity: 'string?', limit: 'number?' },
      response: { data: 'SecurityEvent[]' },
    },
    {
      method: 'GET',
      path: '/api/security/instances/:instanceId/audit',
      auth: 'bearer',
      description: 'Get audit log entries for an instance',
      response: { data: 'AuditEntry[]' },
    },
    {
      method: 'GET',
      path: '/api/security/instances/:instanceId/score-history',
      auth: 'bearer',
      description: 'Get historical security score trend',
      response: { data: 'ScoreEntry[]' },
    },
    {
      method: 'GET',
      path: '/api/security/instances/:instanceId/network-activity',
      auth: 'bearer',
      description: 'Get network connections and traffic data',
      response: { data: 'NetworkActivity[]' },
    },
    {
      method: 'GET',
      path: '/api/security/instances/:instanceId/file-baselines',
      auth: 'bearer',
      description: 'Get file integrity monitoring baselines',
      response: { data: 'FileBaseline[]' },
    },
    {
      method: 'GET',
      path: '/api/security/instances/:instanceId/file-events',
      auth: 'bearer',
      description: 'Get file change events for an instance',
      response: { data: 'FileEvent[]' },
    },
    {
      method: 'GET',
      path: '/api/security/instances/:instanceId/access-log',
      auth: 'bearer',
      description: 'Get access log entries for an instance',
      response: { data: 'AccessLogEntry[]' },
    },
    {
      method: 'GET',
      path: '/api/security/instances/:instanceId/threat-map',
      auth: 'bearer',
      description: 'Get geographic threat origin map data',
      response: { data: 'ThreatMapEntry[]' },
    },
  ],
} as const;

export const vulnerabilitySection = {
  title: 'Vulnerabilities',
  description: 'Vulnerability scanning and management',
  endpoints: [
    {
      method: 'GET',
      path: '/api/security/instances/:instanceId/vulnerability-scans',
      auth: 'bearer',
      description: 'List vulnerability scan results',
      response: { data: 'VulnScan[]' },
    },
    {
      method: 'GET',
      path: '/api/security/instances/:instanceId/vulnerabilities',
      auth: 'bearer',
      description: 'List individual vulnerabilities',
      response: { data: 'Vulnerability[]' },
    },
    {
      method: 'PATCH',
      path: '/api/security/instances/:instanceId/vulnerabilities/:id',
      auth: 'bearer',
      description: 'Update vulnerability status (e.g., mitigated)',
      requestBody: { status: 'string' },
      response: { data: 'Vulnerability' },
    },
  ],
} as const;

export const alertSection = {
  title: 'Alerts & Alert Rules',
  description: 'Configure and manage security alert rules',
  endpoints: [
    {
      method: 'GET',
      path: '/api/security/instances/:instanceId/alert-rules',
      auth: 'bearer',
      description: 'List alert rules for an instance',
      response: { data: 'AlertRule[]' },
    },
    {
      method: 'POST',
      path: '/api/security/instances/:instanceId/alert-rules',
      auth: 'bearer (alert.create)',
      description: 'Create a new alert rule',
      requestBody: { name: 'string', condition: 'string', severity: 'string' },
      response: { data: 'AlertRule' },
    },
    {
      method: 'PATCH',
      path: '/api/security/instances/:instanceId/alert-rules/:id',
      auth: 'bearer (alert.update)',
      description: 'Update an alert rule',
      response: { data: 'AlertRule' },
    },
    {
      method: 'DELETE',
      path: '/api/security/instances/:instanceId/alert-rules/:id',
      auth: 'bearer (alert.delete)',
      description: 'Delete an alert rule',
      response: 'null (204)',
    },
    {
      method: 'GET',
      path: '/api/security/instances/:instanceId/alerts',
      auth: 'bearer',
      description: 'List triggered alerts for an instance',
      response: { data: 'Alert[]' },
    },
    {
      method: 'PATCH',
      path: '/api/security/instances/:instanceId/alerts/:id',
      auth: 'bearer (alert.update)',
      description: 'Acknowledge or resolve an alert',
      requestBody: { status: 'string' },
      response: { data: 'Alert' },
    },
  ],
} as const;

