import { promises as fs } from 'node:fs';
import type { AgentConfig } from '../config.js';
import type { ApiClient } from '../lib/api-client.js';

export interface NetworkConnection {
  localAddr: string;
  localPort: number;
  remoteAddr: string;
  remotePort: number;
  state: string;
}

const TCP_STATES: Record<string, string> = {
  '01': 'ESTABLISHED',
  '02': 'SYN_SENT',
  '06': 'TIME_WAIT',
  '0A': 'LISTEN',
};

/**
 * Monitors outbound TCP connections by reading /proc/net/tcp.
 * Reports new connections to the API and flags unauthorized ones.
 */
/** Tailscale CGNAT range — traffic to 100.64.0.0/10 is mesh-internal */
const TAILSCALE_CGNAT_PREFIX = '100.';

function isTailscaleAddress(ip: string): boolean {
  if (!ip.startsWith(TAILSCALE_CGNAT_PREFIX)) return false;
  const first = parseInt(ip.split('.')[1] ?? '0', 10);
  return first >= 64 && first <= 127; // 100.64.0.0 – 100.127.255.255
}

export class NetworkMonitor {
  private config: AgentConfig;
  private api: ApiClient;
  private allowedHosts = new Set<string>();
  private scanInterval: NodeJS.Timeout | null = null;
  private buffer: NetworkConnection[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private knownConnections = new Set<string>();

  constructor(config: AgentConfig, api: ApiClient) {
    this.config = config;
    this.api = api;
  }

  setAllowedHosts(hosts: string[]): void {
    this.allowedHosts = new Set(hosts);
  }

  start(): void {
    // Scan connections every 10 seconds
    this.scanInterval = setInterval(() => this.scan(), 10_000);
    // Flush reports every 30 seconds
    this.flushInterval = setInterval(() => this.flush(), 30_000);
    console.log('[NetworkMonitor] Started monitoring connections');
  }

  stop(): void {
    if (this.scanInterval) clearInterval(this.scanInterval);
    if (this.flushInterval) clearInterval(this.flushInterval);
    this.flush();
    console.log('[NetworkMonitor] Stopped');
  }

  /**
   * Parse /proc/net/tcp to find active TCP connections.
   */
  async scan(): Promise<NetworkConnection[]> {
    const connections: NetworkConnection[] = [];

    try {
      const content = await fs.readFile('/proc/net/tcp', 'utf-8');
      const lines = content.trim().split('\n').slice(1); // skip header

      for (const line of lines) {
        const conn = this.parseProcNetLine(line);
        if (!conn) continue;
        // Only track outbound (non-LISTEN) connections
        if (conn.state === 'LISTEN') continue;

        const key = `${conn.remoteAddr}:${conn.remotePort}`;
        if (!this.knownConnections.has(key)) {
          this.knownConnections.add(key);
          this.buffer.push(conn);
          connections.push(conn);
        }
      }
    } catch {
      // /proc/net/tcp not available (e.g., macOS)
    }

    return connections;
  }

  /**
   * Parse a single line from /proc/net/tcp.
   * Format: sl local_address rem_address st ...
   * Addresses are hex: AABBCCDD:PORT
   */
  parseProcNetLine(line: string): NetworkConnection | null {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4) return null;

    const localParts = parts[1]?.split(':');
    const remoteParts = parts[2]?.split(':');
    const stateHex = parts[3];

    if (!localParts || !remoteParts || localParts.length < 2 || remoteParts.length < 2 || !stateHex) {
      return null;
    }

    return {
      localAddr: this.hexToIp(localParts[0] ?? ''),
      localPort: parseInt(localParts[1] ?? '0', 16),
      remoteAddr: this.hexToIp(remoteParts[0] ?? ''),
      remotePort: parseInt(remoteParts[1] ?? '0', 16),
      state: TCP_STATES[stateHex] ?? stateHex,
    };
  }

  private hexToIp(hex: string): string {
    if (hex.length !== 8) return hex;
    const a = parseInt(hex.substring(6, 8), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const c = parseInt(hex.substring(2, 4), 16);
    const d = parseInt(hex.substring(0, 2), 16);
    return `${a}.${b}.${c}.${d}`;
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const connections = [...this.buffer];
    this.buffer = [];

    // Skip trusted connections entirely — don't flood event log
    const untrusted = connections.filter((conn) =>
      !this.allowedHosts.has(conn.remoteAddr) && !isTailscaleAddress(conn.remoteAddr),
    );

    const events = untrusted.map((conn) => ({
      eventType: 'unauthorized_network' as const,
      severity: 'warning' as const,
      details: JSON.stringify({
        type: 'outbound_connection',
        remoteAddr: conn.remoteAddr,
        remotePort: conn.remotePort,
        state: conn.state,
      }),
    }));

    try {
      await this.api.reportSecurityEvents(events);
    } catch {
      this.buffer.unshift(...connections);
    }
  }
}
