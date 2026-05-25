import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  IPluginRegistry,
  IPlugin,
  IPluginMetadata,
  IPluginManifest,
  PluginContext,
  PluginStatus,
  PluginCompatibilityResult,
  PluginEvent,
  IPluginSandbox,
  IPluginDiscovery,
  ILogger,
  IEventBus
} from './interfaces';

/**
 * Plugin Registry Implementation
 * Manages plugin registration, discovery, loading, and lifecycle
 */
export class PluginRegistry extends EventEmitter implements IPluginRegistry {
  private plugins: Map<string, IPlugin> = new Map();
  private pluginsByCategory: Map<string, Set<string>> = new Map();
  private dependencies: Map<string, Set<string>> = new Map();
  private dependents: Map<string, Set<string>> = new Map();
  private readonly logger: ILogger;
  private readonly eventBus: IEventBus;
  private readonly discovery: IPluginDiscovery;
  private readonly sandboxFactory: (plugin: IPlugin) => Promise<IPluginSandbox>;

  constructor(
    logger: ILogger,
    eventBus: IEventBus,
    discovery: IPluginDiscovery,
    sandboxFactory: (plugin: IPlugin) => Promise<IPluginSandbox>
  ) {
    super();
    this.logger = logger;
    this.eventBus = eventBus;
    this.discovery = discovery;
    this.sandboxFactory = sandboxFactory;
  }

  async registerPlugin(plugin: IPlugin): Promise<void> {
    this.logger.info(`Registering plugin: ${plugin.name}@${plugin.version}`);

    // Validate plugin
    await this.validatePlugin(plugin);

    // Check for conflicts
    await this.checkForConflicts(plugin);

    // Check dependencies
    await this.checkDependencies(plugin);

    // Store plugin
    this.plugins.set(plugin.name, plugin);

    // Update category mapping
    if (plugin.manifest.category) {
      if (!this.pluginsByCategory.has(plugin.manifest.category)) {
        this.pluginsByCategory.set(plugin.manifest.category, new Set());
      }
      this.pluginsByCategory.get(plugin.manifest.category)!.add(plugin.name);
    }

    // Update dependency mappings
    if (plugin.manifest.dependencies) {
      this.dependencies.set(plugin.name, new Set(plugin.manifest.dependencies));

      for (const dep of plugin.manifest.dependencies) {
        if (!this.dependents.has(dep)) {
          this.dependents.set(dep, new Set());
        }
        this.dependents.get(dep)!.add(plugin.name);
      }
    }

    // Emit events
    this.emit('plugin-registered', { plugin: plugin.name, version: plugin.version });
    await this.eventBus.emit(PluginEvent.PLUGIN_REGISTERED, {
      pluginName: plugin.name,
      version: plugin.version,
      category: plugin.manifest.category
    });

    this.logger.info(`Plugin registered successfully: ${plugin.name}@${plugin.version}`);
  }

  async unregisterPlugin(name: string): Promise<void> {
    this.logger.info(`Unregistering plugin: ${name}`);

    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin not found: ${name}`);
    }

    // Check if other plugins depend on this one
    const dependents = this.dependents.get(name);
    if (dependents && dependents.size > 0) {
      throw new Error(`Cannot unregister plugin ${name}. It has dependents: ${Array.from(dependents).join(', ')}`);
    }

    // Stop the plugin if it's running
    if (plugin.status === PluginStatus.RUNNING) {
      await this.stopPlugin(name);
    }

    // Remove from registry
    this.plugins.delete(name);

    // Remove from category mapping
    if (plugin.manifest.category) {
      const categoryPlugins = this.pluginsByCategory.get(plugin.manifest.category);
      if (categoryPlugins) {
        categoryPlugins.delete(name);
        if (categoryPlugins.size === 0) {
          this.pluginsByCategory.delete(plugin.manifest.category);
        }
      }
    }

    // Remove dependency mappings
    this.dependencies.delete(name);
    for (const [dep, dependentSet] of this.dependents.entries()) {
      dependentSet.delete(name);
      if (dependentSet.size === 0) {
        this.dependents.delete(dep);
      }
    }

    // Emit events
    this.emit('plugin-unregistered', { plugin: name });
    await this.eventBus.emit(PluginEvent.PLUGIN_UNREGISTERED, {
      pluginName: name
    });

    this.logger.info(`Plugin unregistered successfully: ${name}`);
  }

  async startPlugin(name: string, context?: Partial<PluginContext>): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin not found: ${name}`);
    }

    if (plugin.status === PluginStatus.RUNNING) {
      this.logger.warn(`Plugin ${name} is already running`);
      return;
    }

    if (plugin.status !== PluginStatus.REGISTERED && plugin.status !== PluginStatus.STOPPED) {
      throw new Error(`Cannot start plugin ${name} in status: ${plugin.status}`);
    }

    this.logger.info(`Starting plugin: ${name}`);

    try {
      // Create plugin context
      const fullContext: PluginContext = {
        pluginName: name,
        pluginVersion: plugin.version,
        workingDirectory: plugin.workingDirectory,
        config: plugin.manifest.config || {},
        permissions: plugin.manifest.permissions || [],
        sandbox: await this.sandboxFactory(plugin),
        logger: this.logger.child({ plugin: name }),
        eventBus: this.eventBus,
        storage: plugin.storage,
        secrets: plugin.secrets,
        ...context
      };

      // Initialize plugin
      await plugin.initialize(fullContext);
      plugin.status = PluginStatus.INITIALIZING;

      // Start plugin
      await plugin.start();
      plugin.status = PluginStatus.RUNNING;

      // Emit events
      this.emit('plugin-started', { plugin: name });
      await this.eventBus.emit(PluginEvent.PLUGIN_STARTED, {
        pluginName: name
      });

      this.logger.info(`Plugin started successfully: ${name}`);

    } catch (error) {
      plugin.status = PluginStatus.ERROR;
      plugin.lastError = error instanceof Error ? error : new Error(String(error));

      this.emit('plugin-error', { plugin: name, error: plugin.lastError });
      await this.eventBus.emit(PluginEvent.PLUGIN_ERROR, {
        pluginName: name,
        error: plugin.lastError
      });

      throw error;
    }
  }

  async stopPlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin not found: ${name}`);
    }

    if (plugin.status !== PluginStatus.RUNNING) {
      this.logger.warn(`Plugin ${name} is not running`);
      return;
    }

    this.logger.info(`Stopping plugin: ${name}`);

    try {
      await plugin.stop();
      plugin.status = PluginStatus.STOPPED;

      // Emit events
      this.emit('plugin-stopped', { plugin: name });
      await this.eventBus.emit(PluginEvent.PLUGIN_STOPPED, {
        pluginName: name
      });

      this.logger.info(`Plugin stopped successfully: ${name}`);

    } catch (error) {
      plugin.status = PluginStatus.ERROR;
      plugin.lastError = error instanceof Error ? error : new Error(String(error));

      this.emit('plugin-error', { plugin: name, error: plugin.lastError });
      await this.eventBus.emit(PluginEvent.PLUGIN_ERROR, {
        pluginName: name,
        error: plugin.lastError
      });

      throw error;
    }
  }

  async getPlugin(name: string): Promise<IPlugin | null> {
    return this.plugins.get(name) || null;
  }

  async listPlugins(filter?: {
    category?: string;
    status?: PluginStatus;
    tags?: string[];
  }): Promise<IPlugin[]> {
    let plugins = Array.from(this.plugins.values());

    if (filter) {
      if (filter.category) {
        plugins = plugins.filter(p => p.manifest.category === filter.category);
      }

      if (filter.status) {
        plugins = plugins.filter(p => p.status === filter.status);
      }

      if (filter.tags && filter.tags.length > 0) {
        plugins = plugins.filter(p =>
          filter.tags!.some(tag => p.manifest.tags?.includes(tag))
        );
      }
    }

    return plugins;
  }

  async getPluginsByCategory(category: string): Promise<IPlugin[]> {
    const pluginNames = this.pluginsByCategory.get(category) || new Set();
    return Array.from(pluginNames)
      .map(name => this.plugins.get(name))
      .filter((plugin): plugin is IPlugin => plugin !== undefined);
  }

  async checkDependencies(plugin: IPlugin): Promise<void> {
    if (!plugin.manifest.dependencies || plugin.manifest.dependencies.length === 0) {
      return;
    }

    for (const dependency of plugin.manifest.dependencies) {
      const [depName, requiredVersion] = dependency.split('@');
      const depPlugin = this.plugins.get(depName);

      if (!depPlugin) {
        throw new Error(`Dependency not found: ${depName}`);
      }

      if (requiredVersion) {
        const isCompatible = await this.checkCompatibility(depPlugin, requiredVersion);
        if (!isCompatible.compatible) {
          throw new Error(`Incompatible dependency version: ${dependency}. ${isCompatible.reason}`);
        }
      }

      if (depPlugin.status !== PluginStatus.RUNNING) {
        throw new Error(`Dependency not running: ${depName}`);
      }
    }
  }

  async getDependencyGraph(): Promise<Map<string, string[]>> {
    const graph = new Map<string, string[]>();

    for (const [name, dependencies] of this.dependencies.entries()) {
      graph.set(name, Array.from(dependencies));
    }

    return graph;
  }

  private async validatePlugin(plugin: IPlugin): Promise<void> {
    // Validate manifest
    if (!plugin.manifest) {
      throw new Error(`Plugin ${plugin.name} missing manifest`);
    }

    // Validate required fields
    const requiredFields = ['name', 'version', 'entryPoint'];
    for (const field of requiredFields) {
      if (!(field in plugin.manifest)) {
        throw new Error(`Plugin ${plugin.name} missing required field: ${field}`);
      }
    }

    // Validate version format
    if (!this.isValidVersion(plugin.version)) {
      throw new Error(`Invalid version format: ${plugin.version}`);
    }

    // Validate entry point exists
    const entryPointPath = path.join(plugin.workingDirectory, plugin.manifest.entryPoint);
    try {
      await fs.access(entryPointPath);
    } catch {
      throw new Error(`Entry point not found: ${entryPointPath}`);
    }
  }

  private async checkForConflicts(plugin: IPlugin): Promise<void> {
    const existing = this.plugins.get(plugin.name);
    if (existing && existing.version !== plugin.version) {
      throw new Error(`Plugin ${plugin.name} already registered with version ${existing.version}`);
    }
  }

  private async checkCompatibility(plugin: IPlugin, requiredVersion: string): Promise<PluginCompatibilityResult> {
    try {
      const isCompatible = this.compareVersions(plugin.version, requiredVersion) >= 0;
      return {
        isCompatible,
        requiredVersion,
        actualVersion: plugin.version,
        warnings: isCompatible ? [] : [`Version ${plugin.version} is not compatible with required ${requiredVersion}`]
      };
    } catch (error) {
      return {
        isCompatible: false,
        requiredVersion,
        actualVersion: plugin.version,
        warnings: [`Compatibility check failed: ${error}`]
      };
    }
  }

  private isValidVersion(version: string): boolean {
    // Simple semantic version validation
    const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?(\+[a-zA-Z0-9]+)?$/;
    return semverRegex.test(version);
  }

  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);

    const maxLength = Math.max(v1Parts.length, v2Parts.length);

    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;

      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }

    return 0;
  }
}

/**
 * Plugin Discovery Implementation
 * Handles discovery of plugins from various sources
 */
export class PluginDiscovery implements IPluginDiscovery {
  private readonly logger: ILogger;
  private readonly searchPaths: string[] = [];

  constructor(logger: ILogger, searchPaths: string[] = []) {
    this.logger = logger;
    this.searchPaths = searchPaths;
  }

  async discoverPlugins(directory: string): Promise<IPluginManifest[]> {
    this.logger.info(`Discovering plugins in directory: ${directory}`);

    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });
      const manifests: IPluginManifest[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginPath = path.join(directory, entry.name);
          const manifestPath = path.join(pluginPath, 'plugin.json');

          try {
            const manifestData = await fs.readFile(manifestPath, 'utf-8');
            const manifest: IPluginManifest = JSON.parse(manifestData);
            manifests.push(manifest);

            this.logger.debug(`Found plugin manifest: ${entry.name}`);
          } catch (error) {
            this.logger.warn(`Failed to read manifest for ${entry.name}: ${error}`);
          }
        }
      }

      this.logger.info(`Discovered ${manifests.length} plugins in ${directory}`);
      return manifests;

    } catch (error) {
      this.logger.error(`Failed to discover plugins in ${directory}: ${error}`);
      throw error;
    }
  }

  async searchPlugins(query: string, options?: {
    category?: string;
    tags?: string[];
    limit?: number;
  }): Promise<IPluginManifest[]> {
    this.logger.info(`Searching plugins with query: ${query}`);

    const allManifests: IPluginManifest[] = [];

    // Search in all configured paths
    for (const searchPath of this.searchPaths) {
      try {
        const manifests = await this.discoverPlugins(searchPath);
        allManifests.push(...manifests);
      } catch (error) {
        this.logger.warn(`Failed to search in ${searchPath}: ${error}`);
      }
    }

    // Filter results
    let filtered = allManifests.filter(manifest =>
      manifest.name.toLowerCase().includes(query.toLowerCase()) ||
      manifest.description?.toLowerCase().includes(query.toLowerCase())
    );

    if (options?.category) {
      filtered = filtered.filter(m => m.category === options.category);
    }

    if (options?.tags && options.tags.length > 0) {
      filtered = filtered.filter(m =>
        options.tags!.some(tag => m.tags?.includes(tag))
      );
    }

    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    this.logger.info(`Found ${filtered.length} plugins matching query: ${query}`);
    return filtered;
  }

  async getPluginUpdates(pluginName: string, currentVersion: string): Promise<IPluginManifest[]> {
    this.logger.info(`Checking for updates for plugin: ${pluginName}@${currentVersion}`);

    // This would typically check a registry or remote source
    // For now, return empty array
    return [];
  }

  async installPlugin(source: string, options?: {
    force?: boolean;
    dependencies?: boolean;
  }): Promise<void> {
    this.logger.info(`Installing plugin from source: ${source}`);

    // Implementation would depend on the source type (git, npm, file, etc.)
    // For now, this is a placeholder
    throw new Error('Plugin installation not implemented yet');
  }

  addSearchPath(path: string): void {
    if (!this.searchPaths.includes(path)) {
      this.searchPaths.push(path);
      this.logger.debug(`Added plugin search path: ${path}`);
    }
  }

  removeSearchPath(path: string): void {
    const index = this.searchPaths.indexOf(path);
    if (index !== -1) {
      this.searchPaths.splice(index, 1);
      this.logger.debug(`Removed plugin search path: ${path}`);
    }
  }
}
