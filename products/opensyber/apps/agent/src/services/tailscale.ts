/**
 * Tailscale Mesh VPN Integration
 *
 * Provides encrypted agent-to-platform communication via WireGuard mesh.
 * Agents auto-join a Tailscale tailnet on startup, enabling:
 * - Encrypted API communication (no public internet exposure)
 * - MagicDNS for agent discovery (agent-{id}.ts.net)
 * - ACL-based access control per organization
 *
 * Falls back to public API URL if Tailscale is unavailable.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface TailscaleConfig {
  authKey: string;
  tailnet: string;
  instanceId: string;
  apiBaseUrl: string;
}

export interface TailscaleStatus {
  connected: boolean;
  hostname: string;
  tailnetIp: string | null;
  magicDns: string | null;
}

/**
 * Connect agent to Tailscale tailnet with stable hostname.
 */
export async function connectTailscale(config: TailscaleConfig): Promise<TailscaleStatus> {
  if (!/^[a-zA-Z0-9-]+$/.test(config.instanceId)) {
    throw new Error('Invalid instanceId format');
  }
  const hostname = `agent-${config.instanceId}`;

  try {
    await execFileAsync('tailscale', [
      'up',
      `--hostname=${hostname}`,
      '--reset',
    ], {
      env: { ...process.env, TS_AUTHKEY: config.authKey },
    });

    const status = await getTailscaleStatus();
    console.log(`[Tailscale] Connected as ${hostname} (${status.tailnetIp})`);
    return status;
  } catch (err) {
    console.warn('[Tailscale] Connection failed, using public API:', err);
    return { connected: false, hostname, tailnetIp: null, magicDns: null };
  }
}

/**
 * Get current Tailscale connection status.
 */
export async function getTailscaleStatus(): Promise<TailscaleStatus> {
  try {
    const { stdout } = await execFileAsync('tailscale', ['status', '--json']);
    const status = JSON.parse(stdout);
    const self = status.Self;

    return {
      connected: status.BackendState === 'Running',
      hostname: self?.HostName ?? '',
      tailnetIp: self?.TailscaleIPs?.[0] ?? null,
      magicDns: self?.DNSName ?? null,
    };
  } catch {
    return { connected: false, hostname: '', tailnetIp: null, magicDns: null };
  }
}

/**
 * Resolve API base URL — prefer Tailscale MagicDNS if connected.
 */
export function resolveApiUrl(
  publicUrl: string,
  tailscaleStatus: TailscaleStatus,
  tailscaleApiHost?: string,
): string {
  if (tailscaleStatus.connected && tailscaleApiHost) {
    return `https://${tailscaleApiHost}`;
  }
  return publicUrl;
}

/**
 * Check if Tailscale is installed on this machine.
 */
export async function isTailscaleInstalled(): Promise<boolean> {
  try {
    await execFileAsync('tailscale', ['version']);
    return true;
  } catch {
    return false;
  }
}
