import * as path from 'path';
import * as vm from 'vm';
import { createSandbox } from 'vm-sandbox';
import {
  IPlugin,
  IPluginManifest,
  PluginContext,
  PluginStatus,
  IPluginSandbox,
  ILogger,
  IEventBus,
  IStorage,
  ISecrets
} from './interfaces';

/**
 * Plugin Loader Implementation
 * Handles loading plugins from various sources with sandboxing
 */
export class PluginLoader {
  private readonly logger: ILogger;
  private readonly eventBus: IEventBus;
  private readonly storage: IStorage;
  private readonly secrets: ISecrets;

  constructor(
    logger: ILogger,
    eventBus: IEventBus,
    storage: IStorage,
    secrets: ISecrets
  ) {
    this.logger = logger;
    this.eventBus = eventBus;
    this.storage = storage;
    this.secrets = secrets;
  }

  async loadPlugin(manifest: IPluginManifest, workingDirectory: string): Promise<IPlugin> {
    this.logger.info(`Loading plugin: ${manifest.name}@${manifest.version}`);

    // Create plugin object
    const plugin: IPlugin = {
      name: manifest.name,
      version: manifest.version,
      manifest,
      workingDirectory,
      status: PluginStatus.REGISTERED,
      storage: this.storage,
      secrets: this.secrets,
      async initialize(context: PluginContext): Promise<void> {
        // Plugin initialization will be handled by the loaded module
      },
      async start(): Promise<void> {
        // Plugin start will be handled by the loaded module
      },
      async stop(): Promise<void> {
        // Plugin stop will be handled by the loaded module
      },
      async execute(request): Promise<any> {
        // Plugin execution will be handled by the loaded module
      }
    };

    // Load plugin code
    const entryPointPath = path.join(workingDirectory, manifest.entryPoint);

    try {
      // Determine file type and load accordingly
      if (entryPointPath.endsWith('.ts')) {
        await this.loadTypeScriptPlugin(plugin, entryPointPath);
      } else if (entryPointPath.endsWith('.js')) {
        await this.loadJavaScriptPlugin(plugin, entryPointPath);
      } else {
        throw new Error(`Unsupported plugin file type: ${entryPointPath}`);
      }

      this.logger.info(`Plugin loaded successfully: ${manifest.name}@${manifest.version}`);
      return plugin;

    } catch (error) {
      plugin.status = PluginStatus.ERROR;
      plugin.lastError = error instanceof Error ? error : new Error(String(error));

      this.logger.error(`Failed to load plugin ${manifest.name}: ${error}`);
      throw error;
    }
  }

  private async loadJavaScriptPlugin(plugin: IPlugin, entryPointPath: string): Promise<void> {
    const sourceCode = await import('fs').then(fs => fs.promises.readFile(entryPointPath, 'utf-8'));

    // Create sandbox context
    const sandbox = await this.createSandbox(plugin);

    // Load and execute plugin code
    try {
      const exports = vm.runInContext(sourceCode, sandbox, {
        filename: entryPointPath,
        timeout: 5000, // 5 second timeout for loading
        displayErrors: true
      });

      // Validate plugin exports
      this.validatePluginExports(exports, plugin.manifest);

      // Bind plugin methods
      this.bindPluginMethods(plugin, exports, sandbox);

    } catch (error) {
      this.logger.error(`Failed to load JavaScript plugin ${plugin.name}: ${error}`);
      throw error;
    }
  }

  private async loadTypeScriptPlugin(plugin: IPlugin, entryPointPath: string): Promise<void> {
    // Transpile TypeScript to JavaScript first
    const transpiledCode = await this.transpileTypeScript(entryPointPath);

    // Create sandbox context
    const sandbox = await this.createSandbox(plugin);

    // Load and execute transpiled code
    try {
      const exports = vm.runInContext(transpiledCode, sandbox, {
        filename: entryPointPath.replace('.ts', '.js'),
        timeout: 5000,
        displayErrors: true
      });

      // Validate plugin exports
      this.validatePluginExports(exports, plugin.manifest);

      // Bind plugin methods
      this.bindPluginMethods(plugin, exports, sandbox);

    } catch (error) {
      this.logger.error(`Failed to load TypeScript plugin ${plugin.name}: ${error}`);
      throw error;
    }
  }

  private async createSandbox(plugin: IPlugin): Promise<any> {
    const sandbox = createSandbox();

    // Add common globals
    sandbox.console = this.logger.child({ plugin: plugin.name });
    sandbox.require = (module: string) => {
      // Provide controlled access to required modules
      return this.safeRequire(module, plugin);
    };

    // Add context that will be passed to plugin
    sandbox.__pluginContext = {
      plugin,
      logger: this.logger.child({ plugin: plugin.name }),
      eventBus: this.eventBus,
      storage: plugin.storage,
      secrets: plugin.secrets
    };

    return sandbox;
  }

  private safeRequire(module: string, plugin: IPlugin): any {
    // Whitelist of allowed modules
    const allowedModules = [
      'crypto',
      'events',
      'util',
      'path',
      'os',
      'querystring',
      'url',
      'string_decoder',
      'stream',
      'zlib',
      'buffer',
      'assert',
      'constants',
      'timers',
      'process'
    ];

    // Check if module is allowed
    const [moduleName, ...subModule] = module.split('/');

    if (!allowedModules.includes(moduleName)) {
      throw new Error(`Module ${module} is not allowed for plugins`);
    }

    // Check if module is in plugin permissions
    const modulePermission = `module:${module}`;
    if (!plugin.manifest.permissions?.includes(modulePermission)) {
      throw new Error(`Module ${module} requires permission: ${modulePermission}`);
    }

    // Return module with submodules if needed
    if (subModule.length === 0) {
      return require(module);
    } else {
      const parentModule = require(moduleName);
      return subModule.reduce((obj, prop) => obj[prop], parentModule);
    }
  }

  private validatePluginExports(exports: any, manifest: IPluginManifest): void {
    // Check required exports based on manifest type
    if (manifest.type === 'task') {
      if (typeof exports.execute !== 'function') {
        throw new Error('Task plugin must export execute function');
      }
    } else if (manifest.type === 'event') {
      if (typeof exports.handleEvent !== 'function') {
        throw new Error('Event plugin must export handleEvent function');
      }
    } else if (manifest.type === 'tool') {
      if (typeof exports.createTool !== 'function') {
        throw new Error('Tool plugin must export createTool function');
      }
    }

    // Common required exports
    if (typeof exports.initialize !== 'function') {
      throw new Error('Plugin must export initialize function');
    }

    if (typeof exports.start !== 'function') {
      throw new Error('Plugin must export start function');
    }

    if (typeof exports.stop !== 'function') {
      throw new Error('Plugin must export stop function');
    }
  }

  private bindPluginMethods(plugin: IPlugin, exports: any, sandbox: any): void {
    // Bind plugin lifecycle methods
    plugin.initialize = async (context: PluginContext): Promise<void> => {
      try {
        await exports.initialize(context);
      } catch (error) {
        this.logger.error(`Failed to initialize plugin ${plugin.name}: ${error}`);
        throw error;
      }
    };

    plugin.start = async (): Promise<void> => {
      try {
        await exports.start();
      } catch (error) {
        this.logger.error(`Failed to start plugin ${plugin.name}: ${error}`);
        throw error;
      }
    };

    plugin.stop = async (): Promise<void> => {
      try {
        await exports.stop();
      } catch (error) {
        this.logger.error(`Failed to stop plugin ${plugin.name}: ${error}`);
        throw error;
      }
    };

    // Bind execute method if present
    if (typeof exports.execute === 'function') {
      plugin.execute = async (request: any): Promise<any> => {
        try {
          return await exports.execute(request);
        } catch (error) {
          this.logger.error(`Failed to execute plugin ${plugin.name}: ${error}`);
          throw error;
        }
      };
    }

    // Bind other methods based on plugin type
    if (typeof exports.handleEvent === 'function') {
      (plugin as any).handleEvent = async (event: any): Promise<void> => {
        try {
          await exports.handleEvent(event);
        } catch (error) {
          this.logger.error(`Failed to handle event in plugin ${plugin.name}: ${error}`);
          throw error;
        }
      };
    }

    if (typeof exports.createTool === 'function') {
      (plugin as any).createTool = async (): Promise<any> => {
        try {
          return await exports.createTool();
        } catch (error) {
          this.logger.error(`Failed to create tool in plugin ${plugin.name}: ${error}`);
          throw error;
        }
      };
    }
  }

  private async transpileTypeScript(entryPointPath: string): Promise<string> {
    try {
      const ts = await import('typescript');
      const sourceCode = await import('fs').then(fs => fs.promises.readFile(entryPointPath, 'utf-8'));

      const result = ts.transpileModule(sourceCode, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.CommonJS,
          strict: true,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true
        }
      });

      return result.outputText;

    } catch (error) {
      throw new Error(`TypeScript transpilation failed: ${error}`);
    }
  }
}

/**
 * Plugin Sandbox Implementation
 * Provides secure execution environment for plugins
 */
export class PluginSandbox implements IPluginSandbox {
  private readonly logger: ILogger;
  private readonly pluginName: string;
  private readonly permissions: string[];
  private readonly sandbox: any;
  private readonly resources = new Map<string, any>();

  constructor(logger: ILogger, pluginName: string, permissions: string[]) {
    this.logger = logger.child({ plugin: pluginName });
    this.pluginName = pluginName;
    this.permissions = permissions;
    this.sandbox = createSandbox();
  }

  async execute<T>(code: string, context: any = {}): Promise<T> {
    this.logger.debug(`Executing code in sandbox for plugin: ${this.pluginName}`);

    try {
      // Merge provided context with sandbox
      const executionContext = {
        ...this.sandbox,
        ...context
      };

      // Execute code in sandbox
      const result = vm.runInContext(code, executionContext, {
        timeout: 5000, // 5 second timeout
        displayErrors: true
      });

      return result as T;

    } catch (error) {
      this.logger.error(`Sandbox execution failed for plugin ${this.pluginName}: ${error}`);
      throw error;
    }
  }

  async evaluate<T>(expression: string, context: any = {}): Promise<T> {
    this.logger.debug(`Evaluating expression in sandbox for plugin: ${this.pluginName}`);

    try {
      // Wrap expression in return statement
      const code = `return (${expression})`;

      // Merge provided context with sandbox
      const executionContext = {
        ...this.sandbox,
        ...context
      };

      // Execute expression in sandbox
      const result = vm.runInContext(code, executionContext, {
        timeout: 1000, // 1 second timeout
        displayErrors: true
      });

      return result as T;

    } catch (error) {
      this.logger.error(`Sandbox evaluation failed for plugin ${this.pluginName}: ${error}`);
      throw error;
    }
  }

  async addResource(name: string, resource: any): Promise<void> {
    this.logger.debug(`Adding resource to sandbox for plugin ${this.pluginName}: ${name}`);

    if (!this.hasPermission(`resource:${name}`)) {
      throw new Error(`Permission denied for resource: ${name}`);
    }

    this.resources.set(name, resource);
    this.sandbox[name] = resource;
  }

  async removeResource(name: string): Promise<void> {
    this.logger.debug(`Removing resource from sandbox for plugin ${this.pluginName}: ${name}`);

    this.resources.delete(name);
    delete this.sandbox[name];
  }

  async getResources(): Promise<string[]> {
    return Array.from(this.resources.keys());
  }

  async checkPermission(permission: string): Promise<boolean> {
    return this.hasPermission(permission);
  }

  private hasPermission(permission: string): boolean {
    return this.permissions.includes('*') || this.permissions.includes(permission);
  }
}
