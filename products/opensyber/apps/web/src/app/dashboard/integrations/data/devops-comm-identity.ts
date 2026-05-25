import type { Integration } from '../integrations-types';

export const devopsIntegrations: Integration[] = [
  {
    slug: 'github', name: 'GitHub', category: 'devops', color: '#FFFFFF', tier: 'free',
    description: 'Monitor repository events, Actions, Dependabot, and code scanning.',
    features: ['Push and PR events', 'Actions workflow monitoring', 'Dependabot alerts', 'Secret scanning alerts'],
    configFields: [
      { key: 'githubToken', label: 'Personal Access Token', type: 'password', required: true, helpText: 'Fine-grained PAT with repo and security_events scopes' },
      { key: 'webhookSecret', label: 'Webhook Secret', type: 'password', required: false },
    ],
    setupSteps: ['Create a fine-grained PAT at github.com/settings/tokens', 'Add a webhook pointing to: https://api.opensyber.cloud/webhooks/integrations/github', 'Set content type to application/json', 'Enter token and webhook secret below'],
  },
  {
    slug: 'gitlab', name: 'GitLab', category: 'devops', color: '#FC6D26', tier: 'free',
    description: 'Monitor GitLab projects, CI/CD, SAST/DAST, and merge requests.',
    features: ['Pipeline event monitoring', 'SAST/DAST finding ingestion', 'Dependency scanning', 'MR approval auditing'],
    configFields: [
      { key: 'gitlabToken', label: 'Personal Access Token', type: 'password', required: true },
      { key: 'gitlabUrl', label: 'GitLab URL', type: 'url', required: false, placeholder: 'https://gitlab.com' },
    ],
    setupSteps: ['Create a PAT at gitlab.com/-/profile/personal_access_tokens', 'Add project webhook to: https://api.opensyber.cloud/webhooks/integrations/gitlab', 'Enter token below'],
  },
  {
    slug: 'terraform-cloud', name: 'Terraform Cloud', category: 'devops', color: '#7B42BC', tier: 'pro',
    description: 'Monitor Terraform runs, state changes, and policy violations.',
    features: ['Run event monitoring', 'Sentinel policy alerts', 'State drift detection', 'Resource change audit'],
    configFields: [
      { key: 'tfcToken', label: 'API Token', type: 'password', required: true },
      { key: 'orgName', label: 'Organization', type: 'text', required: true },
    ],
    setupSteps: ['Generate a team or organization API token in TFC', 'Configure notification webhook for runs', 'Enter credentials below'],
  },
  {
    slug: 'docker-hub', name: 'Docker Hub', category: 'devops', color: '#2496ED', tier: 'free',
    description: 'Monitor image pushes, vulnerability scans, and repository events.',
    features: ['Image push/pull tracking', 'Vulnerability scan results', 'Tag mutation detection', 'Access auditing'],
    configFields: [
      { key: 'dockerUsername', label: 'Username', type: 'text', required: true },
      { key: 'dockerToken', label: 'Access Token', type: 'password', required: true },
    ],
    setupSteps: ['Create access token at hub.docker.com/settings/security', 'Set up repository webhook', 'Enter credentials below'],
  },
  {
    slug: 'kubernetes', name: 'Kubernetes', category: 'devops', color: '#326CE5', tier: 'pro',
    description: 'Monitor clusters for workload security, RBAC, and admission events.',
    features: ['Pod security admission', 'RBAC change monitoring', 'Network policy violations', 'Privileged container detection'],
    configFields: [
      { key: 'kubeconfigBase64', label: 'Kubeconfig (Base64)', type: 'password', required: true },
      { key: 'clusterName', label: 'Cluster Name', type: 'text', required: true },
    ],
    setupSteps: ['Create a service account with cluster-reader role', 'Base64-encode the kubeconfig', 'Enter it below with a cluster name'],
  },
];

export const communicationIntegrations: Integration[] = [
  {
    slug: 'slack', name: 'Slack', category: 'communication', color: '#4A154B', tier: 'free',
    description: 'Receive alerts in Slack and monitor Slack bot AI activity.',
    features: ['Alert delivery to channels', 'Interactive incident buttons', 'Bot command auditing', 'AI chatbot monitoring'],
    configFields: [
      { key: 'slackWebhookUrl', label: 'Incoming Webhook URL', type: 'url', required: true },
      { key: 'slackBotToken', label: 'Bot Token (optional)', type: 'password', required: false },
    ],
    setupSteps: ['Create an Incoming Webhook in Slack App settings', 'Choose the channel for alerts', 'Paste the webhook URL below', 'Optionally add bot token for AI bot monitoring'],
  },
  {
    slug: 'microsoft-teams', name: 'Microsoft Teams', category: 'communication', color: '#6264A7', tier: 'free',
    description: 'Send alerts to Teams channels and monitor Teams Copilot.',
    features: ['Adaptive card alerts', 'Copilot monitoring', 'Bot command auditing', 'Meeting AI summary tracking'],
    configFields: [{ key: 'teamsWebhookUrl', label: 'Incoming Webhook URL', type: 'url', required: true }],
    setupSteps: ['In Teams, go to channel → Connectors → Incoming Webhook', 'Name it "OpenSyber Alerts" and copy the URL', 'Paste it below'],
  },
  {
    slug: 'pagerduty', name: 'PagerDuty', category: 'communication', color: '#06AC38', tier: 'pro',
    description: 'Escalate critical security incidents to PagerDuty on-call.',
    features: ['Incident creation', 'Auto-resolve on remediation', 'Severity mapping', 'Service dependency'],
    configFields: [
      { key: 'pagerdutyApiKey', label: 'Events API v2 Key', type: 'password', required: true },
      { key: 'serviceId', label: 'Service ID', type: 'text', required: true },
    ],
    setupSteps: ['Create an Events API v2 integration in PagerDuty', 'Copy the integration key', 'Enter it below with the service ID'],
  },
  {
    slug: 'discord', name: 'Discord', category: 'communication', color: '#5865F2', tier: 'free',
    description: 'Post alerts and reports to Discord channels via webhooks.',
    features: ['Rich embed alerts', 'Severity-based routing', 'Daily digest summaries', 'Bot AI monitoring'],
    configFields: [{ key: 'discordWebhookUrl', label: 'Webhook URL', type: 'url', required: true }],
    setupSteps: ['In Discord, go to Channel Settings → Integrations → Webhooks', 'Create a webhook and copy the URL', 'Paste it below'],
  },
];

export const identityIntegrations: Integration[] = [
  {
    slug: 'entra-id', name: 'Microsoft Entra ID', category: 'identity', color: '#0078D4', tier: 'team',
    description: 'Monitor identity events, risky sign-ins, and Conditional Access.',
    features: ['Risky sign-in detection', 'Conditional Access monitoring', 'Service principal auditing', 'App consent tracking'],
    configFields: [
      { key: 'tenantId', label: 'Tenant ID', type: 'text', required: true },
      { key: 'clientId', label: 'Client ID', type: 'text', required: true },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
    ],
    setupSteps: ['Register an App in Entra ID portal', 'Grant IdentityRiskEvent.Read.All and AuditLog.Read.All', 'Admin consent required', 'Enter credentials below'],
  },
  {
    slug: 'okta', name: 'Okta', category: 'identity', color: '#007DC1', tier: 'pro',
    description: 'Ingest Okta system log events for identity threat detection.',
    features: ['System log streaming', 'Suspicious activity detection', 'MFA bypass alerts', 'App assignment tracking'],
    configFields: [
      { key: 'oktaDomain', label: 'Okta Domain', type: 'url', required: true, placeholder: 'https://your-org.okta.com' },
      { key: 'oktaApiToken', label: 'API Token', type: 'password', required: true },
    ],
    setupSteps: ['Create API token in Okta Admin → Security → API → Tokens', 'Enter your Okta domain and token below'],
  },
];
