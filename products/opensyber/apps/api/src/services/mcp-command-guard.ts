/**
 * MCP Command Guard — CursorJack Detection
 *
 * Detects malicious MCP server configurations that abuse the command
 * field for arbitrary code execution or deep link injection.
 * Based on Proofpoint's CursorJack disclosure (March 2026).
 *
 * Attack pattern: MCP configs specify a `command` that runs on install.
 * A malicious config can use shell operators, dangerous binaries,
 * or cursor:// deep links to execute code with a single click.
 */

import type { McpServerConfig } from './mcp-monitor.js';

export interface CommandInjectionAlert {
  serverId: string;
  risk: string;
  severity: 'high' | 'critical';
  timestamp: string;
}

const DANGEROUS_COMMANDS = [
  'curl', 'wget', 'bash', 'sh', 'zsh', 'powershell',
  'cmd.exe', 'python', 'python3', 'node -e', 'eval',
];

const SHELL_OPERATORS = ['|', '&&', ';', '$(', '`'];

/**
 * Scan an MCP server config for CursorJack-style command injection.
 */
export function detectMcpCommandInjection(
  config: McpServerConfig,
): CommandInjectionAlert[] {
  const alerts: CommandInjectionAlert[] = [];
  const now = new Date().toISOString();
  const cmd = config.command.toLowerCase();

  // Check for shell operators in command
  for (const op of SHELL_OPERATORS) {
    if (config.command.includes(op)) {
      alerts.push({
        serverId: config.id,
        risk: `Shell operator "${op}" in MCP command (CursorJack pattern)`,
        severity: 'critical',
        timestamp: now,
      });
      break;
    }
  }

  // Check for dangerous direct commands
  for (const dangerous of DANGEROUS_COMMANDS) {
    if (cmd.startsWith(dangerous) || cmd.includes(`/${dangerous}`)) {
      alerts.push({
        serverId: config.id,
        risk: `Dangerous command "${dangerous}" in MCP server config`,
        severity: 'high',
        timestamp: now,
      });
    }
  }

  // Check args for deep link URLs (cursor://, vscode://)
  if (config.args) {
    for (const arg of config.args) {
      if (/^(cursor|vscode|code):\/\//.test(arg)) {
        alerts.push({
          serverId: config.id,
          risk: `Deep link protocol in args: ${arg.slice(0, 50)}`,
          severity: 'critical',
          timestamp: now,
        });
      }
    }
  }

  return alerts;
}

/**
 * Batch-scan multiple MCP configs and return all alerts.
 */
export function scanAllMcpConfigs(
  configs: McpServerConfig[],
): CommandInjectionAlert[] {
  return configs.flatMap(detectMcpCommandInjection);
}
