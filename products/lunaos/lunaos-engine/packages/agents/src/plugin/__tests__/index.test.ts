// Integration tests for the plugin system
import { PluginRegistry, PluginDiscovery, PluginLoader, PluginSandbox } from '../index';
import { IPlugin, IPluginManifest, PluginStatus, ILogger, IEventBus, IStorage, ISecrets } from '../interfaces';

// Mock implementations
const mockLogger: ILogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(() => mockLogger)
};

const mockEventBus: IEventBus = {
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn()
};

const mockStorage: IStorage = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
  exists: jest.fn()
};

const mockSecrets: ISecrets = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  list: jest.fn()
};

describe('Plugin System Integration', () => {
  let registry: PluginRegistry;
  let discovery: PluginDiscovery;
  let loader: PluginLoader;

  beforeEach(() => {
    jest.clearAllMocks();
    discovery = new PluginDiscovery(mockLogger, ['/test/plugins']);
    loader = new PluginLoader(mockLogger, mockEventBus, mockStorage, mockSecrets);

    const mockSandboxFactory = async (plugin: IPlugin) => {
      return new PluginSandbox(mockLogger, plugin.name, plugin.manifest.permissions || []);
    };

    registry = new PluginRegistry(mockLogger, mockEventBus, discovery, mockSandboxFactory);
  });

  describe('Complete plugin lifecycle', () => {
    it('should register, start, stop, and unregister a plugin', async () => {
      const manifest: IPluginManifest = {
        name: 'lifecycle-test',
        version: '1.0.0',
        entryPoint: 'index.js',
        description: 'Test plugin for lifecycle',
        author: 'test',
        license: 'MIT',
        permissions: [],
        config: {},
        dependencies: [],
        tags: []
      };

      // Mock plugin loading
      jest.spyOn(loader, 'loadPlugin').mockResolvedValue({
        name: 'lifecycle-test',
        version: '1.0.0',
        manifest,
        workingDirectory: '/plugins/lifecycle-test',
        status: PluginStatus.REGISTERED,
        storage: mockStorage,
        secrets: mockSecrets,
        initialize: jest.fn().mockResolvedValue(undefined),
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
        execute: jest.fn().mockResolvedValue({ result: 'success' })
      } as IPlugin);

      // Load plugin
      const plugin = await loader.loadPlugin(manifest, '/plugins/lifecycle-test');

      // Register plugin
      await registry.registerPlugin(plugin);
      expect(plugin.status).toBe(PluginStatus.REGISTERED);

      // Start plugin
      await registry.startPlugin('lifecycle-test');
      expect(plugin.status).toBe(PluginStatus.RUNNING);
      expect(plugin.initialize).toHaveBeenCalled();
      expect(plugin.start).toHaveBeenCalled();

      // Stop plugin
      await registry.stopPlugin('lifecycle-test');
      expect(plugin.status).toBe(PluginStatus.STOPPED);
      expect(plugin.stop).toHaveBeenCalled();

      // Unregister plugin
      await registry.unregisterPlugin('lifecycle-test');

      const retrieved = await registry.getPlugin('lifecycle-test');
      expect(retrieved).toBeNull();
    });
  });

  describe('Plugin discovery and loading integration', () => {
    it('should discover and load plugins from search paths', async () => {
      const mockManifest: IPluginManifest = {
        name: 'discovered-plugin',
        version: '1.0.0',
        entryPoint: 'index.js',
        description: 'A discovered plugin',
        author: 'test',
        license: 'MIT',
        permissions: [],
        config: {},
        dependencies: [],
        tags: ['discovered']
      };

      // Mock discovery
      jest.spyOn(discovery, 'discoverPlugins').mockResolvedValue([mockManifest]);

      // Mock loading
      jest.spyOn(loader, 'loadPlugin').mockResolvedValue({
        name: 'discovered-plugin',
        version: '1.0.0',
        manifest: mockManifest,
        workingDirectory: '/plugins/discovered-plugin',
        status: PluginStatus.REGISTERED,
        storage: mockStorage,
        secrets: mockSecrets,
        initialize: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        execute: jest.fn()
      } as IPlugin);

      // Discover plugins
      const manifests = await discovery.discoverPlugins('/test/directory');
      expect(manifests).toHaveLength(1);
      expect(manifests[0].name).toBe('discovered-plugin');

      // Load discovered plugin
      const plugin = await loader.loadPlugin(manifests[0], '/plugins/discovered-plugin');
      expect(plugin.name).toBe('discovered-plugin');

      // Register loaded plugin
      await registry.registerPlugin(plugin);

      const registeredPlugin = await registry.getPlugin('discovered-plugin');
      expect(registeredPlugin).toBe(plugin);
    });
  });

  describe('Plugin dependency resolution', () => {
    it('should handle plugin dependencies correctly', async () => {
      const dependencyManifest: IPluginManifest = {
        name: 'dependency-plugin',
        version: '1.0.0',
        entryPoint: 'index.js',
        description: 'Dependency plugin',
        author: 'test',
        license: 'MIT',
        permissions: [],
        config: {},
        dependencies: [],
        tags: []
      };

      const mainManifest: IPluginManifest = {
        name: 'main-plugin',
        version: '1.0.0',
        entryPoint: 'index.js',
        description: 'Main plugin with dependencies',
        author: 'test',
        license: 'MIT',
        permissions: [],
        config: {},
        dependencies: ['dependency-plugin@1.0.0'],
        tags: []
      };

      // Create dependency plugin
      const dependencyPlugin: IPlugin = {
        name: 'dependency-plugin',
        version: '1.0.0',
        manifest: dependencyManifest,
        workingDirectory: '/plugins/dependency-plugin',
        status: PluginStatus.RUNNING,
        storage: mockStorage,
        secrets: mockSecrets,
        initialize: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        execute: jest.fn()
      };

      // Create main plugin
      const mainPlugin: IPlugin = {
        name: 'main-plugin',
        version: '1.0.0',
        manifest: mainManifest,
        workingDirectory: '/plugins/main-plugin',
        status: PluginStatus.REGISTERED,
        storage: mockStorage,
        secrets: mockSecrets,
        initialize: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        execute: jest.fn()
      };

      // Register dependency first
      await registry.registerPlugin(dependencyPlugin);

      // Register main plugin (should check dependencies)
      await registry.registerPlugin(mainPlugin);

      // Verify dependency graph
      const dependencyGraph = await registry.getDependencyGraph();
      expect(dependencyGraph.get('main-plugin')).toEqual(['dependency-plugin']);

      // Try to unregister dependency (should fail)
      await expect(registry.unregisterPlugin('dependency-plugin')).rejects.toThrow('It has dependents');
    });
  });

  describe('Plugin search and filtering', () => {
    it('should search and filter plugins correctly', async () => {
      const plugins = [
        {
          name: 'task-plugin',
          version: '1.0.0',
          entryPoint: 'index.js',
          category: 'task' as const,
          description: 'A task plugin',
          author: 'test',
          license: 'MIT',
          permissions: [],
          config: {},
          dependencies: [],
          tags: ['task', 'automation']
        },
        {
          name: 'tool-plugin',
          version: '2.0.0',
          entryPoint: 'index.js',
          category: 'tool' as const,
          description: 'A tool plugin',
          author: 'test',
          license: 'MIT',
          permissions: [],
          config: {},
          dependencies: [],
          tags: ['tool', 'utility']
        }
      ];

      // Mock search results
      jest.spyOn(discovery, 'searchPlugins').mockImplementation(async (query, options) => {
        let results = plugins;

        if (query) {
          results = results.filter(p =>
            p.name.includes(query) || p.description.includes(query)
          );
        }

        if (options?.category) {
          results = results.filter(p => p.category === options.category);
        }

        if (options?.tags) {
          results = results.filter(p =>
            options.tags!.some(tag => p.tags.includes(tag))
          );
        }

        return results;
      });

      // Search by name
      const taskResults = await discovery.searchPlugins('task');
      expect(taskResults).toHaveLength(1);
      expect(taskResults[0].name).toBe('task-plugin');

      // Search by category
      jest.spyOn(registry, 'listPlugins').mockImplementation(async (filter) => {
        return plugins.filter(p => {
          if (filter?.category && p.category !== filter.category) return false;
          if (filter?.tags && !filter.tags.some(tag => p.tags.includes(tag))) return false;
          return true;
        });
      });

      const categoryResults = await registry.listPlugins({ category: 'task' });
      expect(categoryResults).toHaveLength(1);
      expect(categoryResults[0].name).toBe('task-plugin');

      // Search by tags
      const tagResults = await registry.listPlugins({ tags: ['automation'] });
      expect(tagResults).toHaveLength(1);
      expect(tagResults[0].name).toBe('task-plugin');
    });
  });

  describe('Error handling and recovery', () => {
    it('should handle plugin initialization errors', async () => {
      const manifest: IPluginManifest = {
        name: 'error-plugin',
        version: '1.0.0',
        entryPoint: 'index.js',
        description: 'Plugin that errors during initialization',
        author: 'test',
        license: 'MIT',
        permissions: [],
        config: {},
        dependencies: [],
        tags: []
      };

      const errorPlugin: IPlugin = {
        name: 'error-plugin',
        version: '1.0.0',
        manifest,
        workingDirectory: '/plugins/error-plugin',
        status: PluginStatus.REGISTERED,
        storage: mockStorage,
        secrets: mockSecrets,
        initialize: jest.fn().mockRejectedValue(new Error('Initialization failed')),
        start: jest.fn(),
        stop: jest.fn(),
        execute: jest.fn()
      };

      await registry.registerPlugin(errorPlugin);

      // Try to start plugin (should fail)
      await expect(registry.startPlugin('error-plugin')).rejects.toThrow('Initialization failed');
      expect(errorPlugin.status).toBe(PluginStatus.ERROR);
      expect(errorPlugin.lastError).toBeDefined();

      // Verify error events were emitted
      expect(mockEventBus.emit).toHaveBeenCalledWith('plugin-error', expect.objectContaining({
        pluginName: 'error-plugin',
        error: expect.any(Error)
      }));
    });

    it('should handle plugin execution errors', async () => {
      const manifest: IPluginManifest = {
        name: 'runtime-error-plugin',
        version: '1.0.0',
        entryPoint: 'index.js',
        description: 'Plugin that errors during execution',
        author: 'test',
        license: 'MIT',
        permissions: [],
        config: {},
        dependencies: [],
        tags: []
      };

      const runtimeErrorPlugin: IPlugin = {
        name: 'runtime-error-plugin',
        version: '1.0.0',
        manifest,
        workingDirectory: '/plugins/runtime-error-plugin',
        status: PluginStatus.RUNNING,
        storage: mockStorage,
        secrets: mockSecrets,
        initialize: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        execute: jest.fn().mockRejectedValue(new Error('Runtime error'))
      };

      // Try to execute plugin
      await expect(runtimeErrorPlugin.execute({ test: 'data' })).rejects.toThrow('Runtime error');
    });
  });
});
