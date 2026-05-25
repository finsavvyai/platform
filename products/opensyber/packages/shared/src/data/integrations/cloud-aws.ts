import type { IntegrationDefinition } from '../../types/integration.js';

export const awsGuardDuty: IntegrationDefinition = {
  slug: 'aws-guardduty',
  name: 'AWS GuardDuty',
  description: 'Ingest GuardDuty findings for AI agent threat detection across your AWS accounts.',
  category: 'cloud',
  icon: 'aws',
  color: '#FF9900',
  tier: 'pro',
  docsUrl: '/docs/integrations/aws-guardduty',
  features: [
    'Real-time threat finding ingestion',
    'Multi-account support via Organizations',
    'Automated severity mapping to OpenSyber scores',
    'S3 malware protection findings',
  ],
  configFields: [
    { key: 'awsAccessKeyId', label: 'Access Key ID', type: 'text', required: true, helpText: 'IAM user with guardduty:Get* and guardduty:List* permissions' },
    { key: 'awsSecretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
    { key: 'awsRegion', label: 'Region', type: 'select', required: true, options: ['us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'ap-southeast-1'] },
  ],
  webhookSupported: true,
  agentSupported: true,
};

export const awsCloudTrail: IntegrationDefinition = {
  slug: 'aws-cloudtrail',
  name: 'AWS CloudTrail',
  description: 'Monitor API activity and detect anomalous AI agent behavior across AWS services.',
  category: 'cloud',
  icon: 'aws',
  color: '#FF9900',
  tier: 'pro',
  docsUrl: '/docs/integrations/aws-cloudtrail',
  features: [
    'API call monitoring for AI-initiated actions',
    'Anomaly detection on IAM operations',
    'Cross-region trail aggregation',
    'Bedrock and SageMaker activity tracking',
  ],
  configFields: [
    { key: 'awsAccessKeyId', label: 'Access Key ID', type: 'text', required: true },
    { key: 'awsSecretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
    { key: 'trailArn', label: 'Trail ARN', type: 'text', required: true, placeholder: 'arn:aws:cloudtrail:...' },
  ],
  webhookSupported: true,
  agentSupported: true,
};

export const awsBedrock: IntegrationDefinition = {
  slug: 'aws-bedrock',
  name: 'AWS Bedrock',
  description: 'Monitor Amazon Bedrock model invocations, guardrails, and agent activity.',
  category: 'cloud',
  icon: 'aws',
  color: '#FF9900',
  tier: 'pro',
  docsUrl: '/docs/integrations/aws-bedrock',
  features: [
    'Model invocation logging and cost tracking',
    'Guardrail violation alerts',
    'Bedrock Agent session monitoring',
    'Prompt injection attempt detection',
  ],
  configFields: [
    { key: 'awsAccessKeyId', label: 'Access Key ID', type: 'text', required: true },
    { key: 'awsSecretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
    { key: 'awsRegion', label: 'Region', type: 'select', required: true, options: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'] },
  ],
  webhookSupported: true,
  agentSupported: true,
};

export const awsCloudWatch: IntegrationDefinition = {
  slug: 'aws-cloudwatch',
  name: 'AWS CloudWatch',
  description: 'Ingest CloudWatch alarms, log anomalies, and metric-based AI agent activity alerts.',
  category: 'cloud',
  icon: 'aws',
  color: '#FF9900',
  tier: 'pro',
  docsUrl: '/docs/integrations/aws-cloudwatch',
  features: [
    'Alarm state change ingestion',
    'Log Insights query forwarding',
    'Anomaly detection alerts',
    'Bedrock & Lambda invocation metrics',
    'Cross-account observability',
  ],
  configFields: [
    { key: 'awsAccessKeyId', label: 'Access Key ID', type: 'text', required: true },
    { key: 'awsSecretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
    { key: 'awsRegion', label: 'Region', type: 'select', required: true, options: ['us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'ap-southeast-1'] },
    { key: 'logGroupArn', label: 'Log Group ARN (optional)', type: 'text', required: false, placeholder: 'arn:aws:logs:...' },
  ],
  webhookSupported: true,
  agentSupported: true,
};

export const awsSecurityHub: IntegrationDefinition = {
  slug: 'aws-security-hub',
  name: 'AWS Security Hub',
  description: 'Aggregate security findings from all AWS services into OpenSyber.',
  category: 'cloud',
  icon: 'aws',
  color: '#FF9900',
  tier: 'team',
  docsUrl: '/docs/integrations/aws-security-hub',
  features: [
    'Consolidated findings from 50+ AWS services',
    'CIS Benchmark compliance mapping',
    'Auto-remediation workflows',
    'Cross-account aggregation',
  ],
  configFields: [
    { key: 'awsAccessKeyId', label: 'Access Key ID', type: 'text', required: true },
    { key: 'awsSecretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
    { key: 'awsRegion', label: 'Region', type: 'select', required: true, options: ['us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1'] },
  ],
  webhookSupported: true,
  agentSupported: true,
};

export const awsIntegrations = [
  awsGuardDuty, awsCloudTrail, awsBedrock, awsCloudWatch, awsSecurityHub,
] as const;
