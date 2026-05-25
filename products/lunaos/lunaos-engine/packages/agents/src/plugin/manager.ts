import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as chokidar from 'chokidar';
import {
  IPluginRegistry,
  IPlugin,
  IPluginManifest,
  PluginContext,
  PluginStatus,
  PluginEvent,
  IPluginSandbox,
  IPluginDiscovery,
  ILogger,
  IEventBus,
  IStorage,
  ISecrets
} from './interfaces';
import { PluginRegistry, PluginDiscovery, PluginLoader, PluginSandbox } from './index';

/**
 * Plugin Manager Configuration
 */
export interface PluginManagerConfig {
  pluginDirectories: string[];
  autoReload: boolean;
  hotReloadEnabled: boolean;
  sandboxEnabled: boolean;
  maxPlugins: number;
  pluginTimeout: number;
  allowedPermissions: string[];
  blockedPlugins: string[];
}

/**
 * Plugin Manager
 * Central orchestrator for all plugin operations including lifecycle, hot-reloading, and management
 */
export class PluginManager extends EventEmitter {
  private readonly registry: IPluginRegistry;
  private readonly discovery: IPluginDiscovery;
  private readonly loader: PluginLoader;
  private readonly config: PluginManagerConfig;
  private readonly logger: ILogger;
  private readonly eventBus: IEventBus;
  private readonly fileWatchers: Map<string, any> = new Map();
  private readonly pluginConfigs: Map<string, any> = new Map();
  private isStarted = false;

  constructor(
    config: PluginManagerConfig,
    logger: ILogger,
    eventBus: IEventBus,
    storage: IStorage,
    secrets: ISecrets
  ) {
    super();

    this.config = config;
    this.logger = logger.child({ component: 'PluginManager' });
    this.eventBus = eventBus;

    // Initialize components
    this.discovery = new PluginDiscovery(this.logger, config.pluginDirectories);
    this.loader = new PluginLoader(this.logger, eventBus, storage, secrets);
    this.registry = new PluginRegistry(
      this.logger,
      eventBus,
      this.discovery,
      async (plugin) => new PluginSandbox(this.logger, plugin.name, plugin.manifest.permissions || [])
    );

    // Setup event listeners
    this.setupEventListeners();
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('Plugin manager is already started');
      return;
    }

    this.logger.info('Starting plugin manager');

    try {
      // Discover and load plugins
      await this.discoverAndLoadPlugins();

      // Setup file watchers for hot reload
      if (this.config.hotReloadEnabled) {
        await this.setupFileWatchers();
      }

      // Start auto-enabled plugins
      await this.startAutoEnabledPlugins();

      this.isStarted = true;
      this.emit('manager-started');
      await this.eventBus.emit('plugin-manager-started', { timestamp: Date.now() });

      this.logger.info('Plugin manager started successfully');

    } catch (error) {
      this.logger.error(`Failed to start plugin manager: ${error}`);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isStarted) {
      this.logger.warn('Plugin manager is not started');
      return;
    }

    this.logger.info('Stopping plugin manager');

    try {
      // Stop all running plugins
      const runningPlugins = await this.registry.listPlugins({
        status: PluginStatus.RUNNING
      });

      for (const plugin of runningPlugins) {
        try {
          await this.registry.stopPlugin(plugin.name);
        } catch (error) {
          this.logger.error(`Failed to stop plugin ${plugin.name}: ${error}`);
        }
      }

      // Stop file watchers
      if (this.config.hotReloadEnabled) {
        await this.stopFileWatchers();
      }

      this.isStarted = false;
      this.emit('manager-stopped');
      await this.eventBus.emit('plugin-manager-stopped', { timestamp: Date.now() });

      this.logger.info('Plugin manager stopped successfully');

    } catch (error) {
      this.logger.error(`Failed to stop plugin manager: ${error}`);
      throw error;
    }
  }

  async installPlugin(source: string, options?: {
    force?: boolean;
    autoStart?: boolean;
    config?: any;
  }): Promise<IPlugin> {
    this.logger.info(`Installing plugin from source: ${source}`);

    try {
      // Install plugin using discovery
      await this.discovery.installPlugin(source, {
        force: options?.force || false
      });

      // Reload plugin manifests
      await this.discoverAndLoadPlugins();

      // Find newly installed plugin
      const manifests = await this.discovery.discoverPlugins(source);
      if (manifests.length === 0) {
        throw new Error('No plugin found in source');
      }

      const manifest = manifests[0];
      const plugin = await this.loader.loadPlugin(manifest, source);

      // Register plugin
      await this.registry.registerPlugin(plugin);

      // Store plugin configuration
      if (options?.config) {
        this.pluginConfigs.set(plugin.name, options.config);
      }

      // Auto-start if requested
      if (options?.autoStart) {
        await this.registry.startPlugin(plugin.name, { config: options?.config });
      }

      this.logger.info(`Plugin installed successfully: ${plugin.name}@${plugin.version}`);
      this.emit('plugin-installed', { plugin: plugin.name, version: plugin.version });

      return plugin;

    } catch (error) {
      this.logger.error(`Failed to install plugin from ${source}: ${error}`);
      throw error;
    }
  }

  async uninstallPlugin(name: string, options?: {
    force?: boolean;
    removeConfig?: boolean;
  }): Promise<void> {
    this.logger.info(`Uninstalling plugin: ${name}`);

    try {
      const plugin = await this.registry.getPlugin(name);
      if (!plugin) {
        throw new Error(`Plugin not found: ${name}`);
      }

      // Stop plugin if running
      if (plugin.status === PluginStatus.RUNNING) {
        await this.registry.stopPlugin(name);
      }

      // Unregister plugin
      await this.registry.unregisterPlugin(name);

      // Remove configuration if requested
      if (options?.removeConfig) {
        this.pluginConfigs.delete(name);
      }

      this.logger.info(`Plugin uninstalled successfully: ${name}`);
      this.emit('plugin-uninstalled', { plugin: name });

    } catch (error) {
      this.logger.error(`Failed to uninstall plugin ${name}: ${error}`);
      throw error;
    }
  }

  async enablePlugin(name: string, options?: {
    config?: any;
    autoStart?: boolean;
  }): Promise<void> {
    this.logger.info(`Enabling plugin: ${name}`);

    try {
      const plugin = await this.registry.getPlugin(name);
      if (!plugin) {
        throw new Error(`Plugin not found: ${name}`);
      }

      // Update configuration
      if (options?.config) {
        this.pluginConfigs.set(name, options.config);
      }

      // Start plugin if auto-start is enabled
      if (options?.autoStart && plugin.status !== PluginStatus.RUNNING) {
        await this.registry.startPlugin(name, {
          config: this.pluginConfigs.get(name)
        });
      }

      this.logger.info(`Plugin enabled successfully: ${name}`);
      this.emit('plugin-enabled', { plugin: name });

    } catch (error) {
      this.logger.error(`Failed to enable plugin ${name}: ${error}`);
      throw error;
    }
  }

  async disablePlugin(name: string): Promise<void> {
    this.logger.info(`Disabling plugin: ${name}`);

    try {
      const plugin = await this.registry.getPlugin(name);
      if (!plugin) {
        throw new Error(`Plugin not found: ${name}`);
      }

      // Stop plugin if running
      if (plugin.status === PluginStatus.RUNNING) {
        await this.registry.stopPlugin(name);
      }

      this.logger.info(`Plugin disabled successfully: ${name}`);
      this.emit('plugin-disabled', { plugin: name });

    } catch (error) {
      this.logger.error(`Failed to disable plugin ${name}: ${error}`);
      throw error;
    }
  }

  async reloadPlugin(name: string): Promise<void> {
    this.logger.info(`Reloading plugin: ${name}`);

    try {
      const plugin = await this.registry.getPlugin(name);
      if (!plugin) {
        throw new Error(`Plugin not found: ${name}`);
      }

      const wasRunning = plugin.status === PluginStatus.RUNNING;

      // Stop plugin if running
      if (wasRunning) {
        await this.registry.stopPlugin(name);
      }

      // Unregister plugin
      await this.registry.unregisterPlugin(name);

      // Reload plugin from disk
      const manifests = await this.discovery.discoverPlugins(plugin.workingDirectory);
      if (manifests.length === 0) {
        throw new Error(`Plugin manifest not found: ${name}`);
      }

      const reloadedPlugin = await this.loader.loadPlugin(manifests[0], plugin.workingDirectory);
      await this.registry.registerPlugin(reloadedPlugin);

      // Restart plugin if it was running
      if (wasRunning) {
        await this.registry.startPlugin(name, {
          config: this.pluginConfigs.get(name)
        });
      }

      this.logger.info(`Plugin reloaded successfully: ${name}`);
      this.emit('plugin-reloaded', { plugin: name });

    } catch (error) {
      this.logger.error(`Failed to reload plugin ${name}: ${error}`);
      throw error;
    }
  }

  async updatePlugin(name: string): Promise<void> {
    this.logger.info(`Updating plugin: ${name}`);

    try {
      const plugin = await this.registry.getPlugin(name);
      if (!plugin) {
        throw new Error(`Plugin not found: ${name}`);
      }

      // Check for updates
      const updates = await this.discovery.getPluginUpdates(name, plugin.version);
      if (updates.length === 0) {
        this.logger.info(`No updates available for plugin: ${name}`);
        return;
      }

      // Install update
      const latestUpdate = updates[updates.length - 1];
      await this.installPlugin(latestUpdate.repository!, { force: true });

      this.logger.info(`Plugin updated successfully: ${name}`);
      this.emit('plugin-updated', { plugin: name, version: latestUpdate.version });

    } catch (error) {
      this.logger.error(`Failed to update plugin ${name}: ${error}`);
      throw error;
    }
  }

  async executePlugin(name: string, request: any): Promise<any> {
    this.logger.debug(`Executing plugin: ${name}`);

    try {
      const plugin = await this.registry.getPlugin(name);
      if (!plugin) {
        throw new Error(`Plugin not found: ${name}`);
      }

      if (plugin.status !== PluginStatus.RUNNING) {
        throw new Error(`Plugin ${name} is not running`);
      }

      // Check if plugin has execute method
      if (typeof plugin.execute !== 'function') {
        throw new Error(`Plugin ${name} does not support execution`);
      }

      // Execute plugin with timeout
      const result = await Promise.race([
        plugin.execute(request),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Plugin execution timeout')), this.config.pluginTimeout)
        )
      ]);

      this.logger.debug(`Plugin executed successfully: ${name}`);
      return result;

    } catch (error) {
      this.logger.error(`Failed to execute plugin ${name}: ${error}`);
      throw error;
    }
  }

  async getPlugin(name: string): Promise<IPlugin | null> {
    return this.registry.getPlugin(name);
  }

  async listPlugins(filter?: {
    category?: string;
    status?: PluginStatus;
    tags?: string[];
  }): Promise<IPlugin[]> {
    return this.registry.listPlugins(filter);
  }

  async getPluginStatus(name: string): Promise<PluginStatus | null> {
    const plugin = await this.registry.getPlugin(name);
    return plugin ? plugin.status : null;
  }

  async getPluginConfig(name: string): Promise<any> {
    return this.pluginConfigs.get(name) || {};
  }

  async setPluginConfig(name: string, config: any): Promise<void> {
    this.pluginConfigs.set(name, config);
    this.logger.info(`Configuration updated for plugin: ${name}`);
  }

  async getDependencyGraph(): Promise<Map<string, string[]>> {
    return this.registry.getDependencyGraph();
  }

  async getSystemInfo(): Promise<any> {
    const allPlugins = await this.registry.listPlugins();
    const runningPlugins = allPlugins.filter(p => p.status === PluginStatus.RUNNING);
    const failedPlugins = allPlugins.filter(p => p.status === PluginStatus.ERROR);

    const categories = new Set(allPlugins.map(p => p.manifest.category).filter(Boolean));
    const dependencyGraph = await this.registry.getDependencyGraph();

    return {
      totalPlugins: allPlugins.length,
      runningPlugins: runningPlugins.length,
      failedPlugins: failedPlugins.length,
      categories: Array.from(categories),
      hotReloadEnabled: this.config.hotReloadEnabled,
      autoReload: this.config.autoReload,
      maxPlugins: this.config.maxPlugins,
      dependencyGraph: Object.fromEntries(dependencyGraph),
      isStarted: this.isStarted,
      uptime: this.isStarted ? Date.now() - (this as any).startTime : 0
    };
  }

  private async discoverAndLoadPlugins(): Promise<void> {
    const allManifests: IPluginManifest[] = [];

    // Discover plugins from all configured directories
    for (const directory of this.config.pluginDirectories) {
      try {
        const manifests = await this.discovery.discoverPlugins(directory);
        allManifests.push(...manifests);
      } catch (error) {
        this.logger.warn(`Failed to discover plugins in ${directory}: ${error}`);
      }
    }

    // Filter blocked plugins
    const allowedManifests = allManifests.filter(manifest =>
      !this.config.blockedPlugins.includes(manifest.name)
    );

    // Load and register plugins (respecting max limit)
    const loadCount = Math.min(allowedManifests.length, this.config.maxPlugins);

    for (let i = 0; i < loadCount; i++) {
      try {
        const manifest = allowedManifests[i];
        const pluginDirectory = path.join(
          this.config.pluginDirectories[0],
          manifest.name
        );

        const plugin = await this.loader.loadPlugin(manifest, pluginDirectory);
        await this.registry.registerPlugin(plugin);

      } catch (error) {
        this.logger.error(`Failed to load plugin ${allowedManifests[i].name}: ${error}`);
      }
    }

    this.logger.info(`Loaded ${loadCount} plugins successfully`);
  }

  private async setupFileWatchers(): Promise<void> {
    for (const directory of this.config.pluginDirectories) {
      try {
        const watcher = chokidar.watch(directory, {
          ignored: /(^|[\/\\])\../, // ignore dotfiles
          persistent: true
        });

        watcher.on('change', async (filePath) => {
          await this.handleFileChange(filePath);
        });

        watcher.on('add', async (filePath) => {
          await this.handleFileAdd(filePath);
        });

        watcher.on('unlink', async (filePath) => {
          await this.handleFileDelete(filePath);
        });

        this.fileWatchers.set(directory, watcher);
        this.logger.debug(`File watcher setup for directory: ${directory}`);

      } catch (error) {
        this.logger.error(`Failed to setup file watcher for ${directory}: ${error}`);
      }
    }
  }

  private async stopFileWatchers(): Promise<void> {
    for (const [directory, watcher] of this.fileWatchers.entries()) {
      try {
        await watcher.close();
        this.logger.debug(`File watcher stopped for directory: ${directory}`);
      } catch (error) {
        this.logger.error(`Failed to stop file watcher for ${directory}: ${error}`);
      }
    }

    this.fileWatchers.clear();
  }

  private async handleFileChange(filePath: string): Promise<void> {
    if (!this.config.hotReloadEnabled) {
      return;
    }

    // Check if file is part of a plugin
    const pluginName = this.getPluginNameFromPath(filePath);
    if (!pluginName) {
      return;
    }

    this.logger.debug(`File changed for plugin ${pluginName}: ${filePath}`);

    try {
      if (this.config.autoReload) {
        await this.reloadPlugin(pluginName);
      } else {
        this.emit('plugin-changed', { plugin: pluginName, filePath });
      }
    } catch (error) {
      this.logger.error(`Failed to handle file change for ${pluginName}: ${error}`);
    }
  }

  private async handleFileAdd(filePath: string): Promise<void> {
    if (filePath.endsWith('plugin.json')) {
      this.logger.debug(`New plugin manifest detected: ${filePath}`);
      await this.discoverAndLoadPlugins();
    }
  }

  private async handleFileDelete(filePath: string): Promise<void> {
    // Handle plugin deletion
    const pluginName = this.getPluginNameFromPath(filePath);
    if (pluginName) {
      this.logger.warn(`Plugin files deleted for: ${pluginName}`);
      this.emit('plugin-deleted', { plugin: pluginName, filePath });
    }
  }

  private getPluginNameFromPath(filePath: string): string | null {
    const parts = filePath.split(path.sep);
    const pluginIndex = parts.findIndex(part =>
      this.config.pluginDirectories.some(dir => filePath.includes(dir))
    );

    return pluginIndex !== -1 && parts[pluginIndex + 1] ? parts[pluginIndex + 1] : null;
  }

  private async startAutoEnabledPlugins(): Promise<void> {
    if (!this.config.autoReload) {
      return;
    }

    const plugins = await this.registry.listPlugins({
      status: PluginStatus.REGISTERED
    });

    for (const plugin of plugins) {
      try {
        if (plugin.manifest.autoStart !== false) {
          await this.registry.startPlugin(plugin.name, {
            config: this.pluginConfigs.get(plugin.name)
          });
        }
      } catch (error) {
        this.logger.error(`Failed to auto-start plugin ${plugin.name}: ${error}`);
      }
    }
  }

  private setupEventListeners(): void {
    // Forward registry events
    this.registry.on('plugin-registered', (data) => {
      this.emit('plugin-registered', data);
    });

    this.registry.on('plugin-unregistered', (data) => {
      this.emit('plugin-unregistered', data);
    });

    this.registry.on('plugin-started', (data) => {
      this.emit('plugin-started', data);
    });

    this.registry.on('plugin-stopped', (data) => {
      this.emit('plugin-stopped', data);
    });

    this.registry.on('plugin-error', (data) => {
      this.emit('plugin-error', data);
    });
  }
}
