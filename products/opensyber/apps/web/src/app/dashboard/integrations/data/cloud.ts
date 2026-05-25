import type { Integration } from '../integrations-types';

export const cloudIntegrations: Integration[] = [
  {
    slug: 'aws-guardduty', name: 'AWS GuardDuty', category: 'cloud', color: '#FF9900', tier: 'pro',
    description: 'Ingest GuardDuty findings for AI agent threat detection across AWS accounts.',
    features: ['Real-time threat finding ingestion', 'Multi-account support via Organizations', 'Automated severity mapping', 'S3 malware protection findings'],
    configFields: [
      { key: 'awsAccessKeyId', label: 'Access Key ID', type: 'text', required: true },
      { key: 'awsSecretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
      { key: 'awsRegion', label: 'Region', type: 'select', required: true, options: ['us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'ap-southeast-1'] },
    ],
    setupSteps: ['Create IAM user with guardduty:Get* and guardduty:List* permissions', 'Generate access key pair', 'Enter credentials below', 'OpenSyber will poll findings every 5 minutes'],
  },
  {
    slug: 'aws-cloudtrail', name: 'AWS CloudTrail', category: 'cloud', color: '#FF9900', tier: 'pro',
    description: 'Monitor API activity and detect anomalous AI agent behavior across AWS.',
    features: ['API call monitoring for AI-initiated actions', 'Anomaly detection on IAM operations', 'Cross-region trail aggregation', 'Bedrock & SageMaker tracking'],
    configFields: [
      { key: 'awsAccessKeyId', label: 'Access Key ID', type: 'text', required: true },
      { key: 'awsSecretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
      { key: 'trailArn', label: 'Trail ARN', type: 'text', required: true, placeholder: 'arn:aws:cloudtrail:...' },
    ],
    setupSteps: ['Ensure a CloudTrail trail exists in your account', 'Create IAM user with cloudtrail:LookupEvents permission', 'Paste the Trail ARN and credentials below'],
  },
  {
    slug: 'aws-bedrock', name: 'AWS Bedrock', category: 'cloud', color: '#FF9900', tier: 'pro',
    description: 'Monitor Amazon Bedrock model invocations, guardrails, and agent activity.',
    features: ['Model invocation logging', 'Guardrail violation alerts', 'Agent session monitoring', 'Prompt injection detection'],
    configFields: [
      { key: 'awsAccessKeyId', label: 'Access Key ID', type: 'text', required: true },
      { key: 'awsSecretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
      { key: 'awsRegion', label: 'Region', type: 'select', required: true, options: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'] },
    ],
    setupSteps: ['Enable model invocation logging in Bedrock console', 'Create IAM user with bedrock:Get* permissions', 'Enter credentials below'],
  },
  {
    slug: 'aws-cloudwatch', name: 'AWS CloudWatch', category: 'cloud', color: '#FF9900', tier: 'pro',
    description: 'Ingest CloudWatch alarms, log anomalies, and metric-based AI agent activity alerts.',
    features: ['Alarm state change ingestion', 'Log Insights query forwarding', 'Anomaly detection alerts', 'Bedrock & Lambda invocation metrics', 'Cross-account observability'],
    configFields: [
      { key: 'awsAccessKeyId', label: 'Access Key ID', type: 'text', required: true },
      { key: 'awsSecretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
      { key: 'awsRegion', label: 'Region', type: 'select', required: true, options: ['us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'ap-southeast-1'] },
      { key: 'logGroupArn', label: 'Log Group ARN (optional)', type: 'text', required: false, placeholder: 'arn:aws:logs:...' },
    ],
    setupSteps: ['Create IAM user with cloudwatch:DescribeAlarms, logs:FilterLogEvents, and logs:StartQuery permissions', 'Optionally configure SNS topic to forward alarm state changes to OpenSyber webhook', 'Enter credentials and optionally a log group ARN to watch', 'OpenSyber polls alarms every 5 minutes and runs Log Insights queries hourly'],
  },
  {
    slug: 'aws-security-hub', name: 'AWS Security Hub', category: 'cloud', color: '#FF9900', tier: 'team',
    description: 'Aggregate security findings from all AWS services into OpenSyber.',
    features: ['Consolidated findings from 50+ services', 'CIS Benchmark compliance mapping', 'Auto-remediation workflows', 'Cross-account aggregation'],
    configFields: [
      { key: 'awsAccessKeyId', label: 'Access Key ID', type: 'text', required: true },
      { key: 'awsSecretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
      { key: 'awsRegion', label: 'Region', type: 'select', required: true, options: ['us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1'] },
    ],
    setupSteps: ['Enable Security Hub in your AWS account', 'Enable the standards you want (CIS, PCI, etc.)', 'Create IAM user with securityhub:GetFindings permission', 'Enter credentials below'],
  },
  {
    slug: 'azure-sentinel', name: 'Microsoft Sentinel', category: 'cloud', color: '#0078D4', tier: 'pro',
    description: 'Ingest security alerts and incidents from Azure Sentinel SIEM.',
    features: ['Security incident correlation', 'KQL-based alert rules', 'Entra ID sign-in risk', 'Microsoft 365 Defender integration'],
    configFields: [
      { key: 'tenantId', label: 'Tenant ID', type: 'text', required: true },
      { key: 'clientId', label: 'App Client ID', type: 'text', required: true },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
      { key: 'workspaceId', label: 'Log Analytics Workspace ID', type: 'text', required: true },
    ],
    setupSteps: ['Register an App in Entra ID with SecurityIncident.Read.All permission', 'Create a client secret', 'Find your Log Analytics Workspace ID', 'Enter all credentials below'],
  },
  {
    slug: 'azure-openai', name: 'Azure OpenAI Service', category: 'cloud', color: '#0078D4', tier: 'pro',
    description: 'Monitor Azure OpenAI deployments, content filtering, and usage.',
    features: ['Deployment usage monitoring', 'Content filter trigger alerts', 'Token consumption tracking', 'Model version notifications'],
    configFields: [
      { key: 'azureEndpoint', label: 'Endpoint URL', type: 'url', required: true, placeholder: 'https://your-resource.openai.azure.com' },
      { key: 'azureApiKey', label: 'API Key', type: 'password', required: true },
    ],
    setupSteps: ['Navigate to Azure OpenAI resource in Azure Portal', 'Copy the endpoint URL and API key', 'Enter them below'],
  },
  {
    slug: 'gcp-security-command', name: 'Google Cloud SCC', category: 'cloud', color: '#4285F4', tier: 'pro',
    description: 'Ingest findings from Google Cloud Security Command Center.',
    features: ['Vulnerability findings', 'Vertex AI monitoring', 'IAM anomaly detection', 'GKE workload security'],
    configFields: [
      { key: 'serviceAccountJson', label: 'Service Account JSON', type: 'password', required: true },
      { key: 'organizationId', label: 'Organization ID', type: 'text', required: true },
    ],
    setupSteps: ['Create a service account with securitycenter.findings.list', 'Download the JSON key file', 'Paste its contents below'],
  },
  {
    slug: 'gcp-vertex-ai', name: 'Google Vertex AI', category: 'cloud', color: '#4285F4', tier: 'pro',
    description: 'Monitor Vertex AI model deployments, predictions, and agent builders.',
    features: ['Model prediction logging', 'Agent Builder monitoring', 'Grounding audit trail', 'Cost and quota alerts'],
    configFields: [
      { key: 'serviceAccountJson', label: 'Service Account JSON', type: 'password', required: true },
      { key: 'projectId', label: 'GCP Project ID', type: 'text', required: true },
    ],
    setupSteps: ['Create a service account with aiplatform.endpoints.predict', 'Download JSON key', 'Enter project ID and key below'],
  },
];
