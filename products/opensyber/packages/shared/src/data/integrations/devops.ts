import type { IntegrationDefinition } from '../../types/integration.js';

export const githubIntegration: IntegrationDefinition = {
  slug: 'github',
  name: 'GitHub',
  description: 'Monitor repository events, Actions workflows, Dependabot, and code scanning.',
  category: 'devops',
  icon: 'github',
  color: '#FFFFFF',
  tier: 'free',
  docsUrl: '/docs/integrations/github',
  features: [
    'Push, PR, and branch protection events',
    'Actions workflow run monitoring',
    'Dependabot alert ingestion',
    'Code scanning and secret scanning alerts',
  ],
  configFields: [
    { key: 'githubToken', label: 'Personal Access Token', type: 'password', required: true, helpText: 'Fine-grained PAT with repo, security_events scopes' },
    { key: 'webhookSecret', label: 'Webhook Secret', type: 'password', required: false },
  ],
  webhookSupported: true,
  agentSupported: true,
};

export const gitlabIntegration: IntegrationDefinition = {
  slug: 'gitlab',
  name: 'GitLab',
  description: 'Monitor GitLab projects, CI/CD pipelines, SAST/DAST, and merge requests.',
  category: 'devops',
  icon: 'gitlab',
  color: '#FC6D26',
  tier: 'free',
  docsUrl: '/docs/integrations/gitlab',
  features: [
    'Pipeline and job event monitoring',
    'SAST and DAST finding ingestion',
    'Dependency scanning alerts',
    'Merge request approval auditing',
  ],
  configFields: [
    { key: 'gitlabToken', label: 'Personal Access Token', type: 'password', required: true },
    { key: 'gitlabUrl', label: 'GitLab URL', type: 'url', required: false, placeholder: 'https://gitlab.com' },
  ],
  webhookSupported: true,
  agentSupported: true,
};

export const terraformCloud: IntegrationDefinition = {
  slug: 'terraform-cloud',
  name: 'Terraform Cloud / HCP',
  description: 'Monitor Terraform runs, state changes, and policy check violations.',
  category: 'devops',
  icon: 'terraform',
  color: '#7B42BC',
  tier: 'pro',
  docsUrl: '/docs/integrations/terraform',
  features: [
    'Run and plan event monitoring',
    'Sentinel policy violation alerts',
    'State drift detection',
    'Resource change audit trail',
  ],
  configFields: [
    { key: 'tfcToken', label: 'API Token', type: 'password', required: true },
    { key: 'orgName', label: 'Organization', type: 'text', required: true },
  ],
  webhookSupported: true,
  agentSupported: false,
};

export const dockerHub: IntegrationDefinition = {
  slug: 'docker-hub',
  name: 'Docker Hub',
  description: 'Monitor image pushes, vulnerability scans, and repository events.',
  category: 'devops',
  icon: 'docker',
  color: '#2496ED',
  tier: 'free',
  docsUrl: '/docs/integrations/docker-hub',
  features: [
    'Image push and pull event tracking',
    'Vulnerability scan result ingestion',
    'Tag mutation detection',
    'Repository access auditing',
  ],
  configFields: [
    { key: 'dockerUsername', label: 'Docker Hub Username', type: 'text', required: true },
    { key: 'dockerToken', label: 'Access Token', type: 'password', required: true },
  ],
  webhookSupported: true,
  agentSupported: false,
};

export const kubernetesIntegration: IntegrationDefinition = {
  slug: 'kubernetes',
  name: 'Kubernetes',
  description: 'Monitor K8s clusters for workload security, RBAC, and admission events.',
  category: 'devops',
  icon: 'kubernetes',
  color: '#326CE5',
  tier: 'pro',
  docsUrl: '/docs/integrations/kubernetes',
  features: [
    'Pod security admission events',
    'RBAC change monitoring',
    'Network policy violations',
    'Privileged container detection',
  ],
  configFields: [
    { key: 'kubeconfigBase64', label: 'Kubeconfig (Base64)', type: 'password', required: true },
    { key: 'clusterName', label: 'Cluster Name', type: 'text', required: true },
  ],
  webhookSupported: true,
  agentSupported: true,
};

export const devopsIntegrations = [
  githubIntegration, gitlabIntegration, terraformCloud,
  dockerHub, kubernetesIntegration,
] as const;
