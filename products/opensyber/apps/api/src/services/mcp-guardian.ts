/**
 * MCP Guardian Scanner Service
 *
 * Runs 7 security checks on MCP server configurations.
 */

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface McpFinding {
  checkId: string;
  title: string;
  severity: FindingSeverity;
  description: string;
  remediation: string;
}

export interface McpConfig {
  name: string;
  bindAddress?: string;
  port?: number;
  auth?: { type?: string; token?: string } | null;
  tools?: McpToolConfig[];
  storage?: { encrypted?: boolean; path?: string } | null;
  tokenScopes?: string[];
  dependencies?: string[];
}

interface McpToolConfig {
  name: string;
  permissions?: string[];
  command?: string;
}

const KNOWN_IOC_PACKAGES = new Set([
  'mcp-evil-server', 'malicious-mcp-tool', 'mcp-backdoor',
  'mcp-data-exfil', 'mcp-cryptominer',
]);

/** Run all 7 security checks on an MCP config */
export function scanMCPConfig(config: McpConfig): McpFinding[] {
  return [
    ...checkBindAddress(config),
    ...checkAuthentication(config),
    ...checkFileToolPermissions(config),
    ...checkCommandInjection(config),
    ...checkTokenPrivileges(config),
    ...checkSupplyChain(config),
    ...checkConversationStorage(config),
  ];
}

/** Check 1: Flag 0.0.0.0 binding (CRITICAL) */
export function checkBindAddress(config: McpConfig): McpFinding[] {
  if (!config.bindAddress) return [];
  if (config.bindAddress === '0.0.0.0' || config.bindAddress === '::') {
    return [{
      checkId: 'MCP-001',
      title: 'Wildcard Bind Address',
      severity: 'critical',
      description: `Server "${config.name}" binds to ${config.bindAddress}, exposing it to all network interfaces.`,
      remediation: 'Bind to 127.0.0.1 or a specific internal IP.',
    }];
  }
  return [];
}

/** Check 2: Flag missing authentication (CRITICAL) */
export function checkAuthentication(config: McpConfig): McpFinding[] {
  if (!config.auth || !config.auth.type) {
    return [{
      checkId: 'MCP-002',
      title: 'Missing Authentication',
      severity: 'critical',
      description: `Server "${config.name}" has no authentication configured.`,
      remediation: 'Enable token-based or mTLS authentication.',
    }];
  }
  return [];
}

/** Check 3: Flag unrestricted file access (HIGH) */
export function checkFileToolPermissions(config: McpConfig): McpFinding[] {
  if (!config.tools) return [];
  const findings: McpFinding[] = [];

  for (const tool of config.tools) {
    const hasFileAccess = tool.name.includes('file') || tool.name.includes('fs');
    const unrestricted = !tool.permissions || tool.permissions.length === 0;

    if (hasFileAccess && unrestricted) {
      findings.push({
        checkId: 'MCP-003',
        title: 'Unrestricted File Access',
        severity: 'high',
        description: `Tool "${tool.name}" on "${config.name}" has unrestricted file system access.`,
        remediation: 'Add explicit path allowlists to file-access tools.',
      });
    }
  }
  return findings;
}

/** Check 4: Flag shell/exec tools (HIGH) */
export function checkCommandInjection(config: McpConfig): McpFinding[] {
  if (!config.tools) return [];
  const dangerousPatterns = [
    /\bsh\b/, /\bbash\b/, /\bexec\b/, /\beval\b/,
    /\bchild_process\b/, /\bspawn\b/, /\bsystem\b/,
  ];
  const findings: McpFinding[] = [];

  for (const tool of config.tools) {
    const cmd = tool.command ?? '';
    const isDangerous = dangerousPatterns.some((p) => p.test(cmd) || p.test(tool.name));

    if (isDangerous) {
      findings.push({
        checkId: 'MCP-004',
        title: 'Command Injection Risk',
        severity: 'high',
        description: `Tool "${tool.name}" on "${config.name}" uses shell/exec commands.`,
        remediation: 'Use execFile with argument arrays instead of shell execution.',
      });
    }
  }
  return findings;
}

/** Check 5: Flag over-privileged tokens (MEDIUM) */
export function checkTokenPrivileges(config: McpConfig): McpFinding[] {
  if (!config.tokenScopes || config.tokenScopes.length === 0) return [];
  const privilegedScopes = ['admin', 'root', 'write:all', '*'];
  const overPrivileged = config.tokenScopes.filter(
    (s) => privilegedScopes.includes(s),
  );

  if (overPrivileged.length > 0) {
    return [{
      checkId: 'MCP-005',
      title: 'Over-Privileged Token Scopes',
      severity: 'medium',
      description: `Server "${config.name}" uses privileged scopes: ${overPrivileged.join(', ')}.`,
      remediation: 'Apply least-privilege principle to token scopes.',
    }];
  }
  return [];
}

/** Check 6: Check against IOC feed (HIGH) */
export function checkSupplyChain(config: McpConfig): McpFinding[] {
  if (!config.dependencies) return [];
  const findings: McpFinding[] = [];

  for (const dep of config.dependencies) {
    if (KNOWN_IOC_PACKAGES.has(dep)) {
      findings.push({
        checkId: 'MCP-006',
        title: 'Known Malicious Dependency',
        severity: 'high',
        description: `Server "${config.name}" depends on known IOC package "${dep}".`,
        remediation: 'Remove the dependency immediately and audit for compromise.',
      });
    }
  }
  return findings;
}

/** Check 7: Flag unencrypted conversation storage (CRITICAL) */
export function checkConversationStorage(config: McpConfig): McpFinding[] {
  if (!config.storage) return [];
  if (config.storage.encrypted === false || config.storage.encrypted === undefined) {
    return [{
      checkId: 'MCP-007',
      title: 'Unencrypted Conversation Storage',
      severity: 'critical',
      description: `Server "${config.name}" stores conversations without encryption.`,
      remediation: 'Enable encryption at rest for all conversation data.',
    }];
  }
  return [];
}
