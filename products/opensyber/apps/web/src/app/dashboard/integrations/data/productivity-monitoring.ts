import type { Integration } from '../integrations-types';

export const productivityIntegrations: Integration[] = [
  {
    slug: 'microsoft-365', name: 'Microsoft 365 Tenant IQ', category: 'productivity', color: '#0078D4', tier: 'team',
    description: 'Full tenant intelligence — Outlook, SharePoint, OneDrive, Exchange, and Copilot.',
    features: ['Unified audit log ingestion', 'Outlook mail flow rule monitoring', 'SharePoint external sharing alerts', 'OneDrive sync auditing', 'Exchange transport rules', 'Copilot usage analytics', 'Tenant security score correlation'],
    configFields: [
      { key: 'tenantId', label: 'Entra Tenant ID', type: 'text', required: true },
      { key: 'clientId', label: 'Client ID', type: 'text', required: true },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
    ],
    setupSteps: ['Register an App with Office 365 Management APIs permissions', 'Grant ActivityFeed.Read and ActivityFeed.ReadDlp', 'Admin consent required for tenant-wide access', 'OpenSyber polls the Management Activity API every 15 min'],
  },
  {
    slug: 'outlook', name: 'Outlook / Exchange Online', category: 'productivity', color: '#0078D4', tier: 'pro',
    description: 'Monitor email security rules, phishing reports, and Copilot drafts.',
    features: ['Mail flow rule changes', 'Phishing report ingestion', 'Auto-forward alerts', 'Copilot draft audit'],
    configFields: [
      { key: 'tenantId', label: 'Tenant ID', type: 'text', required: true },
      { key: 'clientId', label: 'Client ID', type: 'text', required: true },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
    ],
    setupSteps: ['Register an App with Exchange.ManageAsApp permission', 'Assign Exchange Administrator role to the app', 'Enter credentials below'],
  },
  {
    slug: 'notion', name: 'Notion', category: 'productivity', color: '#FFFFFF', tier: 'pro',
    description: 'Monitor Notion workspace changes, AI usage, and external sharing.',
    features: ['Page change auditing', 'External share detection', 'Notion AI tracking', 'Token activity monitoring'],
    configFields: [{ key: 'notionApiKey', label: 'Integration Token', type: 'password', required: true }],
    setupSteps: ['Create an internal integration at notion.so/my-integrations', 'Copy the token', 'Share relevant pages/databases with the integration', 'Enter token below'],
  },
  {
    slug: 'jira', name: 'Jira', category: 'productivity', color: '#0052CC', tier: 'pro',
    description: 'Auto-create security tickets and track remediation in Jira.',
    features: ['Auto-create tickets', 'Bi-directional sync', 'Custom field mapping', 'Sprint-based tracking'],
    configFields: [
      { key: 'jiraUrl', label: 'Jira Cloud URL', type: 'url', required: true, placeholder: 'https://your-org.atlassian.net' },
      { key: 'jiraEmail', label: 'Email', type: 'text', required: true },
      { key: 'jiraApiToken', label: 'API Token', type: 'password', required: true },
      { key: 'projectKey', label: 'Project Key', type: 'text', required: true },
    ],
    setupSteps: ['Create an API token at id.atlassian.com/manage-profile/security', 'Choose or create a Jira project for security tickets', 'Enter credentials and project key below'],
  },
  {
    slug: 'linear', name: 'Linear', category: 'productivity', color: '#5E6AD2', tier: 'pro',
    description: 'Route security findings to Linear issues with automated triage.',
    features: ['Auto-create issues', 'Priority mapping', 'Team routing', 'Status sync'],
    configFields: [
      { key: 'linearApiKey', label: 'API Key', type: 'password', required: true },
      { key: 'teamId', label: 'Team ID', type: 'text', required: true },
    ],
    setupSteps: ['Generate API key at linear.app/settings/api', 'Find your team ID in team settings', 'Enter both below'],
  },
];

export const monitoringIntegrations: Integration[] = [
  {
    slug: 'datadog', name: 'Datadog', category: 'monitoring', color: '#632CA6', tier: 'pro',
    description: 'Forward events to Datadog and correlate with APM metrics.',
    features: ['Security event forwarding', 'Custom metric publishing', 'Dashboard widgets', 'APM trace correlation'],
    configFields: [
      { key: 'datadogApiKey', label: 'API Key', type: 'password', required: true },
      { key: 'datadogSite', label: 'Site', type: 'select', required: true, options: ['datadoghq.com', 'datadoghq.eu', 'us3.datadoghq.com', 'us5.datadoghq.com'] },
    ],
    setupSteps: ['Create an API key in Datadog → Organization Settings → API Keys', 'Select your Datadog site', 'Events will be forwarded as custom events'],
  },
  {
    slug: 'splunk', name: 'Splunk', category: 'monitoring', color: '#65A637', tier: 'team',
    description: 'Forward security events to Splunk via HEC for SIEM correlation.',
    features: ['HEC forwarding', 'Custom sourcetype routing', 'CIM-compatible formatting', 'Real-time and batch modes'],
    configFields: [
      { key: 'splunkHecUrl', label: 'HEC Endpoint', type: 'url', required: true },
      { key: 'splunkHecToken', label: 'HEC Token', type: 'password', required: true },
      { key: 'splunkIndex', label: 'Index', type: 'text', required: false, placeholder: 'main' },
    ],
    setupSteps: ['Enable HTTP Event Collector in Splunk', 'Create a new HEC token', 'Enter the endpoint URL and token below'],
  },
  {
    slug: 'grafana', name: 'Grafana / Loki', category: 'monitoring', color: '#F46800', tier: 'pro',
    description: 'Push security logs to Grafana Loki and visualize in dashboards.',
    features: ['Loki log pushing', 'Pre-built dashboard JSON', 'AlertManager integration', 'Custom label mapping'],
    configFields: [
      { key: 'lokiUrl', label: 'Loki Push URL', type: 'url', required: true },
      { key: 'lokiUsername', label: 'Username', type: 'text', required: false },
      { key: 'lokiPassword', label: 'Password', type: 'password', required: false },
    ],
    setupSteps: ['Set up Grafana Loki data source', 'Enter the push API URL below', 'Import the OpenSyber dashboard JSON from our docs'],
  },
  {
    slug: 'syslog', name: 'Syslog / SIEM', category: 'monitoring', color: '#8B8B8B', tier: 'team',
    description: 'Forward events via syslog (CEF/LEEF) to any SIEM or log collector.',
    features: ['CEF and LEEF support', 'TCP/UDP/TLS transport', 'Custom severity mapping', 'QRadar, ArcSight, LogRhythm compatible'],
    configFields: [
      { key: 'syslogHost', label: 'Host', type: 'text', required: true },
      { key: 'syslogPort', label: 'Port', type: 'text', required: true, placeholder: '514' },
      { key: 'syslogProtocol', label: 'Protocol', type: 'select', required: true, options: ['TCP', 'UDP', 'TLS'] },
      { key: 'syslogFormat', label: 'Format', type: 'select', required: true, options: ['CEF', 'LEEF', 'RFC5424'] },
    ],
    setupSteps: ['Configure your SIEM to accept syslog on a port', 'Choose transport protocol and message format', 'Enter connection details below'],
  },
];
