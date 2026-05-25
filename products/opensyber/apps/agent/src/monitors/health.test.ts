import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AgentConfig } from '../config.js';
import type { ApiClient, HealthResponse } from '../lib/api-client.js';
import type { SkillInstaller } from '../skills/installer.js';

// Mock child_process so execSync doesn't actually run shell commands
vi.mock('node:child_process', () => ({
  execSync: vi.fn(() => '25'),
}));

const { HealthMonitor } = await import('./health.js');

function createConfig(): AgentConfig {
  return {
    instanceId: 'inst-test',
    apiBaseUrl: 'https://api.test.com',
    gatewayToken: 'tok',
    healthCheckIntervalMs: 60000,
    securityScanIntervalMs: 30000,
    auditBatchIntervalMs: 300000,
    engineGatewayUrl: 'http://127.0.0.1:18789',
    engineConfigDir: '/home/user/.syber-engine',
  };
}

function createMockApi(response?: Partial<HealthResponse>): ApiClient {
  return {
    reportHealth: vi.fn().mockResolvedValue({
      received: true,
      desiredSkills: [],
      ...response,
    }),
    reportSecurityEvents: vi.fn(),
    checkForUpdates: vi.fn(),
    getVerifiedSkills: vi.fn(),
    downloadSkillPackage: vi.fn().mockResolvedValue('cGFja2FnZS1kYXRh'), // base64 of "package-data"
  } as unknown as ApiClient;
}

function createMockInstaller(installed: string[] = []): SkillInstaller {
  return {
    listInstalled: vi.fn().mockResolvedValue(installed),
    install: vi.fn().mockResolvedValue({ slug: 'test', version: '1.0.0' }),
    uninstall: vi.fn().mockResolvedValue(undefined),
    ensureSkillsDir: vi.fn().mockResolvedValue(undefined),
    isInstalled: vi.fn(),
    readManifest: vi.fn(),
    getSkillPath: vi.fn(),
  } as unknown as SkillInstaller;
}

// Mock fetch for engine health check
const originalFetch = globalThis.fetch;

describe('HealthMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock fetch for isEngineRunning check
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true }) as any;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('starts and stops without errors', () => {
    const monitor = new HealthMonitor(createConfig(), createMockApi());
    monitor.start();
    monitor.stop();
  });

  it('calls reportHealth on check', async () => {
    const api = createMockApi();
    const monitor = new HealthMonitor(createConfig(), api);

    monitor.start();
    // The first check runs immediately on start
    await vi.advanceTimersByTimeAsync(0);

    expect(api.reportHealth).toHaveBeenCalledWith(
      expect.objectContaining({
        agentVersion: '0.2.0',
        engineRunning: true,
      }),
    );

    monitor.stop();
  });

  it('installs missing skills from desiredSkills', async () => {
    const api = createMockApi({
      desiredSkills: [
        { slug: 'github-integration', version: '1.0.0' },
        { slug: 'slack-notifier', version: '1.2.0' },
      ],
    });
    const installer = createMockInstaller([]); // Nothing installed locally

    const monitor = new HealthMonitor(createConfig(), api, installer);
    monitor.start();
    await vi.advanceTimersByTimeAsync(0);

    // Should download and install both skills
    expect(api.downloadSkillPackage).toHaveBeenCalledWith('github-integration', '1.0.0');
    expect(api.downloadSkillPackage).toHaveBeenCalledWith('slack-notifier', '1.2.0');
    expect(installer.install).toHaveBeenCalledTimes(2);

    monitor.stop();
  });

  it('uninstalls skills not in desiredSkills', async () => {
    const api = createMockApi({ desiredSkills: [] }); // No skills desired
    const installer = createMockInstaller(['old-skill']); // One installed locally

    const monitor = new HealthMonitor(createConfig(), api, installer);
    monitor.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(installer.uninstall).toHaveBeenCalledWith('old-skill');

    monitor.stop();
  });

  it('skips already-installed skills', async () => {
    const api = createMockApi({
      desiredSkills: [{ slug: 'github-integration', version: '1.0.0' }],
    });
    const installer = createMockInstaller(['github-integration']); // Already installed

    const monitor = new HealthMonitor(createConfig(), api, installer);
    monitor.start();
    await vi.advanceTimersByTimeAsync(0);

    // Should NOT try to download or install
    expect(api.downloadSkillPackage).not.toHaveBeenCalled();
    expect(installer.install).not.toHaveBeenCalled();
    // Should NOT uninstall either
    expect(installer.uninstall).not.toHaveBeenCalled();

    monitor.stop();
  });

  it('handles download failure gracefully', async () => {
    const api = createMockApi({
      desiredSkills: [{ slug: 'broken-skill', version: '1.0.0' }],
    });
    (api.downloadSkillPackage as any).mockResolvedValueOnce(null); // Download fails
    const installer = createMockInstaller([]);

    const monitor = new HealthMonitor(createConfig(), api, installer);
    monitor.start();
    await vi.advanceTimersByTimeAsync(0);

    // Download was attempted but install should NOT happen
    expect(api.downloadSkillPackage).toHaveBeenCalledWith('broken-skill', '1.0.0');
    expect(installer.install).not.toHaveBeenCalled();

    monitor.stop();
  });

  it('works without installer (backward compatibility)', async () => {
    const api = createMockApi({
      desiredSkills: [{ slug: 'some-skill', version: '1.0.0' }],
    });

    // No installer provided
    const monitor = new HealthMonitor(createConfig(), api);
    monitor.start();
    await vi.advanceTimersByTimeAsync(0);

    // Should not try to download or install anything
    expect(api.downloadSkillPackage).not.toHaveBeenCalled();

    monitor.stop();
  });
});
