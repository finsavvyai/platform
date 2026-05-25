import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as chokidar from 'chokidar';
import * as debounce from 'debounce';
import {
  IPlugin,
  IPluginRegistry,
  PluginStatus,
  PluginEvent,
  IPluginDiscovery,
  ILogger,
  IEventBus
} from './interfaces';

/**
 * Hot Reload Configuration
 */
export interface HotReloadConfig {
  enabled: boolean;
  debounceMs: number;
  filePatterns: string[];
  ignorePatterns: string[];
  autoReload: boolean;
  requireConfirmation: boolean;
  maxRetries: number;
  backupOnReload: boolean;
  validateOnReload: boolean;
}

/**
 * Reload Event
 */
export interface ReloadEvent {
  type: 'file-changed' | 'file-added' | 'file-deleted' | 'directory-changed';
  pluginName: string;
  filePath: string;
  timestamp: Date;
  requiresReload: boolean;
  changeType: 'config' | 'code' | 'manifest' | 'dependency';
}

/**
 * Reload Result
 */
export interface ReloadResult {
  success: boolean;
  pluginName: string;
  previousVersion?: string;
  newVersion?: string;
  reloadTime: number;
  error?: Error;
  warnings: string[];
}

/**
 * Plugin Hot Reload Manager
 * Handles hot-reloading of plugins with intelligent change detection and rollback
 */
export class PluginHotReloader extends EventEmitter {
  private readonly config: HotReloadConfig;
  private readonly registry: IPluginRegistry;
  private readonly discovery: IPluginDiscovery;
  private readonly logger: ILogger;
  private readonly eventBus: IEventBus;
  private readonly watchers: Map<string, any> = new Map();
  private readonly pendingReloads: Map<string, NodeJS.Timeout> = new Map();
  private readonly reloadHistory: ReloadResult[] = [];
  private readonly pluginStates: Map<string, any> = new Map();
  private isEnabled = false;

  constructor(
    config: HotReloadConfig,
    registry: IPluginRegistry,
    discovery: IPluginDiscovery,
    logger: ILogger,
    eventBus: IEventBus
  ) {
    super();

    this.config = config;
    this.registry = registry;
    this.discovery = discovery;
    this.logger = logger.child({ component: 'PluginHotReloader' });
    this.eventBus = eventBus;

    // Setup debounced reload handler
    this.debouncedReload = debounce(this.handleReload.bind(this), config.debounceMs);
  }

  async start(pluginDirectories: string[]): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('Hot reload is disabled');
      return;
    }

    if (this.isEnabled) {
      this.logger.warn('Hot reloader is already enabled');
      return;
    }

    this.logger.info('Starting plugin hot reloader');

    try {
      // Setup file watchers for all plugin directories
      for (const directory of pluginDirectories) {
        await this.setupWatcher(directory);
      }

      // Setup event listeners
      this.setupEventListeners();

      this.isEnabled = true;
      this.emit('hot-reload-enabled');
      await this.eventBus.emit('plugin-hot-reload-enabled', {
        timestamp: Date.now()
      });

      this.logger.info('Plugin hot reloader started successfully');

    } catch (error) {
      this.logger.error(`Failed to start hot reloader: ${error}`);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isEnabled) {
      this.logger.warn('Hot reloader is not enabled');
      return;
    }

    this.logger.info('Stopping plugin hot reloader');

    try {
      // Clear pending reloads
      for (const timeout of this.pendingReloads.values()) {
        clearTimeout(timeout);
      }
      this.pendingReloads.clear();

      // Stop all watchers
      for (const [directory, watcher] of this.watchers.entries()) {
        try {
          await watcher.close();
          this.logger.debug(`Stopped watcher for directory: ${directory}`);
        } catch (error) {
          this.logger.error(`Failed to stop watcher for ${directory}: ${error}`);
        }
      }
      this.watchers.clear();

      this.isEnabled = false;
      this.emit('hot-reload-disabled');
      await this.eventBus.emit('plugin-hot-reload-disabled', {
        timestamp: Date.now()
      });

      this.logger.info('Plugin hot reloader stopped successfully');

    } catch (error) {
      this.logger.error(`Failed to stop hot reloader: ${error}`);
      throw error;
    }
  }

  async reloadPlugin(pluginName: string, force = false): Promise<ReloadResult> {
    this.logger.info(`Reloading plugin: ${pluginName}`);

    const startTime = Date.now();
    let result: ReloadResult;

    try {
      const plugin = await this.registry.getPlugin(pluginName);
      if (!plugin) {
        throw new Error(`Plugin not found: ${pluginName}`);
      }

      // Store current state for potential rollback
      const previousState = await this.capturePluginState(plugin);
      this.pluginStates.set(pluginName, previousState);

      // Stop plugin if running
      const wasRunning = plugin.status === PluginStatus.RUNNING;
      if (wasRunning) {
        await this.registry.stopPlugin(pluginName);
      }

      // Unregister plugin
      await this.registry.unregisterPlugin(pluginName);

      // Reload plugin manifest and code
      const reloadedPlugin = await this.reloadPluginFromDisk(plugin);

      // Validate reloaded plugin
      if (this.config.validateOnReload) {
        await this.validatePlugin(reloadedPlugin);
      }

      // Register reloaded plugin
      await this.registry.registerPlugin(reloadedPlugin);

      // Restart plugin if it was running
      if (wasRunning) {
        await this.registry.startPlugin(pluginName);
      }

      const reloadTime = Date.now() - startTime;

      result = {
        success: true,
        pluginName,
        previousVersion: previousState.version,
        newVersion: reloadedPlugin.version,
        reloadTime,
        warnings: []
      };

      this.logger.info(`Plugin reloaded successfully: ${pluginName} (${reloadTime}ms)`);
      this.emit('plugin-reloaded', result);
      await this.eventBus.emit('plugin-reloaded', result);

    } catch (error) {
      const reloadTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error : new Error(String(error));

      // Attempt rollback if enabled
      if (this.config.backupOnReload && !force) {
        try {
          await this.rollbackPlugin(pluginName);
          result = {
            success: true,
            pluginName,
            reloadTime,
            warnings: ['Plugin failed to reload, but was successfully rolled back']
          };

          this.logger.warn(`Plugin reload failed, rolled back: ${pluginName}`);

        } catch (rollbackError) {
          result = {
            success: false,
            pluginName,
            reloadTime,
            error: errorMessage,
            warnings: ['Plugin reload failed and rollback also failed']
          };

          this.logger.error(`Plugin reload and rollback failed: ${pluginName}`);
        }
      } else {
        result = {
          success: false,
          pluginName,
          reloadTime,
          error: errorMessage,
          warnings: []
        };

        this.logger.error(`Plugin reload failed: ${pluginName} - ${errorMessage.message}`);
      }

      this.emit('plugin-reload-failed', result);
      await this.eventBus.emit('plugin-reload-failed', result);
    }

    // Store reload result
    this.reloadHistory.push(result);

    // Keep only last 100 reload results
    if (this.reloadHistory.length > 100) {
      this.reloadHistory.shift();
    }

    return result;
  }

  async enableAutoReload(pluginName: string): Promise<void> {
    this.logger.info(`Enabling auto reload for plugin: ${pluginName}`);

    // Store auto-reload preference
    const plugin = await this.registry.getPlugin(pluginName);
    if (plugin) {
      (plugin as any).autoReloadEnabled = true;
    }

    this.emit('auto-reload-enabled', { pluginName });
  }

  async disableAutoReload(pluginName: string): Promise<void> {
    this.logger.info(`Disabling auto reload for plugin: ${pluginName}`);

    // Remove auto-reload preference
    const plugin = await this.registry.getPlugin(pluginName);
    if (plugin) {
      (plugin as any).autoReloadEnabled = false;
    }

    this.emit('auto-reload-disabled', { pluginName });
  }

  getReloadHistory(pluginName?: string): ReloadResult[] {
    if (pluginName) {
      return this.reloadHistory.filter(result => result.pluginName === pluginName);
    }
    return [...this.reloadHistory];
  }

  getPendingReloads(): string[] {
    return Array.from(this.pendingReloads.keys());
  }

  getHotReloadStats(): any {
    const successful = this.reloadHistory.filter(r => r.success).length;
    const failed = this.reloadHistory.filter(r => !r.success).length;
    const avgReloadTime = this.reloadHistory.length > 0
      ? this.reloadHistory.reduce((sum, r) => sum + r.reloadTime, 0) / this.reloadHistory.length
      : 0;

    return {
      enabled: this.isEnabled,
      totalReloads: this.reloadHistory.length,
      successfulReloads: successful,
      failedReloads: failed,
      successRate: this.reloadHistory.length > 0 ? (successful / this.reloadHistory.length) * 100 : 0,
      averageReloadTime: Math.round(avgReloadTime),
      pendingReloads: this.pendingReloads.size,
      watchedDirectories: Array.from(this.watchers.keys())
    };
  }

  private async setupWatcher(directory: string): Promise<void> {
    this.logger.debug(`Setting up file watcher for directory: ${directory}`);

    try {
      const watcher = chokidar.watch(directory, {
        ignored: this.config.ignorePatterns,
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50
        }
      });

      // Setup event handlers
      watcher.on('change', (filePath) => this.handleFileChange(filePath, 'change'));
      watcher.on('add', (filePath) => this.handleFileChange(filePath, 'add'));
      watcher.on('unlink', (filePath) => this.handleFileChange(filePath, 'delete'));
      watcher.on('addDir', (dirPath) => this.handleDirectoryChange(dirPath, 'add'));
      watcher.on('unlinkDir', (dirPath) => this.handleDirectoryChange(dirPath, 'delete'));

      this.watchers.set(directory, watcher);
      this.logger.debug(`File watcher setup complete for directory: ${directory}`);

    } catch (error) {
      this.logger.error(`Failed to setup watcher for ${directory}: ${error}`);
      throw error;
    }
  }

  private handleFileChange(filePath: string, type: 'change' | 'add' | 'delete'): void {
    if (!this.isEnabled) {
      return;
    }

    const pluginName = this.extractPluginNameFromPath(filePath);
    if (!pluginName) {
      return;
    }

    const changeType = this.determineChangeType(filePath);
    const requiresReload = this.requiresReload(filePath, changeType);

    const event: ReloadEvent = {
      type: `file-${type}` as any,
      pluginName,
      filePath,
      timestamp: new Date(),
      requiresReload,
      changeType
    };

    this.logger.debug(`File ${type} detected for plugin ${pluginName}: ${filePath}`);
    this.emit('file-changed', event);

    if (requiresReload) {
      this.scheduleReload(pluginName, event);
    }
  }

  private handleDirectoryChange(dirPath: string, type: 'add' | 'delete'): void {
    if (!this.isEnabled) {
      return;
    }

    const pluginName = this.extractPluginNameFromPath(dirPath);
    if (!pluginName) {
      return;
    }

    this.logger.debug(`Directory ${type} detected for plugin ${pluginName}: ${dirPath}`);

    // Directory changes usually require reload
    const event: ReloadEvent = {
      type: `directory-${type}` as any,
      pluginName,
      filePath: dirPath,
      timestamp: new Date(),
      requiresReload: true,
      changeType: 'code'
    };

    this.emit('directory-changed', event);
    this.scheduleReload(pluginName, event);
  }

  private scheduleReload(pluginName: string, event: ReloadEvent): void {
    // Clear existing timeout for this plugin
    const existingTimeout = this.pendingReloads.get(pluginName);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule new reload
    const timeout = setTimeout(() => {
      this.pendingReloads.delete(pluginName);
      this.debouncedReload(pluginName, event);
    }, this.config.debounceMs);

    this.pendingReloads.set(pluginName, timeout);

    this.logger.debug(`Scheduled reload for plugin: ${pluginName} (${this.config.debounceMs}ms)`);
  }

  private async handleReload(pluginName: string, event: ReloadEvent): Promise<void> {
    try {
      // Check if plugin should auto-reload
      const plugin = await this.registry.getPlugin(pluginName);
      if (!plugin || !(plugin as any).autoReloadEnabled && !this.config.autoReload) {
        this.logger.debug(`Skipping reload for plugin ${pluginName} (auto-reload disabled)`);
        this.emit('reload-skipped', { pluginName, reason: 'auto-reload-disabled' });
        return;
      }

      // Require confirmation if configured
      if (this.config.requireConfirmation) {
        this.emit('reload-confirmation-required', { pluginName, event });
        return;
      }

      // Perform reload
      await this.reloadPlugin(pluginName);

    } catch (error) {
      this.logger.error(`Failed to handle reload for plugin ${pluginName}: ${error}`);
    }
  }

  private extractPluginNameFromPath(filePath: string): string | null {
    const parts = filePath.split(path.sep);

    // Look for plugin directory by finding plugin.json
    const pluginJsonIndex = parts.indexOf('plugin.json');
    if (pluginJsonIndex !== -1 && pluginJsonIndex > 0) {
      return parts[pluginJsonIndex - 1];
    }

    // Alternative: check if parent directory is a plugin name
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      if (part && part !== '.' && part !== '..') {
        // Simple heuristic: plugin names are typically kebab-case
        if (/^[a-z][a-z0-9-]*$/.test(part)) {
          return part;
        }
      }
    }

    return null;
  }

  private determineChangeType(filePath: string): 'config' | 'code' | 'manifest' | 'dependency' {
    const ext = path.extname(filePath);
    const basename = path.basename(filePath);

    if (basename === 'plugin.json') {
      return 'manifest';
    }

    if (basename.includes('config') || basename.includes('settings')) {
      return 'config';
    }

    if (ext === '.json' && basename.includes('package')) {
      return 'dependency';
    }

    return 'code';
  }

  private requiresReload(filePath: string, changeType: string): boolean {
    const ext = path.extname(filePath);
    const basename = path.basename(filePath);

    // Always reload for manifest changes
    if (changeType === 'manifest') {
      return true;
    }

    // Reload for code changes
    if (changeType === 'code' && ['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
      return true;
    }

    // Conditional reload for config changes
    if (changeType === 'config') {
      return this.config.autoReload; // Only reload config if auto-reload is enabled
    }

    // Reload for dependency changes
    if (changeType === 'dependency') {
      return true;
    }

    return false;
  }

  private async capturePluginState(plugin: IPlugin): Promise<any> {
    return {
      name: plugin.name,
      version: plugin.version,
      status: plugin.status,
      manifest: JSON.parse(JSON.stringify(plugin.manifest)),
      workingDirectory: plugin.workingDirectory,
      lastError: plugin.lastError?.message,
      timestamp: Date.now()
    };
  }

  private async reloadPluginFromDisk(plugin: IPlugin): Promise<IPlugin> {
    // This would use the PluginLoader to reload the plugin
    // For now, this is a placeholder that would need to be implemented
    throw new Error('Plugin reload from disk not implemented');
  }

  private async validatePlugin(plugin: IPlugin): Promise<void> {
    // Basic validation - can be extended
    if (!plugin.name || !plugin.version) {
      throw new Error('Plugin missing required fields: name or version');
    }

    if (!plugin.manifest) {
      throw new Error('Plugin missing manifest');
    }
  }

  private async rollbackPlugin(pluginName: string): Promise<void> {
    const previousState = this.pluginStates.get(pluginName);
    if (!previousState) {
      throw new Error(`No previous state found for plugin: ${pluginName}`);
    }

    this.logger.info(`Rolling back plugin: ${pluginName}`);

    // Implementation would restore plugin from previous state
    // This is a placeholder for now
    throw new Error('Plugin rollback not implemented');
  }

  private setupEventListeners(): void {
    // Forward events to event bus
    this.on('plugin-reloaded', (result) => {
      this.eventBus.emit('plugin-hot-reloaded', result);
    });

    this.on('plugin-reload-failed', (result) => {
      this.eventBus.emit('plugin-hot-reload-failed', result);
    });

    this.on('reload-confirmation-required', (data) => {
      this.eventBus.emit('plugin-reload-confirmation-required', data);
    });

    this.on('reload-skipped', (data) => {
      this.eventBus.emit('plugin-reload-skipped', data);
    });
  }

  private debouncedReload: (pluginName: string, event: ReloadEvent) => void;
}
