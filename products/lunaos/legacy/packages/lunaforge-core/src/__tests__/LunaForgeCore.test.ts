/**
 * Tests for Enhanced LunaForgeCore
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LunaForgeCore } from '../core-enhanced';
import { EventBus } from '../bus';
import { ModeRegistry } from '../modes';
import type { Mode, ModeContext, WorkspaceInfo, ProjectGraph } from '../types';

// Mock external dependencies
vi.mock('../analysis', () => ({
  buildProjectGraph: vi.fn()
}));

vi.mock('../workerClient', () => ({
  WorkerClient: vi.fn()
}));

describe('LunaForgeCore Enhanced', () => {
  let core: LunaForgeCore;
  let mockWorkspace: WorkspaceInfo;
  let mockFsListProvider: vi.MockedFunction<() => Promise<string[]>>;

  beforeEach(() => {
    mockWorkspace = {
      rootPath: '/test/workspace',
      name: 'test-workspace',
      folders: ['/test/workspace']
    };

    mockFsListProvider = vi.fn().mockResolvedValue([
      'file1.ts',
      'file2.ts',
      'folder/'
    ]);

    core = new LunaForgeCore({
      workspace: mockWorkspace,
      fsListProvider: mockFsListProvider,
      license: {
        valid: true,
        plan: 'premium',
        features: ['galaxy', 'codeflow']
      },
      cache: {
        memoryMaxSize: 10 * 1024 * 1024,
        defaultTTL: 30000
      },
      logging: {
        level: 1, // INFO
        enableConsole: false // Disable console for tests
      }
    });
  });

  afterEach(async () => {
    await core.dispose();
  });

  describe('Initialization', () => {
    it('should initialize with all subsystems', () => {
      expect(core.bus).toBeInstanceOf(EventBus);
      expect(core.modes).toBeInstanceOf(ModeRegistry);
      expect(core.cacheManager).toBeDefined();
      expect(core.performanceMonitor).toBeDefined();
      expect(core.logger).toBeDefined();
      expect(core.errorBoundary).toBeDefined();
    });

    it('should set workspace and license correctly', () => {
      expect(core.workspace).toEqual(mockWorkspace);
      expect(core.license.valid).toBe(true);
      expect(core.license.plan).toBe('premium');
      expect(core.license.features).toContain('galaxy');
    });
  });

  describe('Graph Management', () => {
    it('should build and cache project graph', async () => {
      const { buildProjectGraph } = await import('../analysis');
      const mockGraph: ProjectGraph = {
        files: [
          { path: 'file1.ts', size: 100 },
          { path: 'file2.ts', size: 200 }
        ],
        dependencies: [
          { from: 'file1.ts', to: 'file2.ts' }
        ]
      };

      (buildProjectGraph as vi.Mock).mockResolvedValue(mockGraph);

      const graph = await core.ensureGraph();

      expect(graph).toEqual(mockGraph);
      expect(buildProjectGraph).toHaveBeenCalledWith(mockWorkspace, [
        'file1.ts',
        'file2.ts',
        'folder/'
      ]);

      // Second call should use cache
      const graph2 = await core.ensureGraph();
      expect(graph2).toEqual(mockGraph);
      expect(buildProjectGraph).toHaveBeenCalledTimes(1);
    });

    it('should refresh graph cache', async () => {
      const { buildProjectGraph } = await import('../analysis');
      const mockGraph: ProjectGraph = {
        files: [{ path: 'file1.ts', size: 100 }],
        dependencies: []
      };

      (buildProjectGraph as vi.Mock).mockResolvedValue(mockGraph);

      // First build
      await core.ensureGraph();
      expect(buildProjectGraph).toHaveBeenCalledTimes(1);

      // Refresh should rebuild
      await core.refresh();
      await core.ensureGraph();
      expect(buildProjectGraph).toHaveBeenCalledTimes(2);
    });

    it('should return null graph when not built', () => {
      expect(core.getGraph()).toBeNull();
    });
  });

  describe('Mode Management', () => {
    let mockMode: Mode;

    beforeEach(() => {
      mockMode = {
        id: 'test-mode',
        title: 'Test Mode',
        activate: vi.fn(),
        deactivate: vi.fn(),
        onGraphUpdate: vi.fn()
      };
    });

    it('should register modes', () => {
      core.registerMode(mockMode);

      expect(core.modes.get('test-mode')).toBe(mockMode);
    });

    it('should activate modes with valid license', async () => {
      core.registerMode(mockMode);

      await core.activateMode('test-mode');

      expect(mockMode.activate).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace: mockWorkspace,
          license: core.license
        })
      );
    });

    it('should reject mode activation without license feature', async () => {
      const restrictedMode: Mode = {
        id: 'restricted-mode',
        title: 'Restricted Mode',
        requiredFeature: 'not-available',
        activate: vi.fn()
      };

      core.registerMode(restrictedMode);

      await core.activateMode('restricted-mode');

      expect(restrictedMode.activate).not.toHaveBeenCalled();
    });

    it('should deactivate modes', async () => {
      core.registerMode(mockMode);
      await core.activateMode('test-mode');
      await core.activateMode('test-mode');

      expect(mockMode.deactivate).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace: mockWorkspace
        })
      );
    });

    it('should handle mode activation errors gracefully', async () => {
      const errorMode: Mode = {
        id: 'error-mode',
        title: 'Error Mode',
        activate: vi.fn().mockRejectedValue(new Error('Activation failed'))
      };

      core.registerMode(errorMode);

      await expect(core.activateMode('error-mode')).rejects.toThrow('Activation failed');
    });
  });

  describe('Performance Monitoring', () => {
    it('should track graph building performance', async () => {
      const { buildProjectGraph } = await import('../analysis');
      const mockGraph: ProjectGraph = {
        files: [{ path: 'file1.ts', size: 100 }],
        dependencies: []
      };

      (buildProjectGraph as vi.Mock).mockResolvedValue(mockGraph);

      await core.ensureGraph();

      const metrics = core.getPerformanceMetrics();
      expect(metrics.graphBuildTime).toBeGreaterThan(0);
    });

    it('should track mode activation performance', async () => {
      const mockMode: Mode = {
        id: 'test-mode',
        title: 'Test Mode',
        activate: vi.fn()
      };

      core.registerMode(mockMode);
      await core.activateMode('test-mode');

      const metrics = core.getPerformanceMetrics();
      expect(metrics.modeActivationTime).toBeGreaterThan(0);
    });
  });

  describe('Cache Management', () => {
    it('should provide cache statistics', () => {
      const stats = core.getCacheStats();

      expect(stats).toHaveProperty('entries');
      expect(stats).toHaveProperty('memoryUsage');
      expect(stats).toHaveProperty('maxEntries');
      expect(stats).toHaveProperty('maxSize');
    });
  });

  describe('Health Check', () => {
    it('should perform comprehensive health check', async () => {
      const health = await core.performHealthCheck();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('checks');
      expect(health).toHaveProperty('metrics');
      expect(health).toHaveProperty('timestamp');

      expect(health.checks).toHaveProperty('memory');
      expect(health.checks).toHaveProperty('cache');
      expect(health.checks).toHaveProperty('modes');
      expect(health.checks).toHaveProperty('worker');

      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
    });

    it('should detect degraded health on memory pressure', async () => {
      // Mock high memory usage
      const originalGetMemoryUsage = (core as any).getCurrentMemoryUsage;
      (core as any).getCurrentMemoryUsage = vi.fn().mockReturnValue(200 * 1024 * 1024); // 200MB

      const health = await core.performHealthCheck();
      expect(health.checks.memory.status).toBe('degraded');

      // Restore original method
      (core as any).getCurrentMemoryUsage = originalGetMemoryUsage;
    });
  });

  describe('Error Handling', () => {
    it('should handle worker client not configured', async () => {
      const coreWithoutWorker = new LunaForgeCore({
        workspace: mockWorkspace,
        fsListProvider: mockFsListProvider
      });

      await expect(
        coreWithoutWorker.requestPlan('workspace')
      ).rejects.toThrow('Worker client not configured');

      await coreWithoutWorker.dispose();
    });

    it('should handle file system provider errors', async () => {
      mockFsListProvider.mockRejectedValue(new Error('File system error'));

      await expect(core.ensureGraph()).rejects.toThrow('File system error');
    });

    it('should handle mode not found errors', async () => {
      await expect(core.activateMode('non-existent')).rejects.toThrow(
        'Mode \'non-existent\' not registered'
      );
    });
  });

  describe('Logging and Debugging', () => {
    it('should provide log entries', () => {
      const logs = core.getLogs();

      expect(Array.isArray(logs)).toBe(true);
    });

    it('should provide performance summary', () => {
      const summary = core.getPerformanceMetrics();

      expect(summary).toHaveProperty('graphBuildTime');
      expect(summary).toHaveProperty('modeActivationTime');
      expect(summary).toHaveProperty('apiResponseTime');
      expect(summary).toHaveProperty('memoryUsage');
      expect(summary).toHaveProperty('cacheHitRate');
    });
  });

  describe('Resource Cleanup', () => {
    it('should dispose all resources', async () => {
      await core.ensureGraph(); // Create some state

      const disposeSpy = vi.spyOn(core.cacheManager, 'clear');
      const clearMetricsSpy = vi.spyOn(core.performanceMonitor, 'clearMetrics');

      await core.dispose();

      expect(disposeSpy).toHaveBeenCalled();
      expect(clearMetricsSpy).toHaveBeenCalled();
    });

    it('should handle multiple dispose calls', async () => {
      await core.dispose();
      await core.dispose(); // Should not throw

      expect(true).toBe(true); // Test passes if no exception
    });
  });

  describe('Mode Context', () => {
    it('should provide proper mode context', () => {
      const context = core.getModeContext();

      expect(context).toHaveProperty('workspace');
      expect(context).toHaveProperty('graph');
      expect(context).toHaveProperty('emit');
      expect(context).toHaveProperty('license');
      expect(typeof context.emit).toBe('function');
    });

    it('should include upgrade prompt callback when set', () => {
      const mockUpgradePrompt = vi.fn();
      core.showUpgradePrompt = mockUpgradePrompt;

      const context = core.getModeContext();

      expect(context.showUpgradePrompt).toBeDefined();
    });
  });
});