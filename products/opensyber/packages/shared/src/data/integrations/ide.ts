import type { IntegrationDefinition } from '../../types/integration.js';

export const vscodeExtension: IntegrationDefinition = {
  slug: 'vscode',
  name: 'VS Code Extension',
  description: 'Real-time terminal, file, and AI agent monitoring inside Visual Studio Code.',
  category: 'ide',
  icon: 'vscode',
  color: '#007ACC',
  tier: 'free',
  docsUrl: '/docs/integrations/vscode',
  features: [
    'Terminal command interception and risk scoring',
    'File save monitoring with secret detection',
    'AI agent attribution (Copilot, Cursor, Claude)',
    'Cloud sync every 5 minutes',
  ],
  configFields: [
    { key: 'gatewayToken', label: 'Gateway Token', type: 'password', required: true, helpText: 'Found in Dashboard → Settings' },
  ],
  webhookSupported: false,
  agentSupported: true,
};

export const jetbrainsPlugin: IntegrationDefinition = {
  slug: 'jetbrains',
  name: 'JetBrains IDEs',
  description: 'Monitor IntelliJ, PyCharm, WebStorm, and all JetBrains IDEs.',
  category: 'ide',
  icon: 'jetbrains',
  color: '#FE2857',
  tier: 'free',
  docsUrl: '/docs/integrations/jetbrains',
  features: [
    'Terminal and run configuration monitoring',
    'AI Assistant plugin activity tracking',
    'Code inspection result forwarding',
    'Git operation auditing',
  ],
  configFields: [
    { key: 'gatewayToken', label: 'Gateway Token', type: 'password', required: true },
  ],
  webhookSupported: false,
  agentSupported: true,
};

export const neovimPlugin: IntegrationDefinition = {
  slug: 'neovim',
  name: 'Neovim',
  description: 'Lua-based plugin for monitoring terminal commands and AI completions in Neovim.',
  category: 'ide',
  icon: 'neovim',
  color: '#57A143',
  tier: 'free',
  docsUrl: '/docs/integrations/neovim',
  features: [
    'Shell command capture via jobstart/termopen',
    'Copilot.lua and cmp-ai monitoring',
    'File write event tracking',
    'Lightweight Lua plugin — zero overhead',
  ],
  configFields: [
    { key: 'gatewayToken', label: 'Gateway Token', type: 'password', required: true },
  ],
  webhookSupported: false,
  agentSupported: true,
};

export const cursorIDE: IntegrationDefinition = {
  slug: 'cursor',
  name: 'Cursor IDE',
  description: 'Deep monitoring of Cursor AI agent sessions, composer actions, and terminal.',
  category: 'ide',
  icon: 'cursor',
  color: '#00D1FF',
  tier: 'free',
  docsUrl: '/docs/integrations/cursor',
  features: [
    'Composer session logging with full context',
    'Tab completions and AI edit tracking',
    'Terminal command interception',
    'MCP server activity monitoring',
  ],
  configFields: [
    { key: 'gatewayToken', label: 'Gateway Token', type: 'password', required: true },
  ],
  webhookSupported: false,
  agentSupported: true,
};

export const windsurf: IntegrationDefinition = {
  slug: 'windsurf',
  name: 'Windsurf (Codeium)',
  description: 'Monitor Windsurf Cascade AI agent flows, code suggestions, and terminal commands.',
  category: 'ide',
  icon: 'windsurf',
  color: '#09B6A2',
  tier: 'free',
  docsUrl: '/docs/integrations/windsurf',
  features: [
    'Cascade flow step monitoring',
    'AI suggestion acceptance tracking',
    'Terminal command auditing',
    'Workspace file change detection',
  ],
  configFields: [
    { key: 'gatewayToken', label: 'Gateway Token', type: 'password', required: true },
  ],
  webhookSupported: false,
  agentSupported: true,
};

export const ideIntegrations = [
  vscodeExtension, jetbrainsPlugin, neovimPlugin,
  cursorIDE, windsurf,
] as const;
