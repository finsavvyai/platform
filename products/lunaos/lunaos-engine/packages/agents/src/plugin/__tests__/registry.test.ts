import { PluginRegistry, PluginDiscovery } from '../registry';
import { PluginLoader, PluginSandbox } from '../loader';
import {
  IPlugin,
  IPluginManifest,
  PluginStatus,
  PluginContext,
  IPluginSandbox,
  ILogger,
  IEventBus,
  IStorage,
  ISecrets
} from '../interfaces';
import { EventEmitter } from 'events';

// Mock implementations
const mockLogger: ILogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn().mockReturnValue(mockLogger)
};

const mockEventBus: IEventBus = new EventEmitter() as IEventBus;
mockEventBus.emit = jest.fn();

const mockStorage: IStorage = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  exists: jest.fn(),
  list: jest.fn()
};

const mockSecrets: ISecrets = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  exists: jest.fn()
};

const mockSandboxFactory = jest.fn().mockResolvedValue({
  execute: jest.fn(),
  evaluate: jest.fn(),
  addResource: jest.fn(),
  removeResource: jest.fn(),
  getResources: jest.fn(),
  checkPermission: jest.fn()
} as IPluginSandbox);

describe('PluginRegistry', () => {
  let registry: PluginRegistry;
  let discovery: PluginDiscovery;

  beforeEach(() => {
    jest.clearAllMocks();
    discovery = new PluginDiscovery(mockLogger, ['./plugins']);
    registry = new PluginRegistry(mockLogger, mockEventBus, discovery, mockSandboxFactory);
  });

  describe('registerPlugin', () => {
    it('should register a valid plugin successfully', async () => {
      const plugin: IPlugin = createMockPlugin();

      await registry.registerPlugin(plugin);

      const retrievedPlugin = await registry.getPlugin('test-plugin');
      expect(retrievedPlugin).toBe(plugin);
      expect(mockEventBus.emit).toHaveBeenCalledWith('plugin-registered', expect.any(Object));
    });

    it('should throw error for duplicate plugin registration', async () => {
      const plugin1: IPlugin = createMockPlugin();
      const plugin2: IPlugin = createMockPlugin({ version: '2.0.0' });

      await registry.registerPlugin(plugin1);

      await expect(registry.registerPlugin(plugin2)).rejects.toThrow(
        'Plugin test-plugin already registered with version 1.0.0'
      );
    });

    it('should throw error for missing manifest', async () => {
      const plugin: IPlugin = createMockPlugin();
      delete (plugin as any).manifest;

      await expect(registry.registerPlugin(plugin)).rejects.toThrow(
        'Plugin test-plugin missing manifest'
      );
    });

    it('should throw error for invalid version format', async () => {
      const plugin: IPlugin = createMockPlugin({ version: 'invalid' });

      await expect(registry.registerPlugin(plugin)).rejects.toThrow(
        'Invalid version format: invalid'
      );
    });

    it('should throw error for missing dependency', async () => {
      const plugin: IPlugin = createMockPlugin({
        manifest: {
          ...createMockManifest(),
          dependencies: ['missing-dep@1.0.0']
        }
      });

      await expect(registry.registerPlugin(plugin)).rejects.toThrow(
        'Dependency not found: missing-dep'
      );
    });
  });

  describe('unregisterPlugin', () => {
    it('should unregister a plugin successfully', async () => {
      const plugin: IPlugin = createMockPlugin();

      await registry.registerPlugin(plugin);
      await registry.unregisterPlugin('test-plugin');

      const retrievedPlugin = await registry.getPlugin('test-plugin');
      expect(retrievedPlugin).toBeNull();
      expect(mockEventBus.emit).toHaveBeenCalledWith('plugin-unregistered', expect.any(Object));
    });

    it('should throw error for non-existent plugin', async () => {
      await expect(registry.unregisterPlugin('non-existent')).rejects.toThrow(
        'Plugin not found: non-existent'
      );
    });

    it('should throw error when plugin has dependents', async () => {
      const plugin1: IPlugin = createMockPlugin({ name: 'dep-plugin' });
      const plugin2: IPlugin = createMockPlugin({
        name: 'main-plugin',
        manifest: {
          ...createMockManifest(),
          dependencies: ['dep-plugin@1.0.0']
        }
      });

      await registry.registerPlugin(plugin1);

      // Mock the dependency to be available
      const mockDep = await registry.getPlugin('dep-plugin');
      if (mockDep) {
        mockDep.status = PluginStatus.RUNNING;
      }

      await registry.registerPlugin(plugin2);

      await expect(registry.unregisterPlugin('dep-plugin')).rejects.toThrow(
        'Cannot unregister plugin dep-plugin. It has dependents: main-plugin'
      );
    });
  });

  describe('startPlugin', () => {
    it('should start a plugin successfully', async () => {
      const plugin: IPlugin = createMockPlugin();
      const mockInitialize = jest.fn().mockResolvedValue(undefined);
      const mockStart = jest.fn().mockResolvedValue(undefined);

      plugin.initialize = mockInitialize;
      plugin.start = mockStart;

      await registry.registerPlugin(plugin);
      await registry.startPlugin('test-plugin');

      expect(plugin.status).toBe(PluginStatus.RUNNING);
      expect(mockInitialize).toHaveBeenCalled();
      expect(mockStart).toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalledWith('plugin-started', expect.any(Object));
    });

    it('should throw error for non-existent plugin', async () => {
      await expect(registry.startPlugin('non-existent')).rejects.toThrow(
        'Plugin not found: non-existent'
      );
    });

    it('should throw error when plugin is already running', async () => {
      const plugin: IPlugin = createMockPlugin();
      plugin.status = PluginStatus.RUNNING;

      await registry.registerPlugin(plugin);

      await expect(registry.startPlugin('test-plugin')).rejects.toThrow(
        'Cannot start plugin test-plugin in status: RUNNING'
      );
    });

    it('should handle plugin initialization errors', async () => {
      const plugin: IPlugin = createMockPlugin();
      const mockInitialize = jest.fn().mockRejectedValue(new Error('Init failed'));

      plugin.initialize = mockInitialize;

      await registry.registerPlugin(plugin);

      await expect(registry.startPlugin('test-plugin')).rejects.toThrow('Init failed');
      expect(plugin.status).toBe(PluginStatus.ERROR);
      expect(plugin.lastError).toBeInstanceOf(Error);
      expect(mockEventBus.emit).toHaveBeenCalledWith('plugin-error', expect.any(Object));
    });
  });

  describe('stopPlugin', () => {
    it('should stop a plugin successfully', async () => {
      const plugin: IPlugin = createMockPlugin();
      const mockStop = jest.fn().mockResolvedValue(undefined);

      plugin.status = PluginStatus.RUNNING;
      plugin.stop = mockStop;

      await registry.registerPlugin(plugin);
      await registry.stopPlugin('test-plugin');

      expect(plugin.status).toBe(PluginStatus.STOPPED);
      expect(mockStop).toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalledWith('plugin-stopped', expect.any(Object));
    });

    it('should throw error for non-existent plugin', async () => {
      await expect(registry.stopPlugin('non-existent')).rejects.toThrow(
        'Plugin not found: non-existent'
      );
    });

    it('should handle plugin stop errors', async () => {
      const plugin: IPlugin = createMockPlugin();
      const mockStop = jest.fn().mockRejectedValue(new Error('Stop failed'));

      plugin.status = PluginStatus.RUNNING;
      plugin.stop = mockStop;

      await registry.registerPlugin(plugin);

      await expect(registry.stopPlugin('test-plugin')).rejects.toThrow('Stop failed');
      expect(plugin.status).toBe(PluginStatus.ERROR);
      expect(plugin.lastError).toBeInstanceOf(Error);
    });
  });

  describe('listPlugins', () => {
    it('should list all plugins when no filter provided', async () => {
      const plugin1: IPlugin = createMockPlugin({ name: 'plugin1' });
      const plugin2: IPlugin = createMockPlugin({ name: 'plugin2' });

      await registry.registerPlugin(plugin1);
      await registry.registerPlugin(plugin2);

      const plugins = await registry.listPlugins();
      expect(plugins).toHaveLength(2);
      expect(plugins.map(p => p.name)).toContain('plugin1');
      expect(plugins.map(p => p.name)).toContain('plugin2');
    });

    it('should filter plugins by category', async () => {
      const plugin1: IPlugin = createMockPlugin({
        name: 'plugin1',
        manifest: { ...createMockManifest(), category: 'task' }
      });
      const plugin2: IPlugin = createMockPlugin({
        name: 'plugin2',
        manifest: { ...createMockManifest(), category: 'tool' }
      });

      await registry.registerPlugin(plugin1);
      await registry.registerPlugin(plugin2);

      const plugins = await registry.listPlugins({ category: 'task' });
      expect(plugins).toHaveLength(1);
      expect(plugins[0].name).toBe('plugin1');
    });

    it('should filter plugins by status', async () => {
      const plugin1: IPlugin = createMockPlugin({ name: 'plugin1' });
      const plugin2: IPlugin = createMockPlugin({ name: 'plugin2' });
      plugin2.status = PluginStatus.RUNNING;

      await registry.registerPlugin(plugin1);
      await registry.registerPlugin(plugin2);

      const plugins = await registry.listPlugins({ status: PluginStatus.RUNNING });
      expect(plugins).toHaveLength(1);
      expect(plugins[0].name).toBe('plugin2');
    });

    it('should filter plugins by tags', async () => {
      const plugin1: IPlugin = createMockPlugin({
        name: 'plugin1',
        manifest: { ...createMockManifest(), tags: ['tag1', 'tag2'] }
      });
      const plugin2: IPlugin = createMockPlugin({
        name: 'plugin2',
        manifest: { ...createMockManifest(), tags: ['tag2', 'tag3'] }
      });

      await registry.registerPlugin(plugin1);
      await registry.registerPlugin(plugin2);

      const plugins = await registry.listPlugins({ tags: ['tag2'] });
      expect(plugins).toHaveLength(2);

      const plugins2 = await registry.listPlugins({ tags: ['tag1'] });
      expect(plugins2).toHaveLength(1);
      expect(plugins2[0].name).toBe('plugin1');
    });
  });

  describe('getPluginsByCategory', () => {
    it('should return plugins by category', async () => {
      const plugin1: IPlugin = createMockPlugin({
        name: 'plugin1',
        manifest: { ...createMockManifest(), category: 'task' }
      });
      const plugin2: IPlugin = createMockPlugin({
        name: 'plugin2',
        manifest: { ...createMockManifest(), category: 'tool' }
      });
      const plugin3: IPlugin = createMockPlugin({
        name: 'plugin3',
        manifest: { ...createMockManifest(), category: 'task' }
      });

      await registry.registerPlugin(plugin1);
      await registry.registerPlugin(plugin2);
      await registry.registerPlugin(plugin3);

      const taskPlugins = await registry.getPluginsByCategory('task');
      expect(taskPlugins).toHaveLength(2);
      expect(taskPlugins.map(p => p.name)).toContain('plugin1');
      expect(taskPlugins.map(p => p.name)).toContain('plugin3');

      const toolPlugins = await registry.getPluginsByCategory('tool');
      expect(toolPlugins).toHaveLength(1);
      expect(toolPlugins[0].name).toBe('plugin2');

      const emptyPlugins = await registry.getPluginsByCategory('non-existent');
      expect(emptyPlugins).toHaveLength(0);
    });
  });

  describe('getDependencyGraph', () => {
    it('should return dependency graph', async () => {
      const plugin1: IPlugin = createMockPlugin({ name: 'plugin1' });
      const plugin2: IPlugin = createMockPlugin({
        name: 'plugin2',
        manifest: { ...createMockManifest(), dependencies: ['plugin1@1.0.0'] }
      });
      const plugin3: IPlugin = createMockPlugin({
        name: 'plugin3',
        manifest: { ...createMockManifest(), dependencies: ['plugin1@1.0.0', 'plugin2@1.0.0'] }
      });

      // Mock dependencies to be available
      plugin1.status = PluginStatus.RUNNING;
      plugin2.status = PluginStatus.RUNNING;

      await registry.registerPlugin(plugin1);
      await registry.registerPlugin(plugin2);
      await registry.registerPlugin(plugin3);

      const graph = await registry.getDependencyGraph();

      expect(graph.get('plugin1')).toEqual([]);
      expect(graph.get('plugin2')).toEqual(['plugin1']);
      expect(graph.get('plugin3')).toEqual(['plugin1', 'plugin2']);
    });
  });
});

describe('PluginDiscovery', () => {
  let discovery: PluginDiscovery;

  beforeEach(() => {
    jest.clearAllMocks();
    discovery = new PluginDiscovery(mockLogger, ['./plugins']);
  });

  describe('searchPlugins', () => {
    it('should search plugins with query', async () => {
      const mockManifest: IPluginManifest = createMockManifest();
      jest.spyOn(discovery, 'discoverPlugins').mockResolvedValue([mockManifest]);

      const results = await discovery.searchPlugins('test');

      expect(results).toHaveLength(1);
      expect(results[0]).toBe(mockManifest);
    });

    it('should filter search results by category', async () => {
      const mockManifest1: IPluginManifest = { ...createMockManifest(), category: 'task' };
      const mockManifest2: IPluginManifest = { ...createMockManifest(), category: 'tool' };
      jest.spyOn(discovery, 'discoverPlugins').mockResolvedValue([mockManifest1, mockManifest2]);

      const results = await discovery.searchPlugins('test', { category: 'task' });

      expect(results).toHaveLength(1);
      expect(results[0].category).toBe('task');
    });

    it('should limit search results', async () => {
      const mockManifests = Array.from({ length: 5 }, (_, i) =>
        createMockManifest({ name: `plugin-${i}` })
      );
      jest.spyOn(discovery, 'discoverPlugins').mockResolvedValue(mockManifests);

      const results = await discovery.searchPlugins('test', { limit: 3 });

      expect(results).toHaveLength(3);
    });
  });

  describe('addSearchPath and removeSearchPath', () => {
    it('should add search path', () => {
      discovery.addSearchPath('/new/path');

      expect((discovery as any).searchPaths).toContain('/new/path');
      expect(mockLogger.debug).toHaveBeenCalledWith('Added plugin search path: /new/path');
    });

    it('should not add duplicate search path', () => {
      discovery.addSearchPath('./plugins');

      expect((discovery as any).searchPaths).toHaveLength(1);
    });

    it('should remove search path', () => {
      discovery.addSearchPath('/temp/path');
      discovery.removeSearchPath('/temp/path');

      expect((discovery as any).searchPaths).not.toContain('/temp/path');
      expect(mockLogger.debug).toHaveBeenCalledWith('Removed plugin search path: /temp/path');
    });
  });
});

// Helper functions
function createMockManifest(overrides: Partial<IPluginManifest> = {}): IPluginManifest {
  return {
    name: 'test-plugin',
    version: '1.0.0',
    description: 'Test plugin',
    author: 'Test Author',
    license: 'MIT',
    keywords: ['test', 'plugin'],
    homepage: 'https://example.com',
    repository: 'https://github.com/example/test-plugin',
    bugs: 'https://github.com/example/test-plugin/issues',
    entryPoint: 'index.js',
    type: 'task',
    category: 'test',
    tags: ['test'],
    dependencies: [],
    permissions: [],
    config: {},
    engines: {
      node: '>=14.0.0'
    },
    ...overrides
  };
}

function createMockPlugin(overrides: Partial<IPlugin> = {}): IPlugin {
  const manifest = createMockManifest();

  return {
    name: manifest.name,
    version: manifest.version,
    manifest,
    workingDirectory: '/tmp/test-plugin',
    status: PluginStatus.REGISTERED,
    storage: mockStorage,
    secrets: mockSecrets,
    initialize: jest.fn().mockResolvedValue(undefined),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    execute: jest.fn().mockResolvedValue({}),
    ...overrides
  };
}
