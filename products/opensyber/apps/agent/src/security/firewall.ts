import { execFileSync } from 'node:child_process';

export interface NetworkPolicy {
  allowedDomains: string[];
  blockedDomains: string[];
  allowApiOutbound: boolean;
}

interface IptablesRule {
  chain: string;
  target: string;
  protocol: string;
  destination: string;
}

/**
 * Validate domain names to prevent command injection.
 * Rejects any string that isn't a valid hostname (CVE-2026-33017 pattern).
 */
function isValidDomain(domain: string): boolean {
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(domain);
}

/**
 * Validate IP address or CIDR notation.
 */
function isValidIpOrCidr(value: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(value);
}

/**
 * Manages iptables-based network isolation for the agent container.
 * Default policy: block all outbound except declared domains + API.
 */
export class Firewall {
  private apiHost: string;
  private rules: IptablesRule[] = [];

  constructor(apiBaseUrl: string) {
    try {
      this.apiHost = new URL(apiBaseUrl).hostname;
    } catch {
      this.apiHost = 'api.opensyber.cloud';
    }
  }

  /**
   * Apply a full network policy — sets default DROP then allowlists.
   */
  async applyNetworkPolicy(policy: NetworkPolicy): Promise<void> {
    // Flush existing rules
    this.execFile('iptables', ['-F', 'OUTPUT']);
    this.rules = [];

    // Always allow loopback
    this.addRule('OUTPUT', 'ACCEPT', 'all', '127.0.0.0/8');

    // Always allow Tailscale mesh (CGNAT range — WireGuard-encrypted)
    this.addRule('OUTPUT', 'ACCEPT', 'all', '100.64.0.0/10');

    // Always allow DNS (separate args — never embed flags in destination)
    this.execFile('iptables', ['-A', 'OUTPUT', '-p', 'udp', '--dport', '53', '-j', 'ACCEPT']);
    this.execFile('iptables', ['-A', 'OUTPUT', '-p', 'tcp', '--dport', '53', '-j', 'ACCEPT']);

    // Allow API communication
    if (policy.allowApiOutbound) {
      await this.allowDomains([this.apiHost]);
    }

    // Allow declared domains
    if (policy.allowedDomains.length > 0) {
      await this.allowDomains(policy.allowedDomains);
    }

    // Block specific domains (before default allow)
    for (const domain of policy.blockedDomains) {
      const ips = this.resolveDomain(domain);
      for (const ip of ips) {
        this.addRule('OUTPUT', 'DROP', 'all', ip);
      }
    }

    // Default policy: drop all other outbound
    this.execFile('iptables', ['-P', 'OUTPUT', 'DROP']);

    console.log(`[Firewall] Policy applied: ${this.rules.length} rules`);
  }

  /**
   * Resolve domains and add ACCEPT rules for their IPs.
   * Validates domain names to prevent command injection.
   */
  async allowDomains(domains: string[]): Promise<void> {
    for (const domain of domains) {
      if (!isValidDomain(domain)) {
        console.warn(`[Firewall] Rejected invalid domain: ${domain}`);
        continue;
      }
      const ips = this.resolveDomain(domain);
      for (const ip of ips) {
        this.addRule('OUTPUT', 'ACCEPT', 'tcp', ip);
      }
    }
  }

  /**
   * Block all outbound traffic except loopback and DNS.
   */
  blockAll(): void {
    this.execFile('iptables', ['-F', 'OUTPUT']);
    this.rules = [];
    this.addRule('OUTPUT', 'ACCEPT', 'all', '127.0.0.0/8');
    this.execFile('iptables', ['-P', 'OUTPUT', 'DROP']);
    console.log('[Firewall] All outbound blocked');
  }

  /**
   * Get currently active iptables rules.
   */
  getActiveRules(): IptablesRule[] {
    return [...this.rules];
  }

  private addRule(
    chain: string,
    target: string,
    protocol: string,
    destination: string,
  ): void {
    // Use execFileSync to avoid shell interpolation (CVE-2026-33017 pattern)
    const args = ['-A', chain, '-p', protocol, '-d', destination, '-j', target];
    this.execFile('iptables', args);
    this.rules.push({ chain, target, protocol, destination });
  }

  private resolveDomain(domain: string): string[] {
    if (!isValidDomain(domain)) {
      console.warn(`[Firewall] Rejected invalid domain: ${domain}`);
      return [];
    }
    try {
      // execFileSync passes domain as argument, not shell string
      const output = this.execFile('getent', ['hosts', domain]);
      return output
        .split('\n')
        .filter(Boolean)
        .map((line) => line.split(/\s+/)[0] ?? '')
        .filter((ip): ip is string => ip !== '' && isValidIpOrCidr(ip));
    } catch {
      console.warn(`[Firewall] Failed to resolve domain: ${domain}`);
      return [];
    }
  }

  /**
   * Execute a command without shell interpolation.
   * Uses execFileSync instead of execSync to prevent injection.
   */
  private execFile(command: string, args: string[]): string {
    try {
      return execFileSync(command, args, {
        encoding: 'utf-8',
        timeout: 10000,
      }).trim();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Firewall] Command failed: ${command} ${args.join(' ')} — ${message}`);
      return '';
    }
  }
}
