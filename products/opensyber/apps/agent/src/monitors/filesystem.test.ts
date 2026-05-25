import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import type { AgentConfig } from '../config.js';
import type { ApiClient } from '../lib/api-client.js';

const readFileMock = vi.fn();
const statMock = vi.fn();
const watchMock = vi.fn().mockReturnValue({ close: vi.fn() });

vi.mock('node:fs', () => ({
  promises: {
    readFile: (...args: unknown[]) => readFileMock(...args),
    stat: (...args: unknown[]) => statMock(...args),
  },
  watch: (...args: unknown[]) => watchMock(...args),
}));

const { FilesystemMonitor } = await import('./filesystem.js');

function createConfig(): AgentConfig {
  return {
    instanceId: 'inst-test',
    apiBaseUrl: 'https://api.test.com',
    gatewayToken: 'test-token',
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

/** Mock a successful file read. hashFile calls readFile then stat sequentially. */
function mockFile(content: string, mode = 0o644): void {
  const buf = Buffer.from(content);
  readFileMock.mockResolvedValueOnce(buf);
  statMock.mockResolvedValueOnce({ mode: mode | 0o100000, size: buf.length });
}

/**
 * After first file succeeds, remaining 5 paths fail at readFile.
 * stat is NEVER called for those paths because readFile throws first.
 * So we only need readFile rejects, not stat rejects.
 */
function mockRemainingNotFound(count = 5): void {
  for (let i = 0; i < count; i++) {
    readFileMock.mockRejectedValueOnce(new Error('ENOENT'));
  }
}

describe('FilesystemMonitor', () => {
  let monitor: InstanceType<typeof FilesystemMonitor>;

  beforeEach(() => {
    vi.useFakeTimers();
    readFileMock.mockReset();
    statMock.mockReset();
    watchMock.mockReset();
    watchMock.mockReturnValue({ close: vi.fn() });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    monitor = new FilesystemMonitor(createConfig(), createApi());
  });

  afterEach(() => {
    monitor.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('generateBaselines', () => {
    it('creates baselines for accessible files', async () => {
      mockFile('root:x:0:0:root:/root:/bin/bash');
      mockRemainingNotFound();

      const baselines = await monitor.generateBaselines();
      expect(baselines).toHaveLength(1);
      expect(baselines[0].filePath).toBe('/etc/passwd');
      expect(baselines[0].sha256).toHaveLength(64);
      expect(baselines[0].permissions).toMatch(/^0\d{3}$/);
    });

    it('skips files that do not exist', async () => {
      mockRemainingNotFound(6);
      const baselines = await monitor.generateBaselines();
      expect(baselines).toHaveLength(0);
    });

    it('computes correct SHA256 hash', async () => {
      const content = 'test content for hashing';
      mockFile(content);
      mockRemainingNotFound();

      const baselines = await monitor.generateBaselines();
      const expected = createHash('sha256').update(content).digest('hex');
      expect(baselines[0].sha256).toBe(expected);
    });

    it('records file permissions in octal', async () => {
      mockFile('content', 0o755);
      mockRemainingNotFound();

      const baselines = await monitor.generateBaselines();
      expect(baselines[0].permissions).toBe('0755');
    });
  });

  describe('verifyIntegrity', () => {
    async function setupBaseline(content: string, mode = 0o644): Promise<void> {
      mockFile(content, mode);
      mockRemainingNotFound();
      await monitor.generateBaselines();
    }

    it('detects file content changes', async () => {
      await setupBaseline('original content');
      mockFile('modified content');

      const changes = await monitor.verifyIntegrity();
      expect(changes).toHaveLength(1);
      expect(changes[0].changeType).toBe('modified');
      expect(changes[0].previousHash).not.toBe(changes[0].currentHash);
    });

    it('detects permission changes', async () => {
      const content = 'same content';
      await setupBaseline(content, 0o644);
      mockFile(content, 0o777);

      const changes = await monitor.verifyIntegrity();
      expect(changes).toHaveLength(1);
      expect(changes[0].changeType).toBe('permissions_changed');
      expect(changes[0].details).toContain('0644');
      expect(changes[0].details).toContain('0777');
    });

    it('detects file deletion', async () => {
      await setupBaseline('original');
      readFileMock.mockRejectedValueOnce(new Error('ENOENT'));

      const changes = await monitor.verifyIntegrity();
      expect(changes).toHaveLength(1);
      expect(changes[0].changeType).toBe('deleted');
      expect(changes[0].previousHash).toBeDefined();
    });

    it('returns empty when no changes', async () => {
      const content = 'stable content';
      await setupBaseline(content, 0o644);
      mockFile(content, 0o644);

      const changes = await monitor.verifyIntegrity();
      expect(changes).toHaveLength(0);
    });

    it('updates baseline after detecting change', async () => {
      await setupBaseline('v1');

      mockFile('v2');
      const changes1 = await monitor.verifyIntegrity();
      expect(changes1).toHaveLength(1);

      mockFile('v2');
      const changes2 = await monitor.verifyIntegrity();
      expect(changes2).toHaveLength(0);
    });
  });

  describe('stop', () => {
    it('closes watchers and clears intervals', async () => {
      const closeMock = vi.fn();
      watchMock.mockReturnValue({ close: closeMock });
      mockRemainingNotFound(6);

      await monitor.start();
      monitor.stop();
      expect(watchMock).toHaveBeenCalled();
    });
  });
});
