/**
 * Auth: read TenantIQ API token from environment variable or config file.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_FILENAME = '.tenantiq-mcp.json';

interface McpConfig {
  apiUrl: string;
  apiToken: string;
}

/** Resolve the API token: env var takes precedence, then config file. */
export function resolveAuth(): McpConfig {
  const envToken = process.env.TENANTIQ_API_TOKEN;
  const envUrl = process.env.TENANTIQ_API_URL || 'https://api.tenantiq.app';

  if (envToken) {
    return { apiUrl: envUrl, apiToken: envToken };
  }

  const configPath = resolveConfigPath();
  if (configPath && existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, 'utf-8');
      const config = JSON.parse(raw) as Partial<McpConfig>;
      if (config.apiToken) {
        return {
          apiUrl: config.apiUrl || envUrl,
          apiToken: config.apiToken,
        };
      }
    } catch {
      // Ignore malformed config
    }
  }

  throw new Error(
    'No TenantIQ API token found. Set TENANTIQ_API_TOKEN env var or create ~/' + CONFIG_FILENAME,
  );
}

function resolveConfigPath(): string | null {
  const explicit = process.env.TENANTIQ_MCP_CONFIG;
  if (explicit) return explicit;

  try {
    return join(homedir(), CONFIG_FILENAME);
  } catch {
    return null;
  }
}
