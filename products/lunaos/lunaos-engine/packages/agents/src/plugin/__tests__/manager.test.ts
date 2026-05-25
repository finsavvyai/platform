import { PluginManager } from '../manager';
import {
  IPlugin,
  IPluginManifest,
  PluginStatus,
  PluginContext,
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

// Mock chokidar
jest.mock('chokidar', () => ({
  watch: jest.fn().mockReturnValue({
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined)
  })
}));

describe('PluginManager', () => {
  let pluginManager: PluginManager;
  let config: any;

  beforeEach(() => {
    jest.clearAllMocks();

    config = {
      pluginDirectories: ['./plugins'],
      autoReload: true,
      hotReloadEnabled: true,
      sandboxEnabled: true,
      maxPlugins: 10,
      pluginTimeout: 5000,
      allowedPermissions: ['*'],
      blockedPlugins: []
    };

    pluginManager = new PluginManager(config, mockLogger, mockEventBus, mockStorage, mockSecrets);
  });

  describe('constructor', () => {
    it('should create plugin manager with default configuration', () => {
      expect(pluginManager).toBeInstanceOf(PluginManager);
      expect(pluginManager).toBeInstanceOf(EventEmitter);
    });
  });

  describe('start and stop', () => {
    it('should start plugin manager successfully', async () => {
      // Mock discovery and loading
      const mockManifest = createMockManifest();
      jest.spyOn((pluginManager as any).discovery, 'discoverPlugins')
        .mockResolvedValue([mockManifest]);
      jest.spyOn((pluginManager as any).loader, 'loadPlugin')
        .mockResolvedValue(createMockPlugin());
      jest.spyOn((pluginManager as any).registry, 'registerPlugin')
        .mockResolvedValue(undefined);
      jest.spyOn((pluginManager as any).registry, 'listPlugins')
        .mockResolvedValue([]);

      await pluginManager.start();

      expect((pluginManager as any).isStarted).toBe(true);
      expect(mockEventBus.emit).toHaveBeenCalledWith('plugin-manager-started', expect.any(Object));
    });

    it('should not start if already started', async () => {
      (pluginManager as any).isStarted = true;

      await pluginManager.start();

      expect(mockLogger.warn).toHaveBeenCalledWith('Plugin manager is already started');
    });

    it('should stop plugin manager successfully', async () => {
      // Setup as started
      (pluginManager as any).isStarted = true;
      jest.spyOn((pluginManager as any).registry, 'listPlugins')
        .mockResolvedValue([]);
      jest.spyOn((pluginManager as any), 'stopFileWatchers')
        .mockResolvedValue(undefined);

      await pluginManager.stop();

      expect((pluginManager as any).isStarted).toBe(false);
      expect(mockEventBus.emit).toHaveBeenCalledWith('plugin-manager-stopped', expect.any(Object));
    });

    it('should not stop if not started', async () => {
      await pluginManager.stop();

      expect(mockLogger.warn).toHaveBeenCalledWith('Plugin manager is not started');
    });
  });

  describe('plugin installation', () => {
    beforeEach(async () => {
      // Setup manager as started
      (pluginManager as any).isStarted = true;
      jest.spyOn((pluginManager as any).discovery, 'discoverPlugins')
        .mockResolvedValue([createMockManifest()]);
      jest.spyOn((pluginManager as any).loader, 'loadPlugin')
        .mockResolvedValue(createMockPlugin());
      jest.spyOn((pluginManager as any).registry, 'registerPlugin')
        .mockResolvedValue(undefined);
    });

    it('should install plugin successfully', async () => {
      const mockInstall = jest.spyOn((pluginManager as any).discovery, 'installPlugin')
        .mockResolvedValue(undefined);

      const plugin = await pluginManager.installPlugin('/source/path', {
        autoStart: false,
        config: { test: 'config' }
      });

      expect(mockInstall).toHaveBeenCalledWith('/source/path', { force: false });
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('test-plugin');
      expect((pluginManager as any).pluginConfigs.get('test-plugin')).toEqual({ test: 'config' });
    });

    it('should install and auto-start plugin', async () => {
      const mockStart = jest.spyOn((pluginManager as any).registry, 'startPlugin')
        .mockResolvedValue(undefined);

      const plugin = await pluginManager.installPlugin('/source/path', {
        autoStart: true
      });

      expect(mockStart).toHaveBeenCalledWith('test-plugin', { config: undefined });
    });

    it('should force reinstall plugin', async () => {
      const mockInstall = jest.spyOn((pluginManager as any).discovery, 'installPlugin')
        .mockResolvedValue(undefined);

      await pluginManager.installPlugin('/source/path', {
        force: true
      });

      expect(mockInstall).toHaveBeenCalledWith('/source/path', { force: true });
    });
  });

  describe('plugin uninstallation', () => {
    beforeEach(async () => {
      // Setup with a registered plugin
      const mockPlugin = createMockPlugin();
      jest.spyOn((pluginManager as any).registry, 'getPlugin')
        .mockResolvedValue(mockPlugin);
      jest.spyOn((pluginManager as any).registry, 'stopPlugin')
        .mockResolvedValue(undefined);
      jest.spyOn((pluginManager as any).registry, 'unregisterPlugin')
        .mockResolvedValue(undefined);
    });

    it('should uninstall plugin successfully', async () => {
      await pluginManager.uninstallPlugin('test-plugin');

      expect((pluginManager as any).registry.getPlugin).toHaveBeenCalledWith('test-plugin');
      expect((pluginManager as any).registry.unregisterPlugin).toHaveBeenCalledWith('test-plugin');
    });

    it('should uninstall plugin and remove config', async () => {
      (pluginManager as any).pluginConfigs.set('test-plugin', { test: 'config' });

      await pluginManager.uninstallPlugin('test-plugin', { removeConfig: true });

      expect((pluginManager as any).pluginConfigs.has('test-plugin')).toBe(false);
    });

    it('should throw error for non-existent plugin', async () => {
      jest.spyOn((pluginManager as any).registry, 'getPlugin')
        .mockResolvedValue(null);

      await expect(pluginManager.uninstallPlugin('non-existent')).rejects.toThrow(
        'Plugin not found: non-existent'
      );
    });
  });

  describe('plugin enabling and disabling', () => {
    beforeEach(() => {
      const mockPlugin = createMockPlugin();
      jest.spyOn((pluginManager as any).registry, 'getPlugin')
        .mockResolvedValue(mockPlugin);
    });

    it('should enable plugin with configuration', async () => {
      const config = { test: 'config' };

      await pluginManager.enablePlugin('test-plugin', {
        config,
        autoStart: false
      });

      expect((pluginManager as any).pluginConfigs.get('test-plugin')).toEqual(config);
    });

    it('should enable and auto-start plugin', async () => {
      const mockStart = jest.spyOn((pluginManager as any).registry, 'startPlugin')
        .mockResolvedValue(undefined);

      await pluginManager.enablePlugin('test-plugin', { autoStart: true });

      expect(mockStart).toHaveBeenCalledWith('test-plugin', { config: undefined });
    });

    it('should disable running plugin', async () => {
      const mockPlugin = createMockPlugin();
      mockPlugin.status = PluginStatus.RUNNING;
      jest.spyOn((pluginManager as any).registry, 'getPlugin')
        .mockResolvedValue(mockPlugin);
      jest.spyOn((pluginManager as any).registry, 'stopPlugin')
        .mockResolvedValue(undefined);

      await pluginManager.disablePlugin('test-plugin');

      expect((pluginManager as any).registry.stopPlugin).toHaveBeenCalledWith('test-plugin');
    });

    it('should throw error when enabling non-existent plugin', async () => {
      jest.spyOn((pluginManager as any).registry, 'getPlugin')
        .mockResolvedValue(null);

      await expect(pluginManager.enablePlugin('non-existent')).rejects.toThrow(
        'Plugin not found: non-existent'
      );
    });
  });

  describe('plugin reloading', () => {
    beforeEach(() => {
      const mockPlugin = createMockPlugin();
      jest.spyOn((pluginManager as any).registry, 'getPlugin')
        .mockResolvedValue(mockPlugin);
      jest.spyOn((pluginManager as any).registry, 'stopPlugin')
        .mockResolvedValue(undefined);
      jest.spyOn((pluginManager as any).registry, 'unregisterPlugin')
        .mockResolvedValue(undefined);
    });

    it('should reload running plugin', async () => {
      const mockPlugin = createMockPlugin();
      mockPlugin.status = PluginStatus.RUNNING;

      const reloadedPlugin = createMockPlugin();
      jest.spyOn((pluginManager as any).discovery, 'discoverPlugins')
        .mockResolvedValue([createMockManifest()]);
      jest.spyOn((pluginManager as any).loader, 'loadPlugin')
        .mockResolvedValue(reloadedPlugin);
      jest.spyOn((pluginManager as any).registry, 'registerPlugin')
        .mockResolvedValue(undefined);
      jest.spyOn((pluginManager as any).registry, 'startPlugin')
        .mockResolvedValue(undefined);

      await pluginManager.reloadPlugin('test-plugin');

      expect((pluginManager as any).registry.stopPlugin).toHaveBeenCalledWith('test-plugin');
      expect((pluginManager as any).registry.unregisterPlugin).toHaveBeenCalledWith('test-plugin');
      expect((pluginManager as any).registry.registerPlugin).toHaveBeenCalledWith(reloadedPlugin);
      expect((pluginManager as any).registry.startPlugin).toHaveBeenCalledWith('test-plugin', {
        config: undefined
      });
    });

    it('should reload stopped plugin without restarting', async () => {
      const mockPlugin = createMockPlugin();
      mockPlugin.status = PluginStatus.STOPPED;

      const reloadedPlugin = createMockPlugin();
      jest.spyOn((pluginManager as any).discovery, 'discoverPlugins')
        .mockResolvedValue([createMockManifest()]);
      jest.spyOn((pluginManager as any).loader, 'loadPlugin')
        .mockResolvedValue(reloadedPlugin);
      jest.spyOn((pluginManager as any).registry, 'registerPlugin')
        .mockResolvedValue(undefined);

      await pluginManager.reloadPlugin('test-plugin');

      expect((pluginManager as any).registry.stopPlugin).not.toHaveBeenCalled();
      expect((pluginManager as any).registry.startPlugin).not.toHaveBeenCalled();
    });

    it('should throw error when reloading non-existent plugin', async () => {
      jest.spyOn((pluginManager as any).registry, 'getPlugin')
        .mockResolvedValue(null);

      await expect(pluginManager.reloadPlugin('non-existent')).rejects.toThrow(
        'Plugin not found: non-existent'
      );
    });
  });

  describe('plugin execution', () => {
    beforeEach(() => {
      const mockPlugin = createMockPlugin();
      mockPlugin.status = PluginStatus.RUNNING;
      mockPlugin.execute = jest.fn().mockResolvedValue({ result: 'success' });

      jest.spyOn((pluginManager as any).registry, 'getPlugin')
        .mockResolvedValue(mockPlugin);
    });

    it('should execute plugin successfully', async () => {
      const request = { data: 'test' };
      const result = await pluginManager.executePlugin('test-plugin', request);

      expect(result).toEqual({ result: 'success' });
      expect(mockPlugin.execute).toHaveBeenCalledWith(request);
    });

    it('should throw error for non-existent plugin', async () => {
      jest.spyOn((pluginManager as any).registry, 'getPlugin')
        .mockResolvedValue(null);

      await expect(pluginManager.executePlugin('non-existent', {})).rejects.toThrow(
        'Plugin not found: non-existent'
      );
    });

    it('should throw error for non-running plugin', async () => {
      const mockPlugin = createMockPlugin();
      mockPlugin.status = PluginStatus.STOPPED;
      jest.spyOn((pluginManager as any).registry, 'getPlugin')
        .mockResolvedValue(mockPlugin);

      await expect(pluginManager.executePlugin('test-plugin', {})).rejects.toThrow(
        'Plugin test-plugin is not running'
      );
    });

    it('should throw error for plugin without execute method', async () => {
      const mockPlugin = createMockPlugin();
      mockPlugin.status = PluginStatus.RUNNING;
      delete (mockPlugin as any).execute;

      jest.spyOn((pluginManager as any).registry, 'getPlugin')
        .mockResolvedValue(mockPlugin);

      await expect(pluginManager.executePlugin('test-plugin', {})).rejects.toThrow(
        'Plugin test-plugin does not support execution'
      );
    });

    it('should handle plugin execution timeout', async () => {
      const mockPlugin = createMockPlugin();
      mockPlugin.status = PluginStatus.RUNNING;
      mockPlugin.execute = jest.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 10000))
      );

      jest.spyOn((pluginManager as any).registry, 'getPlugin')
        .mockResolvedValue(mockPlugin);

      await expect(pluginManager.executePlugin('test-plugin', {})).rejects.toThrow(
        'Plugin execution timeout'
      );
    });
  });

  describe('plugin listing and querying', () => {
    beforeEach(() => {
      const mockPlugins = [
        createMockPlugin({ name: 'plugin1', status: PluginStatus.RUNNING }),
        createMockPlugin({ name: 'plugin2', status: PluginStatus.STOPPED })
      ];

      jest.spyOn((pluginManager as any).registry, 'listPlugins')
        .mockResolvedValue(mockPlugins);
      jest.spyOn((pluginManager as any).registry, 'getPlugin')
        .mockImplementation((name: string) =>
          Promise.resolve(mockPlugins.find(p => p.name === name) || null)
        );
    });

    it('should list all plugins', async () => {
      const plugins = await pluginManager.listPlugins();

      expect(plugins).toHaveLength(2);
      expect(plugins.map(p => p.name)).toContain('plugin1');
      expect(plugins.map(p => p.name)).toContain('plugin2');
    });

    it('should list plugins with filter', async () => {
      const plugins = await pluginManager.listPlugins({ status: PluginStatus.RUNNING });

      expect(plugins).toHaveLength(1);
      expect(plugins[0].name).toBe('plugin1');
    });

    it('should get plugin by name', async () => {
      const plugin = await pluginManager.getPlugin('plugin1');

      expect(plugin).toBeDefined();
      expect(plugin!.name).toBe('plugin1');
    });

    it('should return null for non-existent plugin', async () => {
      const plugin = await pluginManager.getPlugin('non-existent');

      expect(plugin).toBeNull();
    });

    it('should get plugin status', async () => {
      const status = await pluginManager.getPluginStatus('plugin1');

      expect(status).toBe(PluginStatus.RUNNING);
    });

    it('should return null for non-existent plugin status', async () => {
      jest.spyOn((pluginManager as any).registry, 'getPlugin')
        .mockResolvedValue(null);

      const status = await pluginManager.getPluginStatus('non-existent');

      expect(status).toBeNull();
    });
  });

  describe('plugin configuration management', () => {
    it('should set and get plugin configuration', async () => {
      const config = { test: 'config' };

      await pluginManager.setPluginConfig('test-plugin', config);

      const retrievedConfig = await pluginManager.getPluginConfig('test-plugin');
      expect(retrievedConfig).toEqual(config);
    });

    it('should return empty config for non-existent plugin', async () => {
      const config = await pluginManager.getPluginConfig('non-existent');

      expect(config).toEqual({});
    });
  });

  describe('system information', () => {
    beforeEach(() => {
      const mockPlugins = [
        createMockPlugin({
          name: 'plugin1',
          status: PluginStatus.RUNNING,
          manifest: { ...createMockManifest(), category: 'task' }
        }),
        createMockPlugin({
          name: 'plugin2',
          status: PluginStatus.ERROR,
          manifest: { ...createMockManifest(), category: 'tool' }
        })
      ];

      jest.spyOn((pluginManager as any).registry, 'listPlugins')
        .mockResolvedValue(mockPlugins);
      jest.spyOn((pluginManager as any).registry, 'getDependencyGraph')
        .mockResolvedValue(new Map([['plugin1', []], ['plugin2', []]]));
    });

    it('should return comprehensive system information', async () => {
      (pluginManager as any).isStarted = true;
      (pluginManager as any).startTime = Date.now() - 60000; // 1 minute ago

      const info = await pluginManager.getSystemInfo();

      expect(info.totalPlugins).toBe(2);
      expect(info.runningPlugins).toBe(1);
      expect(info.failedPlugins).toBe(1);
      expect(info.categories).toContain('task');
      expect(info.categories).toContain('tool');
      expect(info.hotReloadEnabled).toBe(true);
      expect(info.autoReload).toBe(true);
      expect(info.maxPlugins).toBe(10);
      expect(info.isStarted).toBe(true);
      expect(info.uptime).toBeGreaterThan(0);
    });

    it('should return zero uptime when not started', async () => {
      (pluginManager as any).isStarted = false;

      const info = await pluginManager.getSystemInfo();

      expect(info.isStarted).toBe(false);
      expect(info.uptime).toBe(0);
    });
  });

  describe('dependency graph', () => {
    it('should return dependency graph', async () => {
      const graph = new Map([
        ['plugin1', ['plugin2']],
        ['plugin2', ['plugin3']],
        ['plugin3', []]
      ]);

      jest.spyOn((pluginManager as any).registry, 'getDependencyGraph')
        .mockResolvedValue(graph);

      const result = await pluginManager.getDependencyGraph();

      expect(result).toBe(graph);
      expect(result.get('plugin1')).toEqual(['plugin2']);
      expect(result.get('plugin2')).toEqual(['plugin3']);
      expect(result.get('plugin3')).toEqual([]);
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
