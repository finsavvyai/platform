/**
 * Connector Registry
 *
 * Static registry of platform connectors: splunk, datadog, elastic, jira,
 * servicenow, pagerduty. Provides lookup, listing, and config validation.
 */
import type { ConnectorDefinition, ConnectorCategory, ConnectorConfigField } from '@opensyber/shared';

export interface RegistryConnector {
  slug: string;
  name: string;
  category: ConnectorCategory;
  version: string;
  description: string;
  configSchema: ConnectorConfigField[];
  webhookUrlPattern: string;
}

const CONNECTORS: RegistryConnector[] = [
  {
    slug: 'splunk', name: 'Splunk', category: 'monitoring', version: '1.0.0',
    description: 'Forward security events to Splunk HEC.',
    webhookUrlPattern: 'https://{host}:8088/services/collector',
    configSchema: [
      { key: 'host', label: 'Splunk Host', type: 'url', required: true, placeholder: 'https://splunk.example.com' },
      { key: 'hecToken', label: 'HEC Token', type: 'password', required: true, helpText: 'HTTP Event Collector token' },
      { key: 'index', label: 'Index', type: 'text', required: false, placeholder: 'main' },
    ],
  },
  {
    slug: 'datadog', name: 'Datadog', category: 'monitoring', version: '1.0.0',
    description: 'Send metrics and events to Datadog.',
    webhookUrlPattern: 'https://http-intake.logs.datadoghq.com/api/v2/logs',
    configSchema: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      { key: 'site', label: 'Site', type: 'select', required: true, options: ['datadoghq.com', 'datadoghq.eu', 'us3.datadoghq.com'] },
    ],
  },
  {
    slug: 'elastic', name: 'Elastic Security', category: 'monitoring', version: '1.0.0',
    description: 'Push findings to Elasticsearch / Elastic SIEM.',
    webhookUrlPattern: 'https://{host}:9200/_bulk',
    configSchema: [
      { key: 'host', label: 'Elasticsearch URL', type: 'url', required: true },
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      { key: 'indexPrefix', label: 'Index Prefix', type: 'text', required: false, placeholder: 'opensyber-' },
    ],
  },
  {
    slug: 'jira', name: 'Jira', category: 'devops', version: '1.0.0',
    description: 'Create Jira issues from security findings.',
    webhookUrlPattern: 'https://{domain}.atlassian.net/rest/api/3/issue',
    configSchema: [
      { key: 'domain', label: 'Jira Domain', type: 'text', required: true, placeholder: 'your-org' },
      { key: 'email', label: 'Email', type: 'text', required: true },
      { key: 'apiToken', label: 'API Token', type: 'password', required: true },
      { key: 'projectKey', label: 'Project Key', type: 'text', required: true, placeholder: 'SEC' },
    ],
  },
  {
    slug: 'servicenow', name: 'ServiceNow', category: 'devops', version: '1.0.0',
    description: 'Create ServiceNow incidents from security alerts.',
    webhookUrlPattern: 'https://{instance}.service-now.com/api/now/table/incident',
    configSchema: [
      { key: 'instance', label: 'Instance Name', type: 'text', required: true },
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
    ],
  },
  {
    slug: 'pagerduty', name: 'PagerDuty', category: 'communication', version: '1.0.0',
    description: 'Trigger PagerDuty incidents for critical findings.',
    webhookUrlPattern: 'https://events.pagerduty.com/v2/enqueue',
    configSchema: [
      { key: 'routingKey', label: 'Integration Key', type: 'password', required: true, helpText: 'Events API v2 routing key' },
      { key: 'severity', label: 'Default Severity', type: 'select', required: false, options: ['info', 'warning', 'error', 'critical'] },
    ],
  },
];

/** Get a connector by slug. */
export function getConnector(slug: string): RegistryConnector | undefined {
  return CONNECTORS.find((c) => c.slug === slug);
}

/** List all available connectors, optionally filtered by category. */
export function listConnectors(category?: ConnectorCategory): RegistryConnector[] {
  if (category) return CONNECTORS.filter((c) => c.category === category);
  return [...CONNECTORS];
}

/** Validate config values against a connector's schema. */
export function validateConfig(
  slug: string,
  config: Record<string, unknown>,
): { valid: boolean; errors: string[] } {
  const connector = getConnector(slug);
  if (!connector) return { valid: false, errors: [`Unknown connector: ${slug}`] };

  const errors: string[] = [];
  for (const field of connector.configSchema) {
    if (field.required && !config[field.key]) {
      errors.push(`${field.label} is required`);
    }
    if (field.type === 'select' && config[field.key] && field.options) {
      if (!field.options.includes(config[field.key] as string)) {
        errors.push(`${field.label} must be one of: ${field.options.join(', ')}`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}
