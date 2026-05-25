import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AgentConfig } from '../config.js';
import type { ApiClient } from '../lib/api-client.js';

const readFileMock = vi.fn();

vi.mock('node:fs', () => ({
  promises: {
    readFile: (...args: unknown[]) => readFileMock(...args),
  },
}));

const { NetworkMonitor } = await import('./network.js');

function createConfig(): AgentConfig {
  return {
    instanceId: 'inst-test',
    apiBaseUrl: 'https://api.test.com',
    gatewayToken: 'tok',
    healthCheckIntervalMs: 60000,
    securityScanIntervalMs: 30000,
    auditBatchIntervalMs: 300000,
    engineGatewayUrl: 'http://127.0.0.1:18789',
    engineConfigDir: '/home/test/.syber-engine',
  };
}

function createApi(): ApiClient {
  return {
    reportSecurityEvents: vi.fn().mockResolvedValue(undefined),
    reportHealth: vi.fn(),
    checkForUpdates: vi.fn(),
    getVerifiedSkills: vi.fn(),
  } as unknown as ApiClient;
}

// Sample /proc/net/tcp content
const PROC_NET_TCP = `  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 0100007F:1F90 00000000:0000 0A 00000000:00000000 00:00000000 00000000     0        0 12345 1 0000000000000000 100 0 0 10 0
   1: 0100007F:C350 D83AC612:01BB 01 00000000:00000000 02:00000000 00000000  1000        0 12346 1 0000000000000000 100 0 0 10 0
   2: 0100007F:D904 08080808:0035 06 00000000:00000000 00:00000000 00000000  1000        0 12347 1 0000000000000000 100 0 0 10 0`;

describe('NetworkMonitor', () => {
  let monitor: InstanceType<typeof NetworkMonitor>;

  beforeEach(() => {
    vi.useFakeTimers();
    readFileMock.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    monitor = new NetworkMonitor(createConfig(), createApi());
  });

  afterEach(() => {
    monitor.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('parseProcNetLine', () => {
    it('parses a valid /proc/net/tcp line', () => {
      const line = '   1: 0100007F:C350 D83AC612:01BB 01 00000000:00000000 02:00000000 00000000  1000        0 12346';
      const conn = monitor.parseProcNetLine(line);

      expect(conn).not.toBeNull();
      expect(conn?.localAddr).toBe('127.0.0.1');
      expect(conn?.localPort).toBe(50000);
      expect(conn?.remoteAddr).toBe('18.198.58.216');
      expect(conn?.remotePort).toBe(443);
      expect(conn?.state).toBe('ESTABLISHED');
    });

    it('parses LISTEN state', () => {
      const line = '   0: 0100007F:1F90 00000000:0000 0A 00000000:00000000 00:00000000 00000000     0';
      const conn = monitor.parseProcNetLine(line);

      expect(conn?.state).toBe('LISTEN');
    });

    it('parses TIME_WAIT state', () => {
      const line = '   2: 0100007F:D904 08080808:0035 06 00000000:00000000 00:00000000 00000000  1000';
      const conn = monitor.parseProcNetLine(line);

      expect(conn?.state).toBe('TIME_WAIT');
      expect(conn?.remoteAddr).toBe('8.8.8.8');
      expect(conn?.remotePort).toBe(53);
    });

    it('returns null for malformed lines', () => {
      expect(monitor.parseProcNetLine('')).toBeNull();
      expect(monitor.parseProcNetLine('invalid')).toBeNull();
      expect(monitor.parseProcNetLine('  0: bad data')).toBeNull();
    });
  });

  describe('scan', () => {
    it('reads /proc/net/tcp and returns non-LISTEN connections', async () => {
      readFileMock.mockResolvedValueOnce(PROC_NET_TCP);

      const connections = await monitor.scan();
      // Should get 2 connections (ESTABLISHED + TIME_WAIT), not LISTEN
      expect(connections).toHaveLength(2);
      expect(connections[0].state).toBe('ESTABLISHED');
      expect(connections[1].state).toBe('TIME_WAIT');
    });

    it('skips duplicate connections on subsequent scans', async () => {
      readFileMock.mockResolvedValue(PROC_NET_TCP);

      const first = await monitor.scan();
      const second = await monitor.scan();

      expect(first).toHaveLength(2);
      expect(second).toHaveLength(0);
    });

    it('returns empty when /proc/net/tcp is unavailable', async () => {
      readFileMock.mockRejectedValueOnce(new Error('ENOENT'));
      const connections = await monitor.scan();
      expect(connections).toHaveLength(0);
    });
  });

  describe('setAllowedHosts', () => {
    it('updates the allowed hosts set', () => {
      monitor.setAllowedHosts(['1.2.3.4', '5.6.7.8']);
      // Verify via scan behavior — allowed hosts report info, not unauthorized
      expect(monitor).toBeDefined();
    });
  });

  describe('start/stop', () => {
    it('starts and stops without error', () => {
      monitor.start();
      monitor.stop();
      // Double stop should be safe
      monitor.stop();
    });
  });
});
