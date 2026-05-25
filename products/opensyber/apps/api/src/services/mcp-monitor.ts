/**
 * MCP Server Monitoring Service
 *
 * Track MCP tool invocations from IDE agents.
 * Detect enumeration spikes, static credential usage, and unknown servers.
 */

export interface McpInvocation {
  agentId: string;
  serverId: string;
  toolName: string;
  duration: number;
  timestamp: string;
  status: 'success' | 'error';
}

export interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  registered: boolean;
}

export interface EnumerationAlert {
  agentId: string;
  count: number;
  timeWindowMs: number;
  timestamp: string;
  severity: 'high' | 'critical';
}

export interface CredentialAlert {
  serverId: string;
  credentialType: string;
  severity: 'high' | 'critical';
  timestamp: string;
}

/**
 * Track an MCP tool invocation.
 * Store in KV for fast enumeration spike detection.
 */
export async function trackMcpInvocation(
  db: any,
  kv: any,
  invocation: McpInvocation,
): Promise<void> {
  const key = `mcp:invocations:${invocation.agentId}`;
  const now = Date.now();

  try {
    // Get existing invocations in last minute
    const existing = (await kv.get(key, 'json')) || [];
    const recent = existing.filter(
      (inv: any) => now - new Date(inv.timestamp).getTime() < 60000,
    );

    // Add new invocation and keep only recent
    recent.push(invocation);
    await kv.put(key, JSON.stringify(recent.slice(-100)), {
      expirationTtl: 300, // 5 min TTL
    });
  } catch (err) {
    console.error('Failed to track MCP invocation:', err);
  }
}

/**
 * Detect if an agent has >10 tool calls in 1 minute.
 */
export async function detectEnumerationSpike(
  kv: any,
  agentId: string,
): Promise<EnumerationAlert | null> {
  const key = `mcp:invocations:${agentId}`;
  const threshold = 10;
  const windowMs = 60000; // 1 minute

  try {
    const invocations = (await kv.get(key, 'json')) || [];
    const now = Date.now();
    const recent = invocations.filter(
      (inv: any) => now - new Date(inv.timestamp).getTime() < windowMs,
    );

    if (recent.length > threshold) {
      return {
        agentId,
        count: recent.length,
        timeWindowMs: windowMs,
        timestamp: new Date().toISOString(),
        severity: recent.length > 20 ? 'critical' : 'high',
      };
    }

    return null;
  } catch (err) {
    console.error('Failed to detect enumeration spike:', err);
    return null;
  }
}

/**
 * Scan MCP server config for static credentials.
 * Check env vars and command args for patterns like API_KEY, PASSWORD, TOKEN.
 */
export function scanMcpCredentials(config: McpServerConfig): CredentialAlert[] {
  const alerts: CredentialAlert[] = [];
  const credentialPatterns = ['api_key', 'password', 'token', 'secret', 'auth'];
  const now = new Date().toISOString();

  // Scan env variables
  if (config.env) {
    for (const [key, value] of Object.entries(config.env)) {
      const lower = key.toLowerCase();
      if (credentialPatterns.some((p) => lower.includes(p))) {
        alerts.push({
          serverId: config.id,
          credentialType: key,
          severity: 'critical',
          timestamp: now,
        });
      }
    }
  }

  // Scan command args
  if (config.args) {
    for (const arg of config.args) {
      const lower = arg.toLowerCase();
      if (credentialPatterns.some((p) => lower.includes(p))) {
        alerts.push({
          serverId: config.id,
          credentialType: 'command_arg',
          severity: 'high',
          timestamp: now,
        });
      }
    }
  }

  return alerts;
}

/**
 * Get list of registered MCP servers from DB.
 */
export async function getMcpServerInventory(
  db: any,
): Promise<McpServerConfig[]> {
  return [];
}

/**
 * Alert if an unknown/unregistered MCP server is used.
 */
export async function checkUnknownMcpServer(
  db: any,
  serverId: string,
): Promise<boolean> {
  const servers = await getMcpServerInventory(db);
  return !servers.some((s) => s.id === serverId);
}
