/**
 * Plugin Registry for Claude Agent Platform
 *
 * Manages plugin registration, discovery, lifecycle, and compatibility.
 * Supports hot-reloading, sandboxing, and comprehensive plugin management.
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as chokidar from 'chokidar';
import {
  IPlugin,
  IPluginRegistry,
  IPluginFactory,
  IPluginReloader,
  PluginContext,
  PluginConfig,
  PluginFilter,
  PluginStatus,
  DiscoveredPlugin,
  PluginManifest,
  PluginCompatibilityReport,
  PluginEvents,
  PluginMetadata
} from './interfaces';
import { Agent } from '../interfaces';
import { logger } from '@claude-agent/utils';

export class PluginRegistry extends EventEmitter implements IPluginRegistry {
  private plugins = new Map<string, RegisteredPlugin>();
  private factory: IPluginFactory;
  private reloader: IPluginReloader;
  private platformVersion: string;
  private nodeVersion: string;
  private operatingSystem: string;
  private architecture: string;
  private watchers = new Map<string, chokidar.FSWatcher>();

  constructor(
    factory: IPluginFactory,
    reloader: IPluginReloader,
    options: PluginRegistryOptions = {}
  ) {
    super();
    this.factory = factory;
    this.reloader = reloader;
    this.platformVersion = options.platformVersion || '1.0.0';
    this.nodeVersion = options.nodeVersion || process.version;
    this.operatingSystem = options.operatingSystem || process.platform;
    this.architecture = options.architecture || process.arch;

    this.setupEventForwarding();
  }

  /**
   * Register a plugin
   */
  async register(plugin: IPlugin, config: PluginConfig = {}): Promise<void> {
    const pluginId = plugin.id;

    try {
      // Check if plugin already exists
      if (this.plugins.has(pluginId)) {
        throw new Error(`Plugin ${pluginId} is already registered`);
      }

      // Validate plugin compatibility
      const compatibilityReport = await this.validateCompatibility(plugin);
      if (!compatibilityReport.compatible) {
        throw new Error(
          `Plugin ${pluginId} is not compatible: ${compatibilityReport.errors.join(', ')}`
        );
      }

      // Create plugin context
      const context = await this.createPluginContext(plugin, config);

      // Initialize plugin
      await plugin.initialize(context);

      // Register plugin
      const registeredPlugin: RegisteredPlugin = {
        plugin,
        context,
        config: { ...this.getDefaultConfig(), ...config },
        status: {
          id: pluginId,
          status: 'initialized',
          enabled: config.enabled !== false,
          lastActivity: new Date(),
          version: plugin.version
        },
        health: null,
        metrics: null,
        registeredAt: new Date()
      };

      this.plugins.set(pluginId, registeredPlugin);

      // Auto-start if configured
      if (registeredPlugin.config.autoStart) {
        await this.startPlugin(pluginId);
      }

      // Enable hot reloading if configured
      if (config.hotReload) {
        await this.reloader.enableHotReload(pluginId, config.hotReload);
      }

      // Emit events
      this.emit('plugin:registered', { plugin });
      logger.info(`Plugin ${plugin.name} (${pluginId}) registered successfully`);

    } catch (error) {
      logger.error(`Failed to register plugin ${pluginId}:`, error);
      this.emit('plugin:error', { plugin: { id: pluginId, name: plugin.name } as IPlugin, error });
      throw error;
    }
  }

  /**
   * Unregister a plugin
   */
  async unregister(pluginId: string): Promise<void> {
    const registeredPlugin = this.plugins.get(pluginId);
    if (!registeredPlugin) {
      throw new Error(`Plugin ${pluginId} is not registered`);
    }

    try {
      // Stop plugin if running
      if (registeredPlugin.status.status === 'running') {
        await this.stopPlugin(pluginId);
      }

      // Disable hot reloading
      await this.reloader.disableHotReload(pluginId);

      // Cleanup plugin
      await registeredPlugin.plugin.cleanup();

      // Remove from registry
      this.plugins.delete(pluginId);

      // Clean up watchers
      if (this.watchers.has(pluginId)) {
        const watcher = this.watchers.get(pluginId)!;
        await watcher.close();
        this.watchers.delete(pluginId);
      }

      // Emit events
      this.emit('plugin:unregistered', { pluginId });
      logger.info(`Plugin ${pluginId} unregistered successfully`);

    } catch (error) {
      logger.error(`Failed to unregister plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Get a plugin by ID
   */
  async getPlugin(pluginId: string): Promise<IPlugin | null> {
    const registeredPlugin = this.plugins.get(pluginId);
    return registeredPlugin ? registeredPlugin.plugin : null;
  }

  /**
   * Get all registered plugins
   */
  async getPlugins(filter: PluginFilter = {}): Promise<IPlugin[]> {
    const plugins = Array.from(this.plugins.values())
      .filter(registeredPlugin => {
        if (filter.enabled !== undefined && filter.enabled !== registeredPlugin.status.enabled) {
          return false;
        }
        if (filter.status && filter.status !== registeredPlugin.status.status) {
          return false;
        }
        if (filter.author && registeredPlugin.plugin.author.name !== filter.author) {
          return false;
        }
        if (filter.capability) {
          const hasCapability = registeredPlugin.plugin.capabilities.some(
            cap => cap.name === filter.capability
          );
          if (!hasCapability) return false;
        }
        if (filter.tag) {
          // Check tags in metadata or keywords
          const hasTag = registeredPlugin.context.metadata.tags?.includes(filter.tag) ||
                         registeredPlugin.plugin.keywords?.includes(filter.tag);
          if (!hasTag) return false;
        }
        return true;
      })
      .map(registeredPlugin => registeredPlugin.plugin);

    return plugins;
  }

  /**
   * Get plugins by capability
   */
  async getPluginsByCapability(capability: string): Promise<IPlugin[]> {
    const plugins = Array.from(this.plugins.values())
      .filter(registeredPlugin =>
        registeredPlugin.plugin.capabilities.some(cap => cap.name === capability)
      )
      .map(registeredPlugin => registeredPlugin.plugin);

    return plugins;
  }

  /**
   * Enable/disable a plugin
   */
  async setPluginStatus(pluginId: string, enabled: boolean): Promise<void> {
    const registeredPlugin = this.plugins.get(pluginId);
    if (!registeredPlugin) {
      throw new Error(`Plugin ${pluginId} is not registered`);
    }

    try {
      const wasEnabled = registeredPlugin.status.enabled;
      registeredPlugin.status.enabled = enabled;
      registeredPlugin.status.lastActivity = new Date();

      // Start plugin if enabling and not running
      if (enabled && !wasEnabled && registeredPlugin.status.status === 'initialized') {
        await this.startPlugin(pluginId);
      }

      // Stop plugin if disabling and running
      if (!enabled && wasEnabled && registeredPlugin.status.status === 'running') {
        await this.stopPlugin(pluginId);
      }

      this.emit('plugin:status:changed', { plugin: registeredPlugin.plugin, status: registeredPlugin.status });
      logger.info(`Plugin ${pluginId} ${enabled ? 'enabled' : 'disabled'}`);

    } catch (error) {
      logger.error(`Failed to set plugin status for ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Update plugin configuration
   */
  async updatePluginConfig(pluginId: string, config: Partial<PluginConfig>): Promise<void> {
    const registeredPlugin = this.plugins.get(pluginId);
    if (!registeredPlugin) {
      throw new Error(`Plugin ${pluginId} is not registered`);
    }

    try {
      const oldConfig = registeredPlugin.config;
      const newConfig = { ...oldConfig, ...config };

      // Update context configuration
      registeredPlugin.context.config = newConfig.config || {};
      registeredPlugin.context.permissions = newConfig.permissions || this.getDefaultPermissions();
      registeredPlugin.context.metadata = { ...registeredPlugin.context.metadata, ...config.metadata };

      // Apply new configuration
      registeredPlugin.config = newConfig;

      // Handle hot reloading changes
      if (oldConfig.hotReload !== newConfig.hotReload) {
        if (newConfig.hotReload) {
          await this.reloader.enableHotReload(pluginId, newConfig);
        } else {
          await this.reloader.disableHotReload(pluginId);
        }
      }

      this.emit('plugin:config:updated', { plugin: registeredPlugin.plugin, config: newConfig });
      logger.info(`Plugin ${pluginId} configuration updated`);

    } catch (error) {
      logger.error(`Failed to update plugin config for ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Get plugin status
   */
  async getPluginStatus(pluginId: string): Promise<PluginStatus> {
    const registeredPlugin = this.plugins.get(pluginId);
    if (!registeredPlugin) {
      throw new Error(`Plugin ${pluginId} is not registered`);
    }

    // Update last activity
    registeredPlugin.status.lastActivity = new Date();

    return registeredPlugin.status;
  }

  /**
   * Discover plugins in a directory
   */
  async discoverPlugins(directory: string): Promise<DiscoveredPlugin[]> {
    if (!await fs.access(directory).catch(() => false)) {
      throw new Error(`Plugin directory does not exist: ${directory}`);
    }

    const discoveredPlugins: DiscoveredPlugin[] = [];

    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Check for package.json or plugin.json
          const pluginPath = path.join(directory, entry.name);
          const manifestPath = path.join(pluginPath, 'plugin.json');
          const packagePath = path.join(pluginPath, 'package.json');

          let manifestPathToUse: string;
          if (await fs.access(manifestPath).catch(() => false)) {
            manifestPathToUse = manifestPath;
          } else if (await fs.access(packagePath).catch(() => false)) {
            manifestPathToUse = packagePath;
          } else {
            continue; // Skip if no manifest found
          }

          try {
            const manifestContent = await fs.readFile(manifestPathToUse, 'utf8');
            const manifest: PluginManifest = JSON.parse(manifestContent);

            // Get file stats for metadata
            const stats = await fs.stat(manifestPathToUse);
            const fileBuffer = await fs.readFile(manifestPathToUse);
            const fileHash = this.calculateFileHash(fileBuffer);

            const discoveredPlugin: DiscoveredPlugin = {
              path: pluginPath,
              manifest,
              metadata: {
                fileSize: stats.size,
                fileHash,
                lastModified: stats.mtime,
                discoveredAt: new Date()
              }
            };

            discoveredPlugins.push(discoveredPlugin);

            // Emit discovery event
            this.emit('plugin:discovered', { plugins: [discoveredPlugin] });

          } catch (error) {
            logger.warn(`Failed to load plugin manifest from ${manifestPathToUse}:`, error);
          }
        }
      }

      logger.info(`Discovered ${discoveredPlugins.length} plugins in ${directory}`);

    } catch (error) {
      logger.error(`Failed to discover plugins in ${directory}:`, error);
      throw error;
    }

    return discoveredPlugins;
  }

  /**
   * Validate plugin compatibility
   */
  async validateCompatibility(plugin: IPlugin): Promise<PluginCompatibilityReport> {
    const report: PluginCompatibilityReport = {
      compatible: true,
      platformVersion: {
        compatible: this.isVersionCompatible(plugin.compatibility.platformVersion, this.platformVersion),
        required: plugin.compatibility.platformVersion,
        current: this.platformVersion
      },
      nodeVersion: {
        compatible: this.isVersionCompatible(plugin.compatibility.nodeVersion, this.nodeVersion),
        required: plugin.compatibility.nodeVersion,
        current: this.nodeVersion
      },
      operatingSystem: {
        compatible: plugin.compatibility.operatingSystems.includes(this.operatingSystem) ||
                   plugin.compatibility.operatingSystems.includes('any'),
        required: plugin.compatibility.operatingSystems,
        current: this.operatingSystem
      },
      architecture: {
        compatible: plugin.compatibility.architectures.includes(this.architecture) ||
                   plugin.compatibility.architectures.includes('any'),
        required: plugin.compatibility.architectures,
        current: this.architecture
      },
      permissions: {
        missing: [],
        optional: [],
        granted: []
      },
      dependencies: {
        missing: [],
        satisfied: plugin.dependencies.filter(dep => !dep.optional),
        versionConflicts: []
      },
      warnings: [],
      errors: []
    };

    // Check platform version compatibility
    if (!report.platformVersion.compatible) {
      report.compatible = false;
      report.errors.push(`Platform version ${report.platformVersion.required} required, current: ${report.platformVersion.current}`);
    }

    // Check Node.js version compatibility
    if (!report.nodeVersion.compatible) {
      report.compatible = false;
      report.errors.push(`Node.js version ${report.nodeVersion.required} required, current: ${report.nodeVersion.current}`);
    }

    // Check dependencies
    for (const dependency of plugin.dependencies) {
      const isAvailable = await this.checkDependencyAvailability(dependency);
      if (!isAvailable && dependency.optional) {
        report.dependencies.missing.push(dependency);
      } else if (!isAvailable) {
        report.dependencies.missing.push(dependency);
        report.compatible = false;
        report.errors.push(`Missing dependency: ${dependency.name}@${dependency.version}`);
      }
    }

    // Check permissions (would need integration with permission system)
    const missingPerms = plugin.compatibility.requiredPermissions.filter(
      perm => !this.hasPermission(perm)
    );
    if (missingPerms.length > 0) {
      report.permissions.missing = missingPerms;
      report.warnings.push(`Missing required permissions: ${missingPerms.join(', ')}`);
    }

    report.optionalPermissions = plugin.compatibility.optionalPermissions.filter(
      perm => !this.hasPermission(perm)
    );

    return report;
  }

  /**
   * Start a plugin
   */
  private async startPlugin(pluginId: string): Promise<void> {
    const registeredPlugin = this.plugins.get(pluginId);
    if (!registeredPlugin) {
      throw new Error(`Plugin ${pluginId} is not registered`);
    }

    if (registeredPlugin.status.status !== 'initialized' && registeredPlugin.status.status !== 'stopped') {
      throw new Error(`Plugin ${pluginId} cannot be started from status: ${registeredPlugin.status.status}`);
    }

    try {
      registeredPlugin.status.status = 'running';
      registeredPlugin.status.lastActivity = new Date();

      // Update plugin health
      registeredPlugin.health = await registeredPlugin.plugin.getHealth();

      this.emit('plugin:started', { plugin: registeredPlugin.plugin });
      logger.info(`Plugin ${pluginId} started`);

    } catch (error) {
      registeredPlugin.status.status = 'error';
      this.emit('plugin:error', { plugin: registeredPlugin.plugin, error });
      throw error;
    }
  }

  /**
   * Stop a plugin
   */
  private async stopPlugin(pluginId: string): Promise<void> {
    const registeredPlugin = this.plugins.get(pluginId);
    if (!registeredPlugin) {
      throw new Error(`Plugin ${pluginId} is not registered`);
    }

    if (registeredPlugin.status.status !== 'running') {
      return;
    }

    try {
      registeredPlugin.status.status = 'stopped';
      registeredPlugin.status.lastActivity = new Date();

      this.emit('plugin:stopped', { plugin: registeredPlugin.plugin });
      logger.info(`Plugin ${pluginId} stopped`);

    } catch (error) {
      registeredPlugin.status.status = 'error';
      this.emit('plugin:error', { plugin: registeredPlugin.plugin, error });
      throw error;
    }
  }

  /**
   * Create plugin context
   */
  private async createPluginContext(plugin: IPlugin, config: PluginConfig): Promise<PluginContext> {
    const pluginId = plugin.id;

    // Create directories
    const workingDir = path.join(process.cwd(), 'plugins', pluginId);
    const dataDir = path.join(workingDir, 'data');

    await fs.mkdir(workingDir, { recursive: true });
    await fs.mkdir(dataDir, { recursive: true });

    return {
      agent: {} as Agent, // Will be injected by the agent service
      workingDirectory: workingDir,
      dataDirectory: dataDir,
      config: config.config || {},
      permissions: config.permissions || this.getDefaultPermissions(),
      logger: this.createPluginLogger(plugin),
      events: new EventEmitter(),
      sandbox: {} as any, // Will be initialized by sandbox manager
      registry: this,
      metadata: config.metadata || {}
    };
  }

  /**
   * Create plugin logger
   */
  private createPluginLogger(plugin: IPlugin): PluginLogger {
    const pluginId = plugin.id;

    return {
      debug: (message: string, ...args: any[]) => {
        logger.debug(`[${pluginId}] ${message}`, ...args);
      },
      info: (message: string, ...args: any[]) => {
        logger.info(`[${pluginId}] ${message}`, ...args);
      },
      warn: (message: string, ...args: any[]) => {
        logger.warn(`[${pluginId}] ${message}`, ...args);
      },
      error: (message: string, ...args: any[]) => {
        logger.error(`[${pluginId}] ${message}`, ...args);
      },
      child: (context: string): PluginLogger => {
        return this.createPluginLogger({ ...plugin, id: `${pluginId}:${context}` } as IPlugin);
      }
    };
  }

  /**
   * Setup event forwarding
   */
  private setupEventForwarding(): void {
    // Forward reloader events
    this.reloader.on('plugin:reloaded', (data) => {
      const registeredPlugin = this.plugins.get(data.pluginId);
      if (registeredPlugin) {
        this.emit('plugin:status:changed', { plugin: registeredPlugin.plugin, status: registeredPlugin.status });
      }
    });

    this.reloader.on('plugin:reload:error', (data) => {
      const registeredPlugin = this.plugins.get(data.pluginId);
      if (registeredPlugin) {
        this.emit('plugin:error', { plugin: registeredPlugin.plugin, error: data.error });
      }
    });
  }

  /**
   * Get default plugin configuration
   */
  private getDefaultConfig(): PluginConfig {
    return {
      enabled: true,
      autoStart: false,
      permissions: this.getDefaultPermissions(),
      sandbox: {
        enabled: true,
        isolateFileSystem: true,
        isolateNetwork: true,
        limitMemory: true,
        limitCpu: true,
        allowedCommands: ['node', 'npm'],
        blockedCommands: ['rm', 'sudo', 'chmod 777'],
        timeoutMs: 30000
      },
      healthCheck: {
        enabled: true,
        interval: 60000,
        timeout: 5000
      },
      logging: {
        level: 'info',
        format: 'json',
        console: true
      },
      metrics: {
        enabled: true,
        interval: 60000,
        retention: 86400000 // 24 hours
      }
    };
  }

  /**
   * Get default permissions
   */
  private getDefaultPermissions(): PluginPermissions {
    return {
      fileSystem: {
        read: true,
        write: true,
        execute: false,
        directories: ['data', 'logs'],
        files: ['*.log', '*.json', '*.txt'],
        patterns: []
      },
      network: {
        outgoing: false,
        incoming: false,
        domains: [],
        protocols: [],
        ports: []
      },
      system: {
        environment: true,
        childProcesses: false,
        systemInfo: true,
        custom: {}
      },
      custom: {}
    };
  }

  /**
   * Check if version is compatible (semver)
   */
  private isVersionCompatible(required: string, current: string): boolean {
    const requiredParts = required.split('.').map(Number);
    const currentParts = current.split('.').map(Number);

    // Major version must match
    if (requiredParts[0] !== currentParts[0]) {
      return false;
    }

    // Minor version should be >= required
    if (currentParts[1] < requiredParts[1]) {
      return false;
    }

    // Patch version doesn't need to match
    return true;
  }

  /**
   * Check dependency availability
   */
  private async checkDependencyAvailability(dependency: PluginDependency): Promise<boolean> {
    // This would integrate with package manager or service registry
    // For now, assume optional dependencies are optional
    return dependency.optional;
  }

  /**
   * Check if permission is granted
   */
  private hasPermission(permission: string): boolean {
    // This would integrate with permission system
    // For now, assume basic permissions are granted
    const grantedPermissions = [
      'read', 'write', 'execute', 'network', 'system'
    ];
    return grantedPermissions.includes(permission);
  }

  /**
   * Calculate file hash
   */
  private calculateFileHash(buffer: Buffer): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Cleanup all plugins
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up plugin registry');

    // Stop all running plugins
    for (const [pluginId, registeredPlugin] of this.plugins) {
      if (registeredPlugin.status.status === 'running') {
        try {
          await this.stopPlugin(pluginId);
        } catch (error) {
          logger.error(`Failed to stop plugin ${pluginId} during cleanup:`, error);
        }
      }
    }

    // Unregister all plugins
    const pluginIds = Array.from(this.plugins.keys());
    for (const pluginId of pluginIds) {
      try {
        await this.unregister(pluginId);
      } catch (error) {
        logger.error(`Failed to unregister plugin ${pluginId} during cleanup:`, error);
      }
    }

    // Stop all watchers
    for (const [pluginId, watcher] of this.watchers) {
      try {
        await watcher.close();
      } catch (error) {
        logger.error(`Failed to stop watching plugin ${pluginId}:`, error);
      }
    }
    this.watchers.clear();

    // Clear registry
    this.plugins.clear();
    this.removeAllListeners();

    logger.info('Plugin registry cleanup complete');
  }

  /**
   * Get registry statistics
   */
  getStats(): PluginRegistryStats {
    const plugins = Array.from(this.plugins.values());

    return {
      total: plugins.length,
      enabled: plugins.filter(p => p.status.enabled).length,
      running: plugins.filter(p => p.status.status === 'running').length,
      byStatus: plugins.reduce((acc, p) => {
        acc[p.status.status] = (acc[p.status.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byType: plugins.reduce((acc, p) => {
        const type = this.categorizePlugin(p.plugin);
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }

  /**
   * Categorize plugin by type
   */
  private categorizePlugin(plugin: IPlugin): string {
    // Categorize based on capabilities or naming convention
    if (plugin.capabilities.some(cap => cap.name.includes('agent'))) {
      return 'agent';
    }
    if (plugin.capabilities.some(cap => cap.name.includes('service'))) {
      return 'service';
    }
    if (plugin.capabilities.some(cap => cap.name.includes('utility'))) {
      return 'utility';
    }
    if (plugin.capabilities.some(cap => cap.name.includes('integration'))) {
      return 'integration';
    }
    return 'custom';
  }
}

interface PluginRegistryOptions {
  platformVersion?: string;
  nodeVersion?: string;
  operatingSystem?: string;
  architecture?: string;
}

interface RegisteredPlugin {
  plugin: IPlugin;
  context: PluginContext;
  config: PluginConfig;
  status: PluginStatus;
  health: any;
  metrics: any;
  registeredAt: Date;
}

interface PluginRegistryStats {
  total: number;
  enabled: number;
  running: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
}
