import type { Integration } from '../integrations-types';

export const ideIntegrations: Integration[] = [
  {
    slug: 'vscode', name: 'VS Code', category: 'ide', color: '#007ACC', tier: 'free',
    description: 'Real-time terminal, file, and AI agent monitoring inside Visual Studio Code.',
    features: ['Terminal command risk scoring', 'File save secret detection', 'AI agent attribution', 'Cloud sync every 5 min'],
    configFields: [{ key: 'gatewayToken', label: 'Gateway Token', type: 'password', required: true, helpText: 'Found in Dashboard → Settings' }],
    setupSteps: ['Install "OpenSyber" from VS Code Marketplace', 'Open Command Palette → "OpenSyber: Set Gateway Token"', 'Paste your gateway token from Settings page', 'Activity syncs automatically every 5 minutes'],
  },
  {
    slug: 'jetbrains', name: 'JetBrains IDEs', category: 'ide', color: '#FE2857', tier: 'free',
    description: 'Monitor IntelliJ, PyCharm, WebStorm, and all JetBrains IDEs.',
    features: ['Terminal monitoring', 'AI Assistant tracking', 'Code inspection forwarding', 'Git operation auditing'],
    configFields: [{ key: 'gatewayToken', label: 'Gateway Token', type: 'password', required: true }],
    setupSteps: ['Install "OpenSyber" from JetBrains Marketplace', 'Go to Settings → Tools → OpenSyber', 'Paste your gateway token', 'Restart the IDE'],
  },
  {
    slug: 'neovim', name: 'Neovim', category: 'ide', color: '#57A143', tier: 'free',
    description: 'Lua-based plugin for monitoring terminal commands and AI completions.',
    features: ['Shell command capture', 'Copilot.lua monitoring', 'File write tracking', 'Zero-overhead Lua plugin'],
    configFields: [{ key: 'gatewayToken', label: 'Gateway Token', type: 'password', required: true }],
    setupSteps: ["Add 'opensyber/opensyber.nvim' to your plugin manager", "Run require('opensyber').setup({ token = 'YOUR_TOKEN' })", 'Restart Neovim — monitoring starts immediately'],
  },
  {
    slug: 'cursor', name: 'Cursor IDE', category: 'ide', color: '#00D1FF', tier: 'free',
    description: 'Deep monitoring of Cursor AI agent sessions, composer, and terminal.',
    features: ['Composer session logging', 'Tab completion tracking', 'Terminal interception', 'MCP server monitoring'],
    configFields: [{ key: 'gatewayToken', label: 'Gateway Token', type: 'password', required: true }],
    setupSteps: ['Install OpenSyber extension (Cursor uses VS Code extensions)', 'Open Command Palette → "OpenSyber: Set Gateway Token"', 'Paste your token — Cursor agent sessions are auto-detected'],
  },
  {
    slug: 'windsurf', name: 'Windsurf (Codeium)', category: 'ide', color: '#09B6A2', tier: 'free',
    description: 'Monitor Windsurf Cascade AI agent flows and code suggestions.',
    features: ['Cascade flow monitoring', 'AI suggestion tracking', 'Terminal auditing', 'File change detection'],
    configFields: [{ key: 'gatewayToken', label: 'Gateway Token', type: 'password', required: true }],
    setupSteps: ['Install OpenSyber extension in Windsurf', 'Set gateway token via Command Palette', 'Cascade sessions are auto-detected and logged'],
  },
];

export const aiAgentIntegrations: Integration[] = [
  {
    slug: 'github-copilot', name: 'GitHub Copilot', category: 'ai-agent', color: '#6E40C9', tier: 'free',
    description: 'Monitor Copilot Chat conversations, code suggestions, and workspace agent actions.',
    features: ['Chat conversation logging', 'Suggestion acceptance rate', 'Workspace agent auditing', '@workspace interaction tracking'],
    configFields: [{ key: 'gatewayToken', label: 'Gateway Token', type: 'password', required: true }],
    setupSteps: ['Install OpenSyber extension in VS Code/Cursor', 'The extension auto-detects GitHub Copilot', 'All Copilot interactions are captured and risk-scored', 'View in Agent Activity → filter by "GitHub Copilot"'],
  },
  {
    slug: 'microsoft-copilot', name: 'Microsoft 365 Copilot', category: 'ai-agent', color: '#0078D4', tier: 'team',
    description: 'Monitor M365 Copilot usage across Word, Excel, PowerPoint, Outlook, and Teams.',
    features: ['Copilot interaction audit', 'Document generation tracking', 'Email draft monitoring', 'Meeting summary auditing'],
    configFields: [
      { key: 'tenantId', label: 'Entra Tenant ID', type: 'text', required: true },
      { key: 'clientId', label: 'Client ID', type: 'text', required: true },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
    ],
    setupSteps: ['Register an App in Entra ID', 'Grant Reports.Read.All and AuditLog.Read.All permissions', 'Admin consent required for tenant-wide monitoring', 'Enter credentials below — data syncs hourly'],
  },
  {
    slug: 'claude-code', name: 'Claude Code', category: 'ai-agent', color: '#D97706', tier: 'free',
    description: 'Monitor Claude Code CLI sessions, file edits, and terminal commands.',
    features: ['Session start/stop tracking', 'File edit auditing', 'Terminal risk scoring', 'Cost and token monitoring'],
    configFields: [{ key: 'gatewayToken', label: 'Gateway Token', type: 'password', required: true }],
    setupSteps: ['Install the OpenSyber hook: opensyber hook install claude-code', 'The hook wraps Claude Code CLI and forwards events', 'All file edits and terminal commands are captured', 'View in Agent Activity → filter by "Claude Code"'],
  },
  {
    slug: 'openai-agents', name: 'OpenAI Agents SDK', category: 'ai-agent', color: '#10A37F', tier: 'pro',
    description: 'Monitor OpenAI Agents SDK sessions, tool calls, and handoffs.',
    features: ['Agent trace ingestion', 'Tool call auditing', 'Guardrail trigger alerts', 'Handoff chain visualization'],
    configFields: [
      { key: 'openaiApiKey', label: 'OpenAI API Key', type: 'password', required: true },
      { key: 'projectId', label: 'Project ID', type: 'text', required: false },
    ],
    setupSteps: ['Install opensyber-openai SDK wrapper: pip install opensyber-openai', 'Wrap your agent: from opensyber_openai import monitor', 'Traces are forwarded to your OpenSyber instance', 'View in Agent Activity with full trace visualization'],
  },
  {
    slug: 'amazon-q', name: 'Amazon Q Developer', category: 'ai-agent', color: '#FF9900', tier: 'pro',
    description: 'Monitor Amazon Q code suggestions, chat, and transform operations.',
    features: ['Code suggestion tracking', 'Chat audit', 'Transform monitoring', 'Security scan ingestion'],
    configFields: [
      { key: 'awsAccessKeyId', label: 'Access Key ID', type: 'text', required: true },
      { key: 'awsSecretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
    ],
    setupSteps: ['Enable Amazon Q activity logging in your AWS account', 'Create IAM user with codewhisperer:Get* permissions', 'Enter credentials below'],
  },
  {
    slug: 'cline', name: 'Cline', category: 'ai-agent', color: '#EC4899', tier: 'free',
    description: 'Monitor Cline autonomous coding agent sessions and tool usage.',
    features: ['Task session logging', 'Tool call auditing', 'Cost tracking', 'Approval monitoring'],
    configFields: [{ key: 'gatewayToken', label: 'Gateway Token', type: 'password', required: true }],
    setupSteps: ['Install OpenSyber extension in VS Code', 'The extension auto-detects Cline by extension ID', 'All Cline tool calls are captured and scored', 'View in Agent Activity → filter by "Cline"'],
  },
  {
    slug: 'continue-dev', name: 'Continue.dev', category: 'ai-agent', color: '#F97316', tier: 'free',
    description: 'Monitor Continue open-source AI assistant across any IDE.',
    features: ['Chat monitoring', 'Slash command auditing', 'Context provider tracking', 'Model switching detection'],
    configFields: [{ key: 'gatewayToken', label: 'Gateway Token', type: 'password', required: true }],
    setupSteps: ['Install OpenSyber extension alongside Continue', 'Auto-detection captures all Continue interactions', 'View in Agent Activity → filter by "Continue"'],
  },
];
