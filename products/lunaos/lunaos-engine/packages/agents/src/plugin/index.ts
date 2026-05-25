// Plugin System Main Entry Point

export * from './interfaces';
export * from './registry';
export * from './loader';

// Re-export commonly used types and classes
export type {
  IPlugin,
  IPluginRegistry,
  IPluginSandbox,
  IPluginDiscovery,
  IPluginMetadata,
  IPluginManifest,
  PluginContext,
  PluginExecutionRequest,
  PluginExecutionResult,
  PluginEvent,
  PluginCompatibilityResult
} from './interfaces';

export {
  PluginRegistry,
  PluginDiscovery,
  PluginLoader,
  PluginSandbox
} from './registry';
