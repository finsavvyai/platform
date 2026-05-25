import type { IntegrationDefinition } from '../../types/integration.js';
import { awsIntegrations } from './cloud-aws.js';

export { awsGuardDuty, awsCloudTrail, awsBedrock, awsCloudWatch, awsSecurityHub } from './cloud-aws.js';

export const azureSentinel: IntegrationDefinition = {
  slug: 'azure-sentinel',
  name: 'Microsoft Sentinel',
  description: 'Ingest security alerts and incidents from Azure Sentinel SIEM.',
  category: 'cloud',
  icon: 'azure',
  color: '#0078D4',
  tier: 'pro',
  docsUrl: '/docs/integrations/azure-sentinel',
  features: [
    'Security incident correlation',
    'KQL query-based alert rules',
    'Entra ID sign-in risk ingestion',
    'Microsoft 365 Defender integration',
  ],
  configFields: [
    { key: 'tenantId', label: 'Tenant ID', type: 'text', required: true },
    { key: 'clientId', label: 'App Client ID', type: 'text', required: true },
    { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
    { key: 'workspaceId', label: 'Log Analytics Workspace ID', type: 'text', required: true },
  ],
  webhookSupported: true,
  agentSupported: true,
};

export const azureOpenAI: IntegrationDefinition = {
  slug: 'azure-openai',
  name: 'Azure OpenAI Service',
  description: 'Monitor Azure OpenAI deployments, content filtering, and usage.',
  category: 'cloud',
  icon: 'azure',
  color: '#0078D4',
  tier: 'pro',
  docsUrl: '/docs/integrations/azure-openai',
  features: [
    'Deployment usage and cost monitoring',
    'Content filter trigger alerts',
    'Token consumption tracking',
    'Model version change notifications',
  ],
  configFields: [
    { key: 'azureEndpoint', label: 'Azure OpenAI Endpoint', type: 'url', required: true, placeholder: 'https://your-resource.openai.azure.com' },
    { key: 'azureApiKey', label: 'API Key', type: 'password', required: true },
  ],
  webhookSupported: false,
  agentSupported: true,
};

export const gcpSecurityCommand: IntegrationDefinition = {
  slug: 'gcp-security-command',
  name: 'Google Cloud SCC',
  description: 'Ingest findings from Google Cloud Security Command Center.',
  category: 'cloud',
  icon: 'gcp',
  color: '#4285F4',
  tier: 'pro',
  docsUrl: '/docs/integrations/gcp-scc',
  features: [
    'Vulnerability and misconfiguration findings',
    'Vertex AI monitoring',
    'IAM anomaly detection',
    'GKE workload security',
  ],
  configFields: [
    { key: 'serviceAccountJson', label: 'Service Account JSON', type: 'password', required: true, helpText: 'Service account with securitycenter.findings.list permission' },
    { key: 'organizationId', label: 'Organization ID', type: 'text', required: true },
  ],
  webhookSupported: true,
  agentSupported: true,
};

export const gcpVertexAI: IntegrationDefinition = {
  slug: 'gcp-vertex-ai',
  name: 'Google Vertex AI',
  description: 'Monitor Vertex AI model deployments, predictions, and agent builders.',
  category: 'cloud',
  icon: 'gcp',
  color: '#4285F4',
  tier: 'pro',
  docsUrl: '/docs/integrations/gcp-vertex-ai',
  features: [
    'Model prediction logging',
    'Agent Builder session monitoring',
    'Grounding and RAG audit trail',
    'Cost and quota alerts',
  ],
  configFields: [
    { key: 'serviceAccountJson', label: 'Service Account JSON', type: 'password', required: true },
    { key: 'projectId', label: 'GCP Project ID', type: 'text', required: true },
  ],
  webhookSupported: false,
  agentSupported: true,
};

export const cloudIntegrations = [
  ...awsIntegrations,
  azureSentinel, azureOpenAI,
  gcpSecurityCommand, gcpVertexAI,
] as const;
