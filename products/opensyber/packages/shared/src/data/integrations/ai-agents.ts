import type { IntegrationDefinition } from '../../types/integration.js';

export const copilotChat: IntegrationDefinition = {
  slug: 'github-copilot',
  name: 'GitHub Copilot',
  description: 'Monitor Copilot Chat conversations, code suggestions, and workspace agent actions.',
  category: 'ai-agent',
  icon: 'copilot',
  color: '#6E40C9',
  tier: 'free',
  docsUrl: '/docs/integrations/github-copilot',
  features: [
    'Chat conversation logging',
    'Code suggestion acceptance rate',
    'Workspace agent command auditing',
    '@workspace and @terminal interaction tracking',
  ],
  configFields: [
    { key: 'gatewayToken', label: 'Gateway Token', type: 'password', required: true },
  ],
  webhookSupported: false,
  agentSupported: true,
};

export const microsoftCopilot: IntegrationDefinition = {
  slug: 'microsoft-copilot',
  name: 'Microsoft 365 Copilot',
  description: 'Monitor M365 Copilot usage across Word, Excel, PowerPoint, Outlook, and Teams.',
  category: 'ai-agent',
  icon: 'microsoft',
  color: '#0078D4',
  tier: 'team',
  docsUrl: '/docs/integrations/microsoft-copilot',
  features: [
    'Copilot interaction audit via Graph API',
    'Document generation tracking',
    'Email draft monitoring in Outlook',
    'Teams meeting summary auditing',
  ],
  configFields: [
    { key: 'tenantId', label: 'Entra Tenant ID', type: 'text', required: true },
    { key: 'clientId', label: 'App Registration Client ID', type: 'text', required: true },
    { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
  ],
  webhookSupported: true,
  agentSupported: true,
};

export const claudeCode: IntegrationDefinition = {
  slug: 'claude-code',
  name: 'Claude Code',
  description: 'Monitor Claude Code CLI sessions, file edits, and terminal commands.',
  category: 'ai-agent',
  icon: 'anthropic',
  color: '#D97706',
  tier: 'free',
  docsUrl: '/docs/integrations/claude-code',
  features: [
    'Session start/stop tracking',
    'File creation and edit auditing',
    'Terminal command risk scoring',
    'Cost and token usage monitoring',
  ],
  configFields: [
    { key: 'gatewayToken', label: 'Gateway Token', type: 'password', required: true },
  ],
  webhookSupported: false,
  agentSupported: true,
};

export const openaiAgents: IntegrationDefinition = {
  slug: 'openai-agents',
  name: 'OpenAI Agents SDK',
  description: 'Monitor OpenAI Agents SDK sessions, tool calls, and handoffs.',
  category: 'ai-agent',
  icon: 'openai',
  color: '#10A37F',
  tier: 'pro',
  docsUrl: '/docs/integrations/openai-agents',
  features: [
    'Agent trace and span ingestion',
    'Tool call auditing with input/output',
    'Guardrail trigger alerts',
    'Handoff chain visualization',
  ],
  configFields: [
    { key: 'openaiApiKey', label: 'OpenAI API Key', type: 'password', required: true },
    { key: 'projectId', label: 'Project ID', type: 'text', required: false },
  ],
  webhookSupported: true,
  agentSupported: true,
};

export const amazonQ: IntegrationDefinition = {
  slug: 'amazon-q',
  name: 'Amazon Q Developer',
  description: 'Monitor Amazon Q code suggestions, chat interactions, and transform operations.',
  category: 'ai-agent',
  icon: 'aws',
  color: '#FF9900',
  tier: 'pro',
  docsUrl: '/docs/integrations/amazon-q',
  features: [
    'Code suggestion tracking',
    'Chat conversation audit',
    'Code transformation monitoring',
    'Security scan result ingestion',
  ],
  configFields: [
    { key: 'awsAccessKeyId', label: 'Access Key ID', type: 'text', required: true },
    { key: 'awsSecretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
  ],
  webhookSupported: false,
  agentSupported: true,
};

export const cline: IntegrationDefinition = {
  slug: 'cline',
  name: 'Cline (VS Code)',
  description: 'Monitor Cline autonomous coding agent sessions and tool usage.',
  category: 'ai-agent',
  icon: 'cline',
  color: '#EC4899',
  tier: 'free',
  docsUrl: '/docs/integrations/cline',
  features: [
    'Autonomous task session logging',
    'Tool call auditing (file, terminal, browser)',
    'Cost tracking per session',
    'Human-in-the-loop approval monitoring',
  ],
  configFields: [
    { key: 'gatewayToken', label: 'Gateway Token', type: 'password', required: true },
  ],
  webhookSupported: false,
  agentSupported: true,
};

export const continueAgent: IntegrationDefinition = {
  slug: 'continue-dev',
  name: 'Continue.dev',
  description: 'Monitor Continue open-source AI assistant across any IDE.',
  category: 'ai-agent',
  icon: 'continue',
  color: '#F97316',
  tier: 'free',
  docsUrl: '/docs/integrations/continue',
  features: [
    'Chat and autocomplete monitoring',
    'Custom slash command auditing',
    'Context provider usage tracking',
    'Model switching detection',
  ],
  configFields: [
    { key: 'gatewayToken', label: 'Gateway Token', type: 'password', required: true },
  ],
  webhookSupported: false,
  agentSupported: true,
};

export const aiAgentIntegrations = [
  copilotChat, microsoftCopilot, claudeCode,
  openaiAgents, amazonQ, cline, continueAgent,
] as const;
