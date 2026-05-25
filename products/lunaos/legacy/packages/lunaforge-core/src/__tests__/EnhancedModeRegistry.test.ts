/**
 * Tests for Enhanced ModeRegistry
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnhancedModeRegistry } from '../modes-enhanced';
import type { EnhancedMode, Mode, ModeContext, ProjectGraph } from '../types';

describe('EnhancedModeRegistry', () => {
  let registry: EnhancedModeRegistry;
  let mockContext: ModeContext;

  beforeEach(() => {
    registry = new EnhancedModeRegistry({
      enableDependencyResolution: true,
      enableCircularDependencyCheck: true,
      maxActivationRetries: 3,
      activationTimeout: 5000
    });

    mockContext = {
      workspace: {
        rootPath: '/test/workspace',
        name: 'test-workspace',
        folders: ['/test/workspace']
      },
      graph: null,
      emit: vi.fn(),
      license: {
        valid: true,
        plan: 'premium',
        features: ['galaxy', 'codeflow']
      }
    };
  });

  afterEach(() => {
    registry.clear();
  });

  describe('Mode Registration', () => {
    it('should register basic modes', () => {
      const basicMode: Mode = {
        id: 'basic-mode',
        title: 'Basic Mode',
        activate: vi.fn()
      };

      registry.register(basicMode);

      expect(registry.get('basic-mode')).toBe(basicMode);
      expect(registry.isActive('basic-mode')).toBe(false);
      expect(registry.getStatus('basic-mode')?.status).toBe('registered');
    });

    it('should register enhanced modes', () => {
      const enhancedMode: EnhancedMode = {
        id: 'enhanced-mode',
        title: 'Enhanced Mode',
        version: '1.0.0',
        author: 'Test Author',
        tags: ['test'],
        priority: 1,
        activate: vi.fn()
      };

      registry.register(enhancedMode);

      const retrieved = registry.get('enhanced-mode');
      expect(retrieved).toBe(enhancedMode);
      expect(registry.getStatus('enhanced-mode')?.status).toBe('registered');
    });

    it('should throw error when registering duplicate modes', () => {
      const mode: Mode = {
        id: 'duplicate-mode',
        title: 'Duplicate Mode',
        activate: vi.fn()
      };

      registry.register(mode);

      expect(() => registry.register(mode)).toThrow(
        "Mode 'duplicate-mode' is already registered"
      );
    });

    it('should unregister modes', () => {
      const mode: Mode = {
        id: 'removable-mode',
        title: 'Removable Mode',
        activate: vi.fn(),
        deactivate: vi.fn()
      };

      registry.register(mode);
      expect(registry.get('removable-mode')).toBeDefined();

      registry.unregister('removable-mode');
      expect(registry.get('removable-mode')).toBeUndefined();
    });

    it('should throw error when unregistering non-existent mode', () => {
      expect(() => registry.unregister('non-existent')).toThrow(
        "Mode 'non-existent' is not registered"
      );
    });
  });

  describe('Mode Activation', () => {
    it('should activate basic modes', async () => {
      const mode: Mode = {
        id: 'activatable-mode',
        title: 'Activatable Mode',
        activate: vi.fn()
      };

      registry.register(mode);

      await registry.activate('activatable-mode', mockContext);

      expect(mode.activate).toHaveBeenCalledWith(mockContext);
      expect(registry.isActive('activatable-mode')).toBe(true);
    });

    it('should activate enhanced modes with lifecycle hooks', async () => {
      const onActivate = vi.fn();
      const mode: EnhancedMode = {
        id: 'enhanced-activatable',
        title: 'Enhanced Activatable',
        version: '1.0.0',
        author: 'Test',
        tags: [],
        priority: 1,
        activate: vi.fn(),
        onActivate
      };

      registry.register(mode);

      await registry.activate('enhanced-activatable', mockContext);

      expect(onActivate).toHaveBeenCalledWith(mockContext);
      expect(mode.activate).toHaveBeenCalledWith(mockContext);
      expect(registry.isActive('enhanced-activatable')).toBe(true);
    });

    it('should handle activation errors', async () => {
      const mode: Mode = {
        id: 'error-mode',
        title: 'Error Mode',
        activate: vi.fn().mockRejectedValue(new Error('Activation failed'))
      };

      registry.register(mode);

      await expect(registry.activate('error-mode', mockContext)).rejects.toThrow('Activation failed');
      expect(registry.getStatus('error-mode')?.status).toBe('error');
      expect(registry.getStatus('error-mode')?.error).toBe('Activation failed');
    });

    it('should not activate already active modes', async () => {
      const mode: Mode = {
        id: 'already-active',
        title: 'Already Active',
        activate: vi.fn()
      };

      registry.register(mode);
      await registry.activate('already-active', mockContext);

      // Reset the mock
      vi.clearAllMocks();

      // Try to activate again
      await registry.activate('already-active', mockContext);

      expect(mode.activate).not.toHaveBeenCalled();
      expect(registry.isActive('already-active')).toBe(true);
    });

    it('should prevent concurrent activation', async () => {
      const mode: Mode = {
        id: 'concurrent-mode',
        title: 'Concurrent Mode',
        activate: vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
        })
      };

      registry.register(mode);

      const activation1 = registry.activate('concurrent-mode', mockContext);
      const activation2 = registry.activate('concurrent-mode', mockContext);

      await expect(activation2).rejects.toThrow("already being activated");
      await activation1;
    });
  });

  describe('Mode Deactivation', () => {
    it('should deactivate modes with deactivation method', async () => {
      const mode: Mode = {
        id: 'deactivatable-mode',
        title: 'Deactivatable Mode',
        activate: vi.fn(),
        deactivate: vi.fn()
      };

      registry.register(mode);
      await registry.activate('deactivatable-mode', mockContext);

      await registry.deactivate('deactivatable-mode', mockContext);

      expect(mode.deactivate).toHaveBeenCalledWith(mockContext);
      expect(registry.isActive('deactivatable-mode')).toBe(false);
    });

    it('should deactivate enhanced modes with lifecycle hooks', async () => {
      const onDeactivate = vi.fn();
      const mode: EnhancedMode = {
        id: 'enhanced-deactivatable',
        title: 'Enhanced Deactivatable',
        version: '1.0.0',
        author: 'Test',
        tags: [],
        priority: 1,
        activate: vi.fn(),
        deactivate: vi.fn(),
        onDeactivate
      };

      registry.register(mode);
      await registry.activate('enhanced-deactivatable', mockContext);

      await registry.deactivate('enhanced-deactivatable', mockContext);

      expect(onDeactivate).toHaveBeenCalledWith(mockContext);
      expect(mode.deactivate).toHaveBeenCalledWith(mockContext);
      expect(registry.isActive('enhanced-deactivatable')).toBe(false);
    });

    it('should not deactivate inactive modes', async () => {
      const mode: Mode = {
        id: 'inactive-mode',
        title: 'Inactive Mode',
        activate: vi.fn(),
        deactivate: vi.fn()
      };

      registry.register(mode);

      await registry.deactivate('inactive-mode', mockContext);

      expect(mode.deactivate).not.toHaveBeenCalled();
      expect(registry.getStatus('inactive-mode')?.status).toBe('registered');
    });
  });

  describe('Dependency Management', () => {
    it('should handle mode dependencies', async () => {
      const dependency: Mode = {
        id: 'dependency',
        title: 'Dependency',
        activate: vi.fn()
      };

      const dependent: EnhancedMode = {
        id: 'dependent',
        title: 'Dependent',
        version: '1.0.0',
        author: 'Test',
        tags: [],
        priority: 2,
        dependencies: ['dependency'],
        activate: vi.fn()
      };

      registry.register(dependency);
      registry.register(dependent);

      // Activate dependent - should activate dependency first
      await registry.activate('dependent', mockContext);

      expect(dependency.activate).toHaveBeenCalled();
      expect(dependent.activate).toHaveBeenCalled();
      expect(registry.isActive('dependency')).toBe(true);
      expect(registry.isActive('dependent')).toBe(true);
    });

    it('should respect activation order based on dependencies', () => {
      const mode1: Mode = {
        id: 'mode1',
        title: 'Mode 1',
        activate: vi.fn()
      };

      const mode2: EnhancedMode = {
        id: 'mode2',
        title: 'Mode 2',
        version: '1.0.0',
        author: 'Test',
        tags: [],
        priority: 1,
        dependencies: ['mode1'],
        activate: vi.fn()
      };

      const mode3: EnhancedMode = {
        id: 'mode3',
        title: 'Mode 3',
        version: '1.0.0',
        author: 'Test',
        tags: [],
        priority: 2,
        dependencies: ['mode2'],
        activate: vi.fn()
      };

      registry.register(mode1);
      registry.register(mode2);
      registry.register(mode3);

      const order = registry.getActivationOrder();
      const mode1Index = order.indexOf('mode1');
      const mode2Index = order.indexOf('mode2');
      const mode3Index = order.indexOf('mode3');

      expect(mode1Index).toBeLessThan(mode2Index);
      expect(mode2Index).toBeLessThan(mode3Index);
    });

    it('should throw error for missing dependencies', async () => {
      const dependent: EnhancedMode = {
        id: 'dependent',
        title: 'Dependent',
        version: '1.0.0',
        author: 'Test',
        tags: [],
        priority: 1,
        dependencies: ['missing-dependency'],
        activate: vi.fn()
      };

      registry.register(dependent);

      await expect(
        registry.activate('dependent', mockContext)
      ).rejects.toThrow("Dependency 'missing-dependency' is not registered");
    });

    it('should detect circular dependencies', () => {
      const mode1: EnhancedMode = {
        id: 'mode1',
        title: 'Mode 1',
        version: '1.0.0',
        author: 'Test',
        tags: [],
        priority: 1,
        dependencies: ['mode2'],
        activate: vi.fn()
      };

      const mode2: EnhancedMode = {
        id: 'mode2',
        title: 'Mode 2',
        version: '1.0.0',
        author: 'Test',
        tags: [],
        priority: 1,
        dependencies: ['mode1'],
        activate: vi.fn()
      };

      registry.register(mode1);

      expect(() => registry.register(mode2)).toThrow(
        "Circular dependency detected involving mode 'mode2'"
      );
    });

    it('should handle optional dependencies', () => {
      const baseMode: Mode = {
        id: 'base',
        title: 'Base Mode',
        activate: vi.fn()
      };

      const withOptional: EnhancedMode = {
        id: 'with-optional',
        title: 'With Optional',
        version: '1.0.0',
        author: 'Test',
        tags: [],
        priority: 1,
        optionalDependencies: ['base'],
        activate: vi.fn()
      };

      registry.register(baseMode);
      registry.register(withOptional);

      const dependencies = registry.getDependencies('with-optional');
      expect(dependencies.required).toEqual([]);
      expect(dependencies.optional).toEqual(['base']);
    });

    it('should get dependents of a mode', () => {
      const dependency: Mode = {
        id: 'dependency',
        title: 'Dependency',
        activate: vi.fn()
      };

      const dependent1: EnhancedMode = {
        id: 'dependent1',
        title: 'Dependent 1',
        version: '1.0.0',
        author: 'Test',
        tags: [],
        priority: 1,
        dependencies: ['dependency'],
        activate: vi.fn()
      };

      const dependent2: EnhancedMode = {
        id: 'dependent2',
        title: 'Dependent 2',
        version: '1.0.0',
        author: 'Test',
        tags: [],
        priority: 1,
        dependencies: ['dependency'],
        activate: vi.fn()
      };

      registry.register(dependency);
      registry.register(dependent1);
      registry.register(dependent2);

      const dependents = registry.getDependents('dependency');
      expect(dependents).toContain('dependent1');
      expect(dependents).toContain('dependent2');
      expect(dependents).toHaveLength(2);
    });
  });

  describe('Status and Metrics', () => {
    it('should track mode status correctly', async () => {
      const mode: Mode = {
        id: 'status-mode',
        title: 'Status Mode',
        activate: vi.fn(),
        deactivate: vi.fn()
      };

      registry.register(mode);

      expect(registry.getStatus('status-mode')?.status).toBe('registered');

      await registry.activate('status-mode', mockContext);
      expect(registry.getStatus('status-mode')?.status).toBe('active');

      await registry.deactivate('status-mode', mockContext);
      expect(registry.getStatus('status-mode')?.status).toBe('inactive');
    });

    it('should track activation metrics', async () => {
      const mode: EnhancedMode = {
        id: 'metrics-mode',
        title: 'Metrics Mode',
        version: '1.0.0',
        author: 'Test',
        tags: [],
        priority: 1,
        activate: vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
        })
      };

      registry.register(mode);

      await registry.activate('metrics-mode', mockContext);

      const status = registry.getStatus('metrics-mode');
      expect(status?.metrics.activationCount).toBe(1);
      expect(status?.metrics.activationTime).toBeGreaterThan(40);
      expect(status?.metrics.errorCount).toBe(0);
    });

    it('should track activation history', async () => {
      const mode: EnhancedMode = {
        id: 'history-mode',
        title: 'History Mode',
        version: '1.0.0',
        author: 'Test',
        tags: [],
        priority: 1,
        activate: vi.fn(),
        onError: vi.fn()
      };

      registry.register(mode);

      // Successful activation
      await registry.activate('history-mode', mockContext);
      await registry.deactivate('history-mode', mockContext);

      // Failed activation
      const originalActivate = mode.activate;
      mode.activate = vi.fn().mockRejectedValue(new Error('Test error'));

      try {
        await registry.activate('history-mode', mockContext);
      } catch {
        // Expected to fail
      }

      const registration = registry.getRegistration('history-mode');
      const history = registration?.activationHistory;

      expect(history).toHaveLength(2);
      expect(history![0].success).toBe(true);
      expect(history![1].success).toBe(false);
      expect(history![1].error).toBe('Test error');
    });

    it('should update mode status and metrics', () => {
      const mode: Mode = {
        id: 'updatable-mode',
        title: 'Updatable Mode',
        activate: vi.fn()
      };

      registry.register(mode);

      registry.updateStatus('updatable-mode', { error: 'Custom error' });
      registry.updateMetrics('updatable-mode', { apiCalls: 5 });

      const status = registry.getStatus('updatable-mode');
      expect(status?.error).toBe('Custom error');
      expect(status?.metrics.apiCalls).toBe(5);
    });

    it('should provide registry statistics', () => {
      const mode1: Mode = { id: 'mode1', title: 'Mode 1', activate: vi.fn() };
      const mode2: EnhancedMode = {
        id: 'mode2',
        title: 'Mode 2',
        version: '1.0.0',
        author: 'Test',
        tags: [],
        priority: 1,
        dependencies: ['mode1'],
        activate: vi.fn()
      };

      registry.register(mode1);
      registry.register(mode2);

      const stats = registry.getStats();
      expect(stats.total).toBe(2);
      expect(stats.active).toBe(0);
      expect(stats.errors).toBe(0);
      expect(stats.withDependencies).toBe(1);
    });
  });

  describe('Graph Updates', () => {
    it('should broadcast graph updates to all modes', async () => {
      const mode1: Mode = {
        id: 'graph-mode1',
        title: 'Graph Mode 1',
        activate: vi.fn(),
        onGraphUpdate: vi.fn()
      };

      const mode2: EnhancedMode = {
        id: 'graph-mode2',
        title: 'Graph Mode 2',
        version: '1.0.0',
        author: 'Test',
        tags: [],
        priority: 1,
        activate: vi.fn(),
        onGraphUpdate: vi.fn()
      };

      registry.register(mode1);
      registry.register(mode2);

      const mockGraph: ProjectGraph = {
        files: [{ path: 'test.ts' }],
        dependencies: []
      };

      const contextWithGraph = {
        ...mockContext,
        graph: mockGraph
      };

      await registry.broadcastGraphUpdate(contextWithGraph);

      expect(mode1.onGraphUpdate).toHaveBeenCalledWith(contextWithGraph);
      expect(mode2.onGraphUpdate).toHaveBeenCalledWith(contextWithGraph, mockGraph);
    });

    it('should handle graph update errors gracefully', async () => {
      const errorHandler = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mode: EnhancedMode = {
        id: 'error-graph-mode',
        title: 'Error Graph Mode',
        version: '1.0.0',
        author: 'Test',
        tags: [],
        priority: 1,
        activate: vi.fn(),
        onGraphUpdate: vi.fn().mockRejectedValue(new Error('Graph update failed')),
        onError: vi.fn()
      };

      registry.register(mode);

      const mockGraph: ProjectGraph = {
        files: [{ path: 'test.ts' }],
        dependencies: []
      };

      const contextWithGraph = {
        ...mockContext,
        graph: mockGraph
      };

      await registry.broadcastGraphUpdate(contextWithGraph);

      expect(mode.onError).toHaveBeenCalled();
      expect(registry.getStatus('error-graph-mode')?.status).toBe('error');

      errorHandler.mockRestore();
    });
  });

  describe('Configuration', () => {
    it('should respect configuration settings', () => {
      const configRegistry = new EnhancedModeRegistry({
        enableDependencyResolution: false,
        enableCircularDependencyCheck: false,
        maxActivationRetries: 1
      });

      expect(configRegistry).toBeDefined();

      configRegistry.clear();
    });

    it('should provide default configuration', () => {
      const defaultRegistry = new EnhancedModeRegistry();

      expect(defaultRegistry).toBeDefined();

      defaultRegistry.clear();
    });
  });

  describe('Utility Methods', () => {
    it('should list all modes', () => {
      const mode1: Mode = { id: 'mode1', title: 'Mode 1', activate: vi.fn() };
      const mode2: Mode = { id: 'mode2', title: 'Mode 2', activate: vi.fn() };

      registry.register(mode1);
      registry.register(mode2);

      const modes = registry.list();
      expect(modes).toHaveLength(2);
      expect(modes.map(m => m.id)).toContain('mode1');
      expect(modes.map(m => m.id)).toContain('mode2');
    });

    it('should get active modes only', async () => {
      const mode1: Mode = { id: 'mode1', title: 'Mode 1', activate: vi.fn() };
      const mode2: Mode = { id: 'mode2', title: 'Mode 2', activate: vi.fn() };

      registry.register(mode1);
      registry.register(mode2);

      await registry.activate('mode1', mockContext);

      const activeModes = registry.getActiveModes();
      expect(activeModes).toHaveLength(1);
      expect(activeModes[0].id).toBe('mode1');
    });

    it('should get all statuses', () => {
      const mode1: Mode = { id: 'mode1', title: 'Mode 1', activate: vi.fn() };
      const mode2: EnhancedMode = {
        id: 'mode2',
        title: 'Mode 2',
        version: '1.0.0',
        author: 'Test',
        tags: [],
        priority: 1,
        activate: vi.fn()
      };

      registry.register(mode1);
      registry.register(mode2);

      const statuses = registry.getAllStatuses();
      expect(statuses).toHaveLength(2);
      expect(statuses.map(s => s.id)).toContain('mode1');
      expect(statuses.map(s => s.id)).toContain('mode2');
    });

    it('should check if dependencies are satisfied', () => {
      const dependency: Mode = {
        id: 'dependency',
        title: 'Dependency',
        activate: vi.fn()
      };

      const dependent: EnhancedMode = {
        id: 'dependent',
        title: 'Dependent',
        version: '1.0.0',
        author: 'Test',
        tags: [],
        priority: 1,
        dependencies: ['dependency'],
        activate: vi.fn()
      };

      registry.register(dependency);
      registry.register(dependent);

      expect(registry.areDependenciesSatisfied('dependent')).toBe(false);

      // Activate dependency
      registry.updateStatus('dependency', { status: 'active' as any });

      // Note: This would normally happen through activation
      const dependentStatus = registry.getStatus('dependent');
      if (dependentStatus) {
        dependentStatus.dependencies.satisfied = ['dependency'];
        dependentStatus.dependencies.missing = [];
      }

      expect(registry.areDependenciesSatisfied('dependent')).toBe(true);
    });

    it('should provide dependency graph', () => {
      const mode1: Mode = { id: 'mode1', title: 'Mode 1', activate: vi.fn() };
      const mode2: EnhancedMode = {
        id: 'mode2',
        title: 'Mode 2',
        version: '1.0.0',
        author: 'Test',
        tags: [],
        priority: 1,
        dependencies: ['mode1'],
        activate: vi.fn()
      };

      registry.register(mode1);
      registry.register(mode2);

      const graph = registry.getDependencyGraph();
      expect(graph.nodes.size).toBe(2);
      expect(graph.edges.get('mode2')).toHaveLength(1);
    });
  });

  describe('Resource Management', () => {
    it('should clear all data', () => {
      const mode1: Mode = { id: 'mode1', title: 'Mode 1', activate: vi.fn() };
      const mode2: Mode = { id: 'mode2', title: 'Mode 2', activate: vi.fn() };

      registry.register(mode1);
      registry.register(mode2);

      expect(registry.list()).toHaveLength(2);

      registry.clear();

      expect(registry.list()).toHaveLength(0);
      expect(registry.getStats().total).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing mode gracefully', () => {
      expect(registry.get('non-existent')).toBeUndefined();
      expect(registry.getStatus('non-existent')).toBeUndefined();
      expect(registry.getRegistration('non-existent')).toBeUndefined();
      expect(registry.isActive('non-existent')).toBe(false);
      expect(registry.getDependencies('non-existent')).toEqual({ required: [], optional: [] });
      expect(registry.getDependents('non-existent')).toEqual([]);
    });

    it('should handle activation with missing dependencies gracefully', async () => {
      const dependent: EnhancedMode = {
        id: 'dependent',
        title: 'Dependent',
        version: '1.0.0',
        author: 'Test',
        tags: [],
        priority: 1,
        dependencies: ['missing'],
        activate: vi.fn()
      };

      registry.register(dependent);

      await expect(
        registry.activate('dependent', mockContext)
      ).rejects.toThrow("Dependency 'missing' is not registered");
    });
  });
});