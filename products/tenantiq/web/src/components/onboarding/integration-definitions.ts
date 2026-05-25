export interface IntegrationDefinition {
  name: string;
  category: string;
  requiredFields: string[];
}

export const AVAILABLE_INTEGRATIONS: Record<string, IntegrationDefinition> = {
  'azure': {
    name: 'Microsoft Azure',
    category: 'Cloud Provider',
    requiredFields: ['subscription_id', 'tenant_id', 'client_id', 'client_secret']
  },
  'aws': {
    name: 'Amazon AWS',
    category: 'Cloud Provider',
    requiredFields: ['access_key', 'secret_key', 'region']
  },
  'gcp': {
    name: 'Google Cloud Platform',
    category: 'Cloud Provider',
    requiredFields: ['project_id', 'credentials_json']
  },
  'slack': {
    name: 'Slack',
    category: 'Notifications',
    requiredFields: ['webhook_url']
  },
  'pagerduty': {
    name: 'PagerDuty',
    category: 'Incident Management',
    requiredFields: ['api_token', 'service_id']
  },
  'datadog': {
    name: 'Datadog',
    category: 'Monitoring',
    requiredFields: ['api_key', 'app_key']
  },
  'newrelic': {
    name: 'New Relic',
    category: 'Monitoring',
    requiredFields: ['api_key', 'account_id']
  },
  'splunk': {
    name: 'Splunk',
    category: 'Logging',
    requiredFields: ['host', 'port', 'token']
  }
};

export const VALID_SYNC_FREQUENCIES = ['realtime', 'hourly', '6hourly', 'daily'] as const;
