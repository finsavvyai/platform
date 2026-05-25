import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AgentConfig } from '../config.js';
import type { ApiClient } from '../lib/api-client.js';

// Mock fs.watch and fs.readdir
const watchMock = vi.fn(() => ({ close: vi.fn() }));
const readdirMock = vi.fn();
const readFileMock = vi.fn();
const statMock = vi.fn();

vi.mock('node:fs', () => ({
  watch: (...args: unknown[]) => watchMock(...args),
}));

vi.mock('node:fs/promises', () => ({
  readdir: (...args: unknown[]) => readdirMock(...args),
  readFile: (...args: unknown[]) => readFileMock(...args),
  stat: (...args: unknown[]) => statMock(...args),
}));

const { SecurityMonitor } = await import('./security.js');

function createConfig(): AgentConfig {
  return {
    instanceId: 'inst-1',
    apiBaseUrl: 'https://api.test.com',
    gatewayToken: 'tok',
    healthCheckIntervalMs: 60000,
    securityScanIntervalMs: 30000,
    auditBatchIntervalMs: 300000,
    engineGatewayUrl: 'http://127.0.0.1:18789',
    engineConfigDir: '/home/user/.syber-engine',
  };
}

function createMockApi(): ApiClient {
  return {
    reportSecurityEvents: vi.fn().mockResolvedValue(undefined),
    reportHealth: vi.fn(),
    checkForUpdates: vi.fn(),
    getVerifiedSkills: vi.fn(),
    downloadSkillPackage: vi.fn(),
  } as unknown as ApiClient;
}

describe('SecurityMonitor', () => {
  let monitor: InstanceType<typeof SecurityMonitor>;
  let api: ApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    api = createMockApi();
    monitor = new SecurityMonitor(createConfig(), api);
  });

  afterEach(async () => {
    monitor.stop();
    await Promise.resolve();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts and stops without errors', () => {
    monitor.start();
    monitor.stop();
  });

  it('watches credential files on start', () => {
    monitor.start();
    // Should try to watch config and credentials files
    expect(watchMock).toHaveBeenCalled();
  });

  describe('reportViolation', () => {
    it('buffers unauthorized_network events with warning severity', () => {
      monitor.reportViolation('github-integration', 'unauthorized_network', {
        target: 'https://evil.com/steal',
        reason: 'Domain not in allowlist',
      });

      expect(monitor.getBufferSize()).toBe(1);
    });

    it('buffers file_access_violation events with warning severity', () => {
      monitor.reportViolation('log-analyzer', 'file_access_violation', {
        target: '/etc/shadow',
        reason: 'Path not in allowed filesystem paths',
      });

      expect(monitor.getBufferSize()).toBe(1);
    });

    it('immediately flushes credential_access events (critical)', async () => {
      monitor.reportViolation('malicious-skill', 'credential_access', {
        target: '/home/user/.syber-engine/credentials',
        reason: 'Attempted to read credentials file',
      });

      // Critical events trigger immediate flush
      expect(api.reportSecurityEvents).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            eventType: 'credential_access',
            severity: 'critical',
            skillId: 'malicious-skill',
          }),
        ]),
      );
    });
  });

  describe('scanSkills', () => {
    it('detects unverified skills', async () => {
      readdirMock.mockResolvedValueOnce(['github-integration', 'unknown-skill']);
      statMock.mockResolvedValue({ isDirectory: () => true });

      await monitor.scanSkills(['github-integration']);

      // unknown-skill should generate a skill_blocked event
      expect(monitor.getBufferSize()).toBe(1);
    });

    it('does not flag verified skills', async () => {
      readdirMock.mockResolvedValueOnce(['github-integration', 'slack-notifier']);
      statMock.mockResolvedValue({ isDirectory: () => true });

      await monitor.scanSkills(['github-integration', 'slack-notifier']);

      expect(monitor.getBufferSize()).toBe(0);
    });

    it('handles missing skill directory gracefully', async () => {
      readdirMock.mockRejectedValueOnce(new Error('ENOENT'));

      await monitor.scanSkills(['any']);
      expect(monitor.getBufferSize()).toBe(0);
    });
  });

  describe('event flushing', () => {
    it('flushes events on stop', () => {
      monitor.reportViolation('test', 'unauthorized_network', { target: 'evil.com' });
      expect(monitor.getBufferSize()).toBe(1);

      monitor.stop();
      // After stop, flush should have been called
      expect(api.reportSecurityEvents).toHaveBeenCalled();
    });

    it('requeues events on flush failure', async () => {
      (api.reportSecurityEvents as any).mockRejectedValueOnce(new Error('network error'));

      monitor.reportViolation('test', 'unauthorized_network', { target: 'evil.com' });
      monitor.start();

      // Advance timer to trigger flush
      await vi.advanceTimersByTimeAsync(10000);

      // Events should be requeued (buffer not empty)
      expect(monitor.getBufferSize()).toBeGreaterThan(0);
    });
  });
});
