/**
 * Plugin System Interfaces for Claude Agent Platform
 *
 * Defines the contract for plugins, plugin management, and integration.
 * Supports hot-reloading, sandboxing, and compatibility checking.
 */

import { EventEmitter } from 'events';
import { Agent } from '../interfaces';

// ============================================================================
// Core Plugin Interfaces
// ============================================================================

export interface IPlugin {
  /**
   * Unique plugin identifier
   */
  readonly id: string;

  /**
   * Human-readable plugin name
   */
  readonly name: string;

  /**
   * Plugin version
   */
  readonly version: string;

  /**
   * Plugin description
   */
  readonly description: string;

  /**
   * Plugin author information
   */
  readonly author: PluginAuthor;

  /**
   * Plugin dependencies
   */
  readonly dependencies: PluginDependency[];

  /**
   * Plugin capabilities and features
   */
  readonly capabilities: PluginCapability[];

  /**
   * Plugin compatibility requirements
   */
  readonly compatibility: PluginCompatibility;

  /**
   * Plugin configuration schema
   */
  readonly configSchema: PluginConfigSchema;

  /**
   * Initialize the plugin
   */
  initialize(context: PluginContext): Promise<void>;

  /**
   * Execute plugin functionality
   */
  execute(request: PluginExecutionRequest): Promise<PluginExecutionResult>;

  /**
   * Cleanup plugin resources
   */
  cleanup(): Promise<void>;

  /**
   * Get plugin health status
   */
  getHealth(): Promise<PluginHealth>;

  /**
   * Get plugin metrics
   */
  getMetrics(): Promise<PluginMetrics>;
}

export interface PluginAuthor {
  name: string;
  email?: string;
  url?: string;
  organization?: string;
}

export interface PluginDependency {
  name: string;
  version: string;
  type: 'plugin' | 'package' | 'service' | 'system';
  optional: boolean;
  reason?: string;
}

export interface PluginCapability {
  name: string;
  description: string;
  inputs: PluginDataType[];
  outputs: PluginDataType[];
  parameters: PluginParameter[];
  examples: PluginExample[];
}

export interface PluginDataType {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'file' | 'stream';
  format?: string;
  description?: string;
  required?: boolean;
}

export interface PluginParameter {
  name: string;
  type: PluginDataType;
  description: string;
  required: boolean;
  default?: any;
  validation?: ValidationRule[];
}

export interface PluginExample {
  name: string;
  description: string;
  input: any;
  expectedOutput: any;
  parameters?: Record<string, any>;
}

export interface PluginCompatibility {
  platformVersion: string;
  nodeVersion: string;
  operatingSystems: string[];
  architectures: string[];
  requiredPermissions: string[];
  optionalPermissions: string[];
}

export interface PluginConfigSchema {
  type: 'object';
  properties: Record<string, PluginConfigProperty>;
  required: string[];
  additionalProperties?: boolean;
}

export interface PluginConfigProperty {
  type: string;
  description: string;
  default?: any;
  enum?: any[];
  minimum?: number;
  maximum?: number;
  pattern?: string;
  format?: string;
}

// ============================================================================
// Plugin Context and Request/Response
// ============================================================================

export interface PluginContext {
  /**
   * Agent instance the plugin is running for
   */
  agent: Agent;

  /**
   * Plugin working directory
   */
  workingDirectory: string;

  /**
   * Plugin data directory for persistent storage
   */
  dataDirectory: string;

  /**
   * Plugin configuration
   */
  config: Record<string, any>;

  /**
   * Plugin permissions
   */
  permissions: PluginPermissions;

  /**
   * Logger instance
   */
  logger: PluginLogger;

  /**
   * Event emitter for plugin communication
   */
  events: EventEmitter;

  /**
   * Sandbox manager
   */
  sandbox: PluginSandbox;

  /**
   * Registry access
   */
  registry: IPluginRegistry;

  /**
   * Plugin metadata
   */
  metadata: Record<string, any>;
}

export interface PluginExecutionRequest {
  id: string;
  method: string;
  parameters: Record<string, any>;
  input?: any;
  context?: Record<string, any>;
  timeout?: number;
  userId?: string;
  sessionId?: string;
}

export interface PluginExecutionResult {
  success: boolean;
  output?: any;
  error?: PluginError;
  metrics?: PluginExecutionMetrics;
  metadata?: Record<string, any>;
  duration?: number;
}

export interface PluginError {
  code: string;
  message: string;
  stack?: string;
  details?: Record<string, any>;
  recoverable: boolean;
}

export interface PluginExecutionMetrics {
  executionTime: number;
  memoryUsage: number;
  cpuTime: number;
  ioOperations: number;
  networkRequests: number;
  tokensUsed?: number;
  cacheHits?: number;
  cacheMisses?: number;
}

export interface PluginHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastCheck: Date;
  uptime: number;
  errorCount: number;
  lastError?: PluginError;
  checks: PluginHealthCheck[];
}

export interface PluginHealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  message: string;
  duration?: number;
  timestamp: Date;
  details?: Record<string, any>;
}

export interface PluginMetrics {
  executions: {
    total: number;
    successful: number;
    failed: number;
    averageDuration: number;
  };
  performance: {
    averageExecutionTime: number;
    averageMemoryUsage: number;
    averageCpuTime: number;
  };
  resources: {
    memoryUsage: number;
    diskUsage: number;
    networkRequests: number;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
    recent: PluginError[];
  };
  uptime: number;
  lastExecution: Date;
}

// ============================================================================
// Plugin Management Interfaces
// ============================================================================

export interface IPluginRegistry {
  /**
   * Register a plugin
   */
  register(plugin: IPlugin, config?: PluginConfig): Promise<void>;

  /**
   * Unregister a plugin
   */
  unregister(pluginId: string): Promise<void>;

  /**
   * Get a plugin by ID
   */
  getPlugin(pluginId: string): Promise<IPlugin | null>;

  /**
   * Get all registered plugins
   */
  getPlugins(filter?: PluginFilter): Promise<IPlugin[]>;

  /**
   * Get plugins by capability
   */
  getPluginsByCapability(capability: string): Promise<IPlugin[]>;

  /**
   * Enable/disable a plugin
   */
  setPluginStatus(pluginId: string, enabled: boolean): Promise<void>;

  /**
   * Update plugin configuration
   */
  updatePluginConfig(pluginId: string, config: Partial<PluginConfig>): Promise<void>;

  /**
   * Get plugin status
   */
  getPluginStatus(pluginId: string): Promise<PluginStatus>;

  /**
   * Discover plugins in a directory
   */
  discoverPlugins(directory: string): Promise<DiscoveredPlugin[]>;

  /**
   * Validate plugin compatibility
   */
  validateCompatibility(plugin: IPlugin): Promise<PluginCompatibilityReport>;
}

export interface PluginFilter {
  enabled?: boolean;
  status?: PluginStatus;
  author?: string;
  capability?: string;
  tag?: string;
}

export interface PluginStatus {
  id: string;
  status: 'registered' | 'initialized' | 'running' | 'stopped' | 'error' | 'disabled';
  enabled: boolean;
  lastActivity: Date;
  version: string;
}

export interface PluginConfig {
  enabled: boolean;
  autoStart: boolean;
  config?: Record<string, any>;
  permissions?: PluginPermissions;
  sandbox?: PluginSandboxConfig;
  healthCheck?: PluginHealthCheckConfig;
  logging?: PluginLoggingConfig;
  metrics?: PluginMetricsConfig;
}

export interface PluginPermissions {
  fileSystem: PluginFileSystemPermissions;
  network: PluginNetworkPermissions;
  system: PluginSystemPermissions;
  custom: Record<string, boolean>;
}

export interface PluginFileSystemPermissions {
  read: boolean;
  write: boolean;
  execute: boolean;
  directories: string[];
  files: string[];
  patterns: string[];
}

export interface PluginNetworkPermissions {
  outgoing: boolean;
  incoming: boolean;
  domains: string[];
  protocols: string[];
  ports: number[];
}

export interface PluginSystemPermissions {
  environment: boolean;
  childProcesses: boolean;
  systemInfo: boolean;
  custom: Record<string, boolean>;
}

export interface PluginSandboxConfig {
  enabled: boolean;
  isolateFileSystem: boolean;
  isolateNetwork: boolean;
  limitMemory: boolean;
  limitCpu: boolean;
  allowedCommands: string[];
  blockedCommands: string[];
  timeoutMs?: number;
}

export interface PluginHealthCheckConfig {
  enabled: boolean;
  interval: number;
  timeout: number;
  endpoint?: string;
  method?: string;
  expectedStatus?: number;
  customChecks?: PluginCustomHealthCheck[];
}

export interface PluginCustomHealthCheck {
  name: string;
  script: string;
  timeout: number;
  expectedOutput?: any;
}

export interface PluginLoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text';
  file?: string;
  console: boolean;
}

export interface PluginMetricsConfig {
  enabled: boolean;
  interval: number;
  retention: number;
  customMetrics?: PluginCustomMetric[];
}

export interface PluginCustomMetric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
  description: string;
  labels?: Record<string, string>;
}

export interface DiscoveredPlugin {
  path: string;
  manifest: PluginManifest;
  metadata: PluginMetadata;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  main: string;
  author: PluginAuthor;
  dependencies: PluginDependency[];
  capabilities: PluginCapability[];
  compatibility: PluginCompatibility;
  configSchema: PluginConfigSchema;
  keywords: string[];
  homepage?: string;
  repository?: string;
  bugs?: string;
  license: string;
}

export interface PluginMetadata {
  fileSize: number;
  fileHash: string;
  lastModified: Date;
  discoveredAt: Date;
  validatedAt?: Date;
}

export interface PluginCompatibilityReport {
  compatible: boolean;
  platformVersion: {
    compatible: boolean;
    required: string;
    current: string;
  };
  nodeVersion: {
    compatible: boolean;
    required: string;
    current: string;
  };
  operatingSystem: {
    compatible: boolean;
    required: string[];
    current: string;
  };
  architecture: {
    compatible: boolean;
    required: string[];
    current: string;
  };
  permissions: {
    missing: string[];
    optional: string[];
    granted: string[];
  };
  dependencies: {
    missing: PluginDependency[];
    satisfied: PluginDependency[];
    versionConflicts: PluginDependency[];
  };
  warnings: string[];
  errors: string[];
}

export interface PluginLogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  child(context: string): PluginLogger;
}

// ============================================================================
// Plugin Sandbox Interfaces
// ============================================================================

export interface PluginSandbox {
  /**
   * Execute code in sandbox
   */
  execute(code: string, context: any): Promise<any>;

  /**
   * Execute command in sandbox
   */
  executeCommand(command: string, args: string[], options: any): Promise<any>;

  /**
   * Check if operation is allowed
   */
  isAllowed(operation: SandboxOperation): boolean;

  /**
   * Get sandbox metrics
   */
  getMetrics(): Promise<SandboxMetrics>;

  /**
   * Cleanup sandbox
   */
  cleanup(): Promise<void>;
}

export interface SandboxOperation {
  type: 'file' | 'network' | 'system' | 'process' | 'custom';
  action: string;
  target?: string;
  details?: Record<string, any>;
}

export interface SandboxMetrics {
  executions: number;
  averageExecutionTime: number;
  memoryUsage: number;
  operationsBlocked: number;
  lastActivity: Date;
}

export interface ValidationRule {
  type: 'required' | 'pattern' | 'range' | 'custom';
  message?: string;
  rule: any;
}

// ============================================================================
// Plugin Events
// ============================================================================

export interface PluginEvents {
  // Registry events
  'plugin:registered': { plugin: IPlugin };
  'plugin:unregistered': { pluginId: string };
  'plugin:discovered': { plugins: DiscoveredPlugin[] };
  'plugin:validated': { plugin: IPlugin; report: PluginCompatibilityReport };

  // Lifecycle events
  'plugin:initialized': { plugin: IPlugin };
  'plugin:started': { plugin: IPlugin };
  'plugin:stopped': { plugin: IPlugin };
  'plugin:error': { plugin: IPlugin; error: PluginError };
  'plugin:cleanup': { plugin: IPlugin };

  // Execution events
  'plugin:execution:start': { plugin: IPlugin; request: PluginExecutionRequest };
  'plugin:execution:complete': { plugin: IPlugin; request: PluginExecutionRequest; result: PluginExecutionResult };
  'plugin:execution:error': { plugin: IPlugin; request: PluginExecutionRequest; error: PluginError };

  // Health events
  'plugin:health:changed': { plugin: IPlugin; health: PluginHealth };
  'plugin:health:warning': { plugin: IPlugin; check: PluginHealthCheck };
  'plugin:health:error': { plugin: IPlugin; check: PluginHealthCheck };

  // Configuration events
  'plugin:config:updated': { plugin: IPlugin; config: Partial<PluginConfig> };
  'plugin:status:changed': { plugin: IPlugin; status: PluginStatus };

  // Metrics events
  'plugin:metrics:updated': { plugin: IPlugin; metrics: PluginMetrics };
}

// ============================================================================
// Plugin Factory and Loader
// ============================================================================

export interface IPluginFactory {
  /**
   * Create a plugin instance from manifest
   */
  createPlugin(manifest: PluginManifest, pluginPath: string): Promise<IPlugin>;

  /**
   * Load plugin from file
   */
  loadPlugin(pluginPath: string): Promise<IPlugin>;

  /**
   * Validate plugin manifest
   */
  validateManifest(manifest: PluginManifest): Promise<PluginValidationResult>;
}

export interface PluginValidationResult {
  valid: boolean;
  errors: PluginValidationError[];
  warnings: PluginValidationWarning[];
}

export interface PluginValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface PluginValidationWarning {
  field: string;
  message: string;
  code: string;
  value?: any;
}

// ============================================================================
// Plugin Hot Reloading
// ============================================================================

export interface IPluginReloader {
  /**
   * Enable hot reloading for a plugin
   */
  enableHotReload(pluginId: string, options?: PluginReloadOptions): Promise<void>;

  /**
   * Disable hot reloading for a plugin
   */
  disableHotReload(pluginId: string): Promise<void>;

  /**
   * Reload a plugin
   */
  reloadPlugin(pluginId: string): Promise<PluginReloadResult>;

  /**
   * Get reload status
   */
  getReloadStatus(pluginId: string): Promise<PluginReloadStatus>;

  /**
   * Watch for plugin changes
   */
  watchPlugins(directory: string): Promise<void>;

  /**
   * Stop watching
   */
  stopWatching(): Promise<void>;
}

export interface PluginReloadOptions {
  preserveState?: boolean;
  timeoutMs?: number;
  force?: boolean;
}

export interface PluginReloadResult {
  success: boolean;
  pluginId: string;
  oldVersion?: string;
  newVersion?: string;
  error?: string;
  duration?: number;
  statePreserved?: boolean;
}

export interface PluginReloadStatus {
  enabled: boolean;
  lastReload?: Date;
  lastReloadResult?: PluginReloadResult;
  watching: boolean;
  watchedFiles: string[];
  pendingReloads: string[];
}

// ============================================================================
// Type Exports
// ============================================================================

export type PluginType = 'agent' | 'service' | 'utility' | 'integration' | 'custom';
export type PluginState = 'unloaded' | 'loaded' | 'initialized' | 'running' | 'stopped' | 'error';
export type PluginEventType = keyof PluginEvents;
