import type { IntegrationDefinition } from '../../types/integration.js';

export const datadogIntegration: IntegrationDefinition = {
  slug: 'datadog',
  name: 'Datadog',
  description: 'Forward OpenSyber events to Datadog and correlate with APM/infrastructure metrics.',
  category: 'monitoring',
  icon: 'datadog',
  color: '#632CA6',
  tier: 'pro',
  docsUrl: '/docs/integrations/datadog',
  features: [
    'Security event forwarding',
    'Custom metric publishing',
    'Dashboard widget integration',
    'APM trace correlation',
  ],
  configFields: [
    { key: 'datadogApiKey', label: 'API Key', type: 'password', required: true },
    { key: 'datadogSite', label: 'Site', type: 'select', required: true, options: ['datadoghq.com', 'datadoghq.eu', 'us3.datadoghq.com', 'us5.datadoghq.com'] },
  ],
  webhookSupported: false,
  agentSupported: false,
};

export const splunkIntegration: IntegrationDefinition = {
  slug: 'splunk',
  name: 'Splunk',
  description: 'Forward security events to Splunk via HEC for SIEM correlation.',
  category: 'monitoring',
  icon: 'splunk',
  color: '#65A637',
  tier: 'team',
  docsUrl: '/docs/integrations/splunk',
  features: [
    'HTTP Event Collector (HEC) forwarding',
    'Custom sourcetype and index routing',
    'CIM-compatible event formatting',
    'Real-time and batch modes',
  ],
  configFields: [
    { key: 'splunkHecUrl', label: 'HEC Endpoint', type: 'url', required: true },
    { key: 'splunkHecToken', label: 'HEC Token', type: 'password', required: true },
    { key: 'splunkIndex', label: 'Index', type: 'text', required: false, placeholder: 'main' },
  ],
  webhookSupported: false,
  agentSupported: false,
};

export const grafanaIntegration: IntegrationDefinition = {
  slug: 'grafana',
  name: 'Grafana / Loki',
  description: 'Push security logs to Grafana Loki and visualize in Grafana dashboards.',
  category: 'monitoring',
  icon: 'grafana',
  color: '#F46800',
  tier: 'pro',
  docsUrl: '/docs/integrations/grafana',
  features: [
    'Loki log pushing via HTTP API',
    'Pre-built Grafana dashboard JSON',
    'AlertManager integration',
    'Custom label mapping',
  ],
  configFields: [
    { key: 'lokiUrl', label: 'Loki Push URL', type: 'url', required: true },
    { key: 'lokiUsername', label: 'Username (optional)', type: 'text', required: false },
    { key: 'lokiPassword', label: 'Password (optional)', type: 'password', required: false },
  ],
  webhookSupported: false,
  agentSupported: false,
};

export const syslogIntegration: IntegrationDefinition = {
  slug: 'syslog',
  name: 'Syslog / SIEM',
  description: 'Forward events via syslog (CEF/LEEF) to any SIEM or log collector.',
  category: 'monitoring',
  icon: 'syslog',
  color: '#8B8B8B',
  tier: 'team',
  docsUrl: '/docs/integrations/syslog',
  features: [
    'CEF and LEEF format support',
    'TCP, UDP, and TLS transport',
    'Custom facility and severity mapping',
    'Compatible with QRadar, ArcSight, LogRhythm',
  ],
  configFields: [
    { key: 'syslogHost', label: 'Host', type: 'text', required: true },
    { key: 'syslogPort', label: 'Port', type: 'text', required: true, placeholder: '514' },
    { key: 'syslogProtocol', label: 'Protocol', type: 'select', required: true, options: ['TCP', 'UDP', 'TLS'] },
    { key: 'syslogFormat', label: 'Format', type: 'select', required: true, options: ['CEF', 'LEEF', 'RFC5424'] },
  ],
  webhookSupported: false,
  agentSupported: false,
};

export const monitoringIntegrations = [
  datadogIntegration, splunkIntegration,
  grafanaIntegration, syslogIntegration,
] as const;
