/**
 * Plugin Core Integration Tests
 * Simplified integration tests focusing on core plugin functionality
 */

import { PluginManager } from '../../../backend/src/plugins/PluginManager';
import { PluginSandboxService } from '../../../backend/src/services/PluginSandboxService';
import { PluginPermissionService } from '../../../backend/src/services/PluginPermissionService';
import { promises as fs } from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Mock dependencies
jest.mock('../../../backend/src/services/AnalyticsService');
jest.mock('../../../backend/src/services/NotificationService');
jest.mock('../../../backend/src/services/FileStorageService');
jest.mock('../../../backend/src/database/database.js');

describe('Plugin Core Integration Tests', () => {
  let pluginManager: PluginManager;
  let sandboxService: PluginSandboxService;
  let permissionService: PluginPermissionService;
  let testPluginsDir: string;

  beforeAll(async () => {
    // Setup test environment
    testPluginsDir = path.join(process.cwd(), 'test-plugins-core');
    await fs.ensureDir(testPluginsDir);

    // Initialize services
    pluginManager = new PluginManager({
      pluginsDirectory: testPluginsDir,
      maxConcurrentPlugins: 5,
      enableSandboxing: false, // Disable for simpler testing
      hotReloadEnabled: false,
    });

    sandboxService = new PluginSandboxService();
    permissionService = new PluginPermissionService();
  });

  afterAll(async () => {
    // Cleanup
    await pluginManager?.shutdown();
    await fs.remove(testPluginsDir);
  });

  beforeEach(async () => {
    // Reset all services
    jest.clearAllMocks();
    await fs.emptyDir(testPluginsDir);
  });

  describe('Plugin Manager Basic Functionality', () => {
    test('should load and start a simple plugin', async () => {
      // 1. Create a simple test plugin
      const pluginId = 'simple-test-plugin';
      const pluginManifest = {
        id: pluginId,
        name: 'Simple Test Plugin',
        version: '1.0.0',
        description: 'A simple test plugin',
        author: 'Test Suite',
        license: 'MIT',
        main: 'index.js',
        permissions: ['read'],
        apiVersion: '1.0.0',
        dependencies: {},
        config: {},
        category: 'testing',
        tags: ['test'],
        publishedAt: new Date(),
        autoLoad: true,
      };

      const pluginCode = `
        module.exports = {
          onInitialize: (context) => {
            return { message: 'Plugin initialized', id: '${pluginId}' };
          },
          onExecute: (context, params) => {
            return { processed: true, data: params, timestamp: Date.now() };
          },
          onDestroy: (context) => {
            return { message: 'Plugin destroyed', id: '${pluginId}' };
          }
        };
      `;

      const pluginDir = path.join(testPluginsDir, pluginId);
      await fs.ensureDir(pluginDir);
      await fs.writeJSON(path.join(pluginDir, 'plugin.json'), pluginManifest);
      await fs.writeFile(path.join(pluginDir, 'index.js'), pluginCode);

      // 2. Load plugin
      const plugin = await pluginManager.loadPlugin(pluginDir);
      expect(plugin.id).toBe(pluginId);
      expect(plugin.status).toBe('loaded');

      // 3. Start plugin
      await pluginManager.startPlugin(plugin.id);
      expect(pluginManager.getPlugin(plugin.id)?.status).toBe('running');

      // 4. Execute plugin hook
      const result = await pluginManager.executePluginHook(plugin.id, 'onExecute', [{ test: 'data' }]);
      expect(result.processed).toBe(true);
      expect(result.data).toEqual({ test: 'data' });

      // 5. Stop plugin
      await pluginManager.stopPlugin(plugin.id);
      expect(pluginManager.getPlugin(plugin.id)?.status).toBe('stopped');

      // 6. Unload plugin
      await pluginManager.unloadPlugin(plugin.id);
      expect(pluginManager.getPlugin(plugin.id)).toBeUndefined();
    });

    test('should handle multiple plugins simultaneously', async () => {
      const pluginCount = 3;
      const plugins = [];

      // 1. Create multiple plugins
      for (let i = 0; i < pluginCount; i++) {
        const pluginId = `multi-plugin-${i}`;
        const pluginManifest = {
          id: pluginId,
          name: `Multi Plugin ${i}`,
          version: '1.0.0',
          description: `Plugin ${i} for multi-plugin testing`,
          author: 'Test Suite',
          license: 'MIT',
          main: 'index.js',
          permissions: ['read'],
          apiVersion: '1.0.0',
          dependencies: {},
          config: {},
          category: 'testing',
          tags: ['test', 'multi'],
          publishedAt: new Date(),
          autoLoad: true,
        };

        const pluginCode = `
          module.exports = {
            onInitialize: (context) => {
              return { message: 'Plugin initialized', id: '${pluginId}' };
            },
            onExecute: (context, params) => {
              return {
                processed: true,
                data: params,
                pluginId: '${pluginId}',
                index: ${i}
              };
            }
          };
        `;

        const pluginDir = path.join(testPluginsDir, pluginId);
        await fs.ensureDir(pluginDir);
        await fs.writeJSON(path.join(pluginDir, 'plugin.json'), pluginManifest);
        await fs.writeFile(path.join(pluginDir, 'index.js'), pluginCode);

        const plugin = await pluginManager.loadPlugin(pluginDir);
        plugins.push(plugin);
      }

      // 2. Start all plugins
      for (const plugin of plugins) {
        await pluginManager.startPlugin(plugin.id);
      }

      // 3. Verify all plugins are running
      const runningPlugins = pluginManager.getRunningPlugins();
      expect(runningPlugins).toHaveLength(pluginCount);

      // 4. Execute all plugins
      const results = await Promise.all(
        plugins.map(plugin =>
          pluginManager.executePluginHook(plugin.id, 'onExecute', [{ test: 'multi' }])
        )
      );

      // 5. Verify results
      expect(results).toHaveLength(pluginCount);
      for (let i = 0; i < results.length; i++) {
        expect(results[i].processed).toBe(true);
        expect(results[i].data).toEqual({ test: 'multi' });
        expect(results[i].pluginId).toBe(`multi-plugin-${i}`);
        expect(results[i].index).toBe(i);
      }

      // 6. Stop all plugins
      for (const plugin of plugins) {
        await pluginManager.stopPlugin(plugin.id);
      }

      // 7. Verify all plugins are stopped
      const stillRunning = pluginManager.getRunningPlugins();
      expect(stillRunning).toHaveLength(0);
    });

    test('should handle plugin errors gracefully', async () => {
      // 1. Create a plugin that throws errors
      const pluginId = 'error-plugin';
      const pluginManifest = {
        id: pluginId,
        name: 'Error Plugin',
        version: '1.0.0',
        description: 'Plugin that throws errors',
        author: 'Test Suite',
        license: 'MIT',
        main: 'index.js',
        permissions: ['read'],
        apiVersion: '1.0.0',
        dependencies: {},
        config: {},
        category: 'testing',
        tags: ['test', 'error'],
        publishedAt: new Date(),
        autoLoad: true,
      };

      const pluginCode = `
        module.exports = {
          onInitialize: (context) => {
            throw new Error('Initialization failed');
          },
          onExecute: (context, params) => {
            throw new Error('Execution failed');
          }
        };
      `;

      const pluginDir = path.join(testPluginsDir, pluginId);
      await fs.ensureDir(pluginDir);
      await fs.writeJSON(path.join(pluginDir, 'plugin.json'), pluginManifest);
      await fs.writeFile(path.join(pluginDir, 'index.js'), pluginCode);

      // 2. Load plugin
      const plugin = await pluginManager.loadPlugin(pluginDir);
      expect(plugin.status).toBe('loaded');

      // 3. Starting plugin should fail gracefully
      await expect(pluginManager.startPlugin(plugin.id)).rejects.toThrow('Initialization failed');

      const pluginStatus = pluginManager.getPlugin(plugin.id)?.status;
      expect(['error', 'stopped']).toContain(pluginStatus);

      // 4. System should still be functional
      const systemPlugins = pluginManager.getPlugins();
      expect(systemPlugins).toHaveLength(1); // The error plugin is still loaded but in error state

      // 5. Create a working plugin to verify system is still functional
      const workingPluginId = 'working-plugin';
      const workingManifest = {
        id: workingPluginId,
        name: 'Working Plugin',
        version: '1.0.0',
        description: 'A working plugin',
        author: 'Test Suite',
        license: 'MIT',
        main: 'index.js',
        permissions: ['read'],
        apiVersion: '1.0.0',
        dependencies: {},
        config: {},
        category: 'testing',
        tags: ['test'],
        publishedAt: new Date(),
        autoLoad: true,
      };

      const workingCode = `
        module.exports = {
          onExecute: (context, params) => {
            return { success: true, data: params };
          }
        };
      `;

      const workingDir = path.join(testPluginsDir, workingPluginId);
      await fs.ensureDir(workingDir);
      await fs.writeJSON(path.join(workingDir, 'plugin.json'), workingManifest);
      await fs.writeFile(path.join(workingDir, 'index.js'), workingCode);

      const workingPlugin = await pluginManager.loadPlugin(workingDir);
      await pluginManager.startPlugin(workingPlugin.id);

      const result = await pluginManager.executePluginHook(workingPlugin.id, 'onExecute', [{ test: 'data' }]);
      expect(result.success).toBe(true);

      // 6. Cleanup
      await pluginManager.stopPlugin(workingPlugin.id);
    });
  });

  describe('Plugin Permission Service Integration', () => {
    test('should validate plugin permissions correctly', async () => {
      // 1. Create plugin with various permissions
      const pluginManifest = {
        id: 'permission-test-plugin',
        name: 'Permission Test Plugin',
        version: '1.0.0',
        permissions: ['read', 'write', 'network'],
      };

      const testUser = {
        id: 'test-user-1',
        role: 'user',
        plan: 'pro',
      };

      // 2. Test permission checking
      const result = await permissionService.checkPermission(
        pluginManifest.id,
        'read',
        testUser.id,
        { manifest: pluginManifest }
      );

      expect(result.granted).toBe(true);
    });

    test('should deny sensitive permissions for regular users', async () => {
      // 1. Create plugin with sensitive permissions
      const pluginManifest = {
        id: 'sensitive-plugin',
        name: 'Sensitive Plugin',
        version: '1.0.0',
        permissions: ['read', 'write', 'system', 'admin'],
      };

      const testUser = {
        id: 'test-user-1',
        role: 'user',
        plan: 'free',
      };

      // 2. Test permission checking for sensitive permissions
      const systemResult = await permissionService.checkPermission(
        pluginManifest.id,
        'system',
        testUser.id,
        { manifest: pluginManifest }
      );

      const adminResult = await permissionService.checkPermission(
        pluginManifest.id,
        'admin',
        testUser.id,
        { manifest: pluginManifest }
      );

      expect(systemResult.granted).toBe(false);
      expect(adminResult.granted).toBe(false);
    });
  });

  describe('Plugin Statistics and Monitoring', () => {
    test('should track plugin execution statistics', async () => {
      const pluginId = 'stats-plugin';
      const pluginManifest = {
        id: pluginId,
        name: 'Stats Plugin',
        version: '1.0.0',
        description: 'Plugin for testing statistics',
        author: 'Test Suite',
        license: 'MIT',
        main: 'index.js',
        permissions: ['read'],
        apiVersion: '1.0.0',
        dependencies: {},
        config: {},
        category: 'testing',
        tags: ['test', 'stats'],
        publishedAt: new Date(),
        autoLoad: true,
      };

      const pluginCode = `
        module.exports = {
          onExecute: (context, params) => {
            return { processed: true, data: params, executionCount: 1 };
          }
        };
      `;

      const pluginDir = path.join(testPluginsDir, pluginId);
      await fs.ensureDir(pluginDir);
      await fs.writeJSON(path.join(pluginDir, 'plugin.json'), pluginManifest);
      await fs.writeFile(path.join(pluginDir, 'index.js'), pluginCode);

      // 1. Load and start plugin
      const plugin = await pluginManager.loadPlugin(pluginDir);
      await pluginManager.startPlugin(plugin.id);

      // 2. Execute plugin multiple times
      const executionCount = 5;
      for (let i = 0; i < executionCount; i++) {
        await pluginManager.executePluginHook(plugin.id, 'onExecute', [{ iteration: i }]);
      }

      // 3. Check plugin statistics
      const stats = pluginManager.getPluginStats(plugin.id);
      expect(stats.executionCount).toBe(executionCount);
      expect(stats.totalExecutionTime).toBeGreaterThan(0);
      expect(stats.averageExecutionTime).toBeGreaterThan(0);
      expect(stats.errorCount).toBe(0);

      // 4. Cleanup
      await pluginManager.stopPlugin(plugin.id);
    });
  });

  describe('Plugin Event System', () => {
    test('should emit and handle plugin events', async () => {
      const pluginId = 'event-plugin';
      const events: Array<{ event: string; data: any }> = [];

      // 1. Listen to plugin manager events
      pluginManager.on('pluginLoaded', (plugin) => {
        events.push({ event: 'pluginLoaded', data: plugin.id });
      });

      pluginManager.on('pluginStarted', (plugin) => {
        events.push({ event: 'pluginStarted', data: plugin.id });
      });

      pluginManager.on('pluginStopped', (plugin) => {
        events.push({ event: 'pluginStopped', data: plugin.id });
      });

      // 2. Create and load plugin
      const pluginManifest = {
        id: pluginId,
        name: 'Event Plugin',
        version: '1.0.0',
        description: 'Plugin for testing events',
        author: 'Test Suite',
        license: 'MIT',
        main: 'index.js',
        permissions: ['read'],
        apiVersion: '1.0.0',
        dependencies: {},
        config: {},
        category: 'testing',
        tags: ['test', 'event'],
        publishedAt: new Date(),
        autoLoad: true,
      };

      const pluginCode = `
        module.exports = {
          onInitialize: (context) => {
            return { message: 'Plugin initialized' };
          }
        };
      `;

      const pluginDir = path.join(testPluginsDir, pluginId);
      await fs.ensureDir(pluginDir);
      await fs.writeJSON(path.join(pluginDir, 'plugin.json'), pluginManifest);
      await fs.writeFile(path.join(pluginDir, 'index.js'), pluginCode);

      // 3. Load and start plugin
      const plugin = await pluginManager.loadPlugin(pluginDir);
      await pluginManager.startPlugin(plugin.id);
      await pluginManager.stopPlugin(plugin.id);

      // 4. Verify events were emitted
      expect(events).toHaveLength(3);
      expect(events[0].event).toBe('pluginLoaded');
      expect(events[0].data).toBe(pluginId);
      expect(events[1].event).toBe('pluginStarted');
      expect(events[1].data).toBe(pluginId);
      expect(events[2].event).toBe('pluginStopped');
      expect(events[2].data).toBe(pluginId);
    });
  });

  describe('Plugin Configuration Management', () => {
    test('should handle plugin configuration', async () => {
      const pluginId = 'config-plugin';
      const pluginConfig = {
        apiKey: 'test-api-key',
        timeout: 5000,
        enabled: true,
        features: {
          advanced: true,
          basic: false,
        },
      };

      const pluginManifest = {
        id: pluginId,
        name: 'Config Plugin',
        version: '1.0.0',
        description: 'Plugin for testing configuration',
        author: 'Test Suite',
        license: 'MIT',
        main: 'index.js',
        permissions: ['read'],
        apiVersion: '1.0.0',
        dependencies: {},
        config: pluginConfig,
        category: 'testing',
        tags: ['test', 'config'],
        publishedAt: new Date(),
        autoLoad: true,
      };

      const pluginCode = `
        module.exports = {
          onInitialize: (context) => {
            return {
              message: 'Plugin initialized',
              config: context.config
            };
          },
          onExecute: (context, params) => {
            return {
              processed: true,
              data: params,
              config: context.config
            };
          }
        };
      `;

      const pluginDir = path.join(testPluginsDir, pluginId);
      await fs.ensureDir(pluginDir);
      await fs.writeJSON(path.join(pluginDir, 'plugin.json'), pluginManifest);
      await fs.writeFile(path.join(pluginDir, 'index.js'), pluginCode);

      // 1. Load and start plugin
      const plugin = await pluginManager.loadPlugin(pluginDir);
      await pluginManager.startPlugin(plugin.id);

      // 2. Verify configuration is accessible
      const initResult = await pluginManager.executePluginHook(plugin.id, 'onInitialize', []);
      expect(initResult.config).toEqual(pluginConfig);

      const execResult = await pluginManager.executePluginHook(plugin.id, 'onExecute', [{ test: 'data' }]);
      expect(execResult.config).toEqual(pluginConfig);

      // 3. Cleanup
      await pluginManager.stopPlugin(plugin.id);
    });
  });
});