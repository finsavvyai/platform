import * as vm from 'vm';
import * as crypto from 'crypto';
import {
  IPluginSandbox,
  ILogger,
  SandboxSecurityPolicy,
  SandboxResourceLimits
} from './interfaces';

/**
 * Enhanced Plugin Sandbox Implementation
 * Provides secure isolation with comprehensive security policies and resource limits
 */
export class EnhancedPluginSandbox implements IPluginSandbox {
  private readonly logger: ILogger;
  private readonly pluginName: string;
  private readonly permissions: string[];
  private readonly securityPolicy: SandboxSecurityPolicy;
  private readonly resourceLimits: SandboxResourceLimits;
  private readonly context: vm.Context;
  private readonly resources = new Map<string, any>();
  private readonly startTime: number;
  private executionCount = 0;
  private memoryUsage = 0;
  private isDestroyed = false;

  constructor(
    logger: ILogger,
    pluginName: string,
    permissions: string[],
    securityPolicy?: Partial<SandboxSecurityPolicy>,
    resourceLimits?: Partial<SandboxResourceLimits>
  ) {
    this.logger = logger.child({ plugin: pluginName, component: 'Sandbox' });
    this.pluginName = pluginName;
    this.permissions = permissions;
    this.startTime = Date.now();

    // Default security policy
    this.securityPolicy = {
      allowFileSystem: false,
      allowedFileSystemPaths: [],
      allowNetworkAccess: false,
      allowedNetworkHosts: [],
      allowChildProcesses: false,
      allowedCommands: [],
      allowEval: false,
      allowFunctionConstructor: false,
      allowTimers: false,
      maxExecutionTime: 30000,
      maxMemoryUsage: 50 * 1024 * 1024, // 50MB
      ...securityPolicy
    };

    // Default resource limits
    this.resourceLimits = {
      maxExecutionTime: 30000,
      maxMemoryUsage: 50 * 1024 * 1024, // 50MB
      maxCpuTime: 10000,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxNetworkRequests: 100,
      maxFileDescriptors: 10,
      ...resourceLimits
    };

    // Create sandbox context
    this.context = this.createSandboxContext();
  }

  async execute<T>(code: string, context: any = {}): Promise<T> {
    this.ensureNotDestroyed();

    const executionId = crypto.randomUUID();
    this.logger.debug(`Executing code in sandbox [${executionId}] for plugin: ${this.pluginName}`);

    try {
      // Check execution limits
      await this.checkExecutionLimits();

      // Create execution context
      const executionContext = this.createExecutionContext(context);

      // Apply security transforms
      const secureCode = this.applySecurityTransforms(code);

      // Set up execution timeout
      const timeoutPromise = this.createExecutionTimeout();

      // Execute code in sandbox
      const executionPromise = this.runInSandbox(secureCode, executionContext);

      const result = await Promise.race([
        executionPromise,
        timeoutPromise
      ]);

      this.executionCount++;
      this.logger.debug(`Code executed successfully [${executionId}] for plugin: ${this.pluginName}`);

      return result as T;

    } catch (error) {
      this.logger.error(`Sandbox execution failed [${executionId}] for plugin ${this.pluginName}: ${error}`);
      this.logSecurityEvent('execution_error', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async evaluate<T>(expression: string, context: any = {}): Promise<T> {
    this.ensureNotDestroyed();

    this.logger.debug(`Evaluating expression in sandbox for plugin: ${this.pluginName}`);

    try {
      // Check if evaluation is allowed
      if (!this.securityPolicy.allowEval) {
        throw new Error('Expression evaluation is not allowed by security policy');
      }

      // Check execution limits
      await this.checkExecutionLimits();

      // Wrap expression in return statement
      const code = `return (${expression})`;

      // Create execution context
      const executionContext = this.createExecutionContext(context);

      // Apply security transforms
      const secureCode = this.applySecurityTransforms(code);

      // Set up execution timeout
      const timeoutPromise = this.createExecutionTimeout(5000); // Shorter timeout for evaluation

      // Execute expression in sandbox
      const executionPromise = this.runInSandbox(secureCode, executionContext);

      const result = await Promise.race([
        executionPromise,
        timeoutPromise
      ]);

      this.executionCount++;
      this.logger.debug(`Expression evaluated successfully for plugin: ${this.pluginName}`);

      return result as T;

    } catch (error) {
      this.logger.error(`Sandbox evaluation failed for plugin ${this.pluginName}: ${error}`);
      this.logSecurityEvent('evaluation_error', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async addResource(name: string, resource: any): Promise<void> {
    this.ensureNotDestroyed();

    this.logger.debug(`Adding resource to sandbox for plugin ${this.pluginName}: ${name}`);

    if (!this.hasPermission(`resource:${name}`)) {
      throw new Error(`Permission denied for resource: ${name}`);
    }

    // Validate resource
    this.validateResource(name, resource);

    this.resources.set(name, resource);
    this.context[name] = resource;
  }

  async removeResource(name: string): Promise<void> {
    this.ensureNotDestroyed();

    this.logger.debug(`Removing resource from sandbox for plugin ${this.pluginName}: ${name}`);

    this.resources.delete(name);
    delete this.context[name];
  }

  async getResources(): Promise<string[]> {
    return Array.from(this.resources.keys());
  }

  async checkPermission(permission: string): Promise<boolean> {
    return this.hasPermission(permission);
  }

  async getStats(): Promise<any> {
    return {
      pluginName: this.pluginName,
      executionCount: this.executionCount,
      memoryUsage: this.memoryUsage,
      uptime: Date.now() - this.startTime,
      resourceCount: this.resources.size,
      permissions: this.permissions,
      securityPolicy: this.securityPolicy,
      resourceLimits: this.resourceLimits,
      isDestroyed: this.isDestroyed
    };
  }

  async destroy(): Promise<void> {
    if (this.isDestroyed) {
      return;
    }

    this.logger.info(`Destroying sandbox for plugin: ${this.pluginName}`);

    // Clear all resources
    this.resources.clear();

    // Clear context
    for (const key of Object.keys(this.context)) {
      delete this.context[key];
    }

    this.isDestroyed = true;
    this.logger.info(`Sandbox destroyed for plugin: ${this.pluginName}`);
  }

  private createSandboxContext(): vm.Context {
    const sandbox = vm.createContext({
      // Safe console
      console: {
        log: (...args: any[]) => this.logger.info(...args),
        warn: (...args: any[]) => this.logger.warn(...args),
        error: (...args: any[]) => this.logger.error(...args),
        debug: (...args: any[]) => this.logger.debug(...args)
      },

      // Safe timers (if allowed)
      setTimeout: this.securityPolicy.allowTimers ?
        (fn: Function, delay: number) => setTimeout(fn, Math.min(delay, 60000)) :
        undefined,
      clearTimeout: this.securityPolicy.allowTimers ? clearTimeout : undefined,
      setInterval: this.securityPolicy.allowTimers ?
        (fn: Function, interval: number) => setInterval(fn, Math.max(interval, 1000)) :
        undefined,
      clearInterval: this.securityPolicy.allowTimers ? clearInterval : undefined,

      // Safe process (limited)
      process: {
        env: {},
        version: process.version,
        platform: process.platform,
        arch: process.arch
      },

      // Crypto (safe)
      crypto: {
        randomUUID: crypto.randomUUID,
        randomBytes: crypto.randomBytes,
        createHash: crypto.createHash,
        createHmac: crypto.createHmac
      },

      // Buffer (safe)
      Buffer: {
        from: Buffer.from,
        alloc: Buffer.alloc,
        allocUnsafe: Buffer.allocUnsafe
      },

      // Global objects (safe)
      Object,
      Array,
      String,
      Number,
      Boolean,
      Date,
      RegExp,
      Math,
      JSON,

      // Sandbox control
      __sandbox: {
        getResource: (name: string) => this.resources.get(name),
        hasPermission: (permission: string) => this.hasPermission(permission),
        logSecurityEvent: (event: string, data?: any) => this.logSecurityEvent(event, data),
        getStats: () => this.getStats()
      }
    });

    return sandbox;
  }

  private createExecutionContext(customContext: any): vm.Context {
    // Create a new context based on the sandbox
    const executionContext = vm.createContext(Object.assign({}, this.context, customContext));

    // Freeze the global object to prevent modifications
    Object.freeze(executionContext);

    return executionContext;
  }

  private applySecurityTransforms(code: string): string {
    let secureCode = code;

    // Remove dangerous constructs
    if (!this.securityPolicy.allowEval) {
      secureCode = secureCode.replace(/\beval\s*\(/g, '__disallowed_eval(');
    }

    if (!this.securityPolicy.allowFunctionConstructor) {
      secureCode = secureCode.replace(/\bFunction\s*\(/g, '__disallowed_Function(');
    }

    // Add security checks
    const securityChecks = `
      (function() {
        const __disallowed_eval = function() { throw new Error('eval() is not allowed in sandbox'); };
        const __disallowed_Function = function() { throw new Error('Function constructor is not allowed in sandbox'); };

        // Memory usage monitoring
        const checkMemory = function() {
          const usage = process.memoryUsage();
          if (usage.heapUsed > ${this.resourceLimits.maxMemoryUsage}) {
            throw new Error('Memory limit exceeded in sandbox');
          }
        };

        // Periodic memory checks
        const memoryInterval = setInterval(checkMemory, 1000);

        // Clean up on exit
        const originalPromise = global.Promise;
        global.Promise = function(executor) {
          return new originalPromise(function(resolve, reject) {
            try {
              return executor(resolve, reject);
            } finally {
              clearInterval(memoryInterval);
              global.Promise = originalPromise;
            }
          });
        };
      })();
    `;

    return securityChecks + '\n' + secureCode;
  }

  private async runInSandbox(code: string, context: vm.Context): Promise<any> {
    try {
      const script = new vm.Script(code, {
        timeout: this.securityPolicy.maxExecutionTime,
        displayErrors: true
      });

      const result = script.runInContext(context, {
        timeout: this.securityPolicy.maxExecutionTime,
        displayErrors: true
      });

      // Update memory usage
      const memoryUsage = process.memoryUsage();
      this.memoryUsage = memoryUsage.heapUsed;

      return result;

    } catch (error) {
      // Check if it's a timeout error
      if (error instanceof Error && error.message.includes('script execution timeout')) {
        throw new Error(`Sandbox execution timeout after ${this.securityPolicy.maxExecutionTime}ms`);
      }

      throw error;
    }
  }

  private createExecutionTimeout(timeout?: number): Promise<any> {
    const execTimeout = timeout || this.securityPolicy.maxExecutionTime;

    return new Promise((_, reject) =>
      setTimeout(() => {
        reject(new Error(`Sandbox execution timeout after ${execTimeout}ms`));
        this.logSecurityEvent('execution_timeout', { timeout: execTimeout });
      }, execTimeout)
    );
  }

  private async checkExecutionLimits(): Promise<void> {
    // Check memory usage
    const currentMemory = process.memoryUsage().heapUsed;
    if (currentMemory > this.resourceLimits.maxMemoryUsage) {
      throw new Error(`Memory limit exceeded: ${currentMemory} > ${this.resourceLimits.maxMemoryUsage}`);
    }

    // Check execution count (optional limit)
    if (this.executionCount > 1000) {
      throw new Error('Execution count limit exceeded');
    }

    // Check uptime
    const uptime = Date.now() - this.startTime;
    if (uptime > 300000) { // 5 minutes
      throw new Error('Sandbox uptime limit exceeded');
    }
  }

  private validateResource(name: string, resource: any): void {
    // Check resource type safety
    if (typeof resource === 'function') {
      throw new Error('Functions cannot be added as sandbox resources');
    }

    // Check resource size (if it's an object)
    if (typeof resource === 'object' && resource !== null) {
      const size = JSON.stringify(resource).length;
      if (size > 1024 * 1024) { // 1MB
        throw new Error('Resource size exceeds limit');
      }
    }

    // Check if resource name is allowed
    const restrictedNames = ['__proto__', 'constructor', 'prototype', 'eval', 'Function'];
    if (restrictedNames.includes(name)) {
      throw new Error(`Resource name "${name}" is not allowed`);
    }
  }

  private hasPermission(permission: string): boolean {
    return this.permissions.includes('*') || this.permissions.includes(permission);
  }

  private logSecurityEvent(event: string, data?: any): void {
    this.logger.warn(`Security event [${event}] for plugin ${this.pluginName}`, {
      event,
      pluginName: this.pluginName,
      timestamp: Date.now(),
      data
    });

    // Emit security event to parent
    process.emit('plugin-security-event', {
      pluginName: this.pluginName,
      event,
      data,
      timestamp: Date.now()
    });
  }

  private ensureNotDestroyed(): void {
    if (this.isDestroyed) {
      throw new Error('Sandbox has been destroyed');
    }
  }
}

/**
 * Sandbox Factory
 * Creates sandboxes with appropriate security levels
 */
export class SandboxFactory {
  private readonly logger: ILogger;

  constructor(logger: ILogger) {
    this.logger = logger.child({ component: 'SandboxFactory' });
  }

  createSandbox(
    pluginName: string,
    permissions: string[],
    securityLevel: 'low' | 'medium' | 'high' = 'medium'
  ): IPluginSandbox {
    const securityPolicy = this.getSecurityPolicy(securityLevel);
    const resourceLimits = this.getResourceLimits(securityLevel);

    this.logger.debug(`Creating sandbox for plugin ${pluginName} with security level: ${securityLevel}`);

    return new EnhancedPluginSandbox(
      this.logger,
      pluginName,
      permissions,
      securityPolicy,
      resourceLimits
    );
  }

  private getSecurityPolicy(level: string): SandboxSecurityPolicy {
    switch (level) {
      case 'low':
        return {
          allowFileSystem: true,
          allowedFileSystemPaths: ['/tmp'],
          allowNetworkAccess: true,
          allowedNetworkHosts: ['localhost', '127.0.0.1'],
          allowChildProcesses: false,
          allowedCommands: [],
          allowEval: true,
          allowFunctionConstructor: true,
          allowTimers: true,
          maxExecutionTime: 60000,
          maxMemoryUsage: 100 * 1024 * 1024 // 100MB
        };

      case 'medium':
        return {
          allowFileSystem: false,
          allowedFileSystemPaths: [],
          allowNetworkAccess: false,
          allowedNetworkHosts: [],
          allowChildProcesses: false,
          allowedCommands: [],
          allowEval: false,
          allowFunctionConstructor: false,
          allowTimers: true,
          maxExecutionTime: 30000,
          maxMemoryUsage: 50 * 1024 * 1024 // 50MB
        };

      case 'high':
        return {
          allowFileSystem: false,
          allowedFileSystemPaths: [],
          allowNetworkAccess: false,
          allowedNetworkHosts: [],
          allowChildProcesses: false,
          allowedCommands: [],
          allowEval: false,
          allowFunctionConstructor: false,
          allowTimers: false,
          maxExecutionTime: 10000,
          maxMemoryUsage: 25 * 1024 * 1024 // 25MB
        };

      default:
        return this.getSecurityPolicy('medium');
    }
  }

  private getResourceLimits(level: string): SandboxResourceLimits {
    switch (level) {
      case 'low':
        return {
          maxExecutionTime: 60000,
          maxMemoryUsage: 100 * 1024 * 1024, // 100MB
          maxCpuTime: 30000,
          maxFileSize: 50 * 1024 * 1024, // 50MB
          maxNetworkRequests: 1000,
          maxFileDescriptors: 50
        };

      case 'medium':
        return {
          maxExecutionTime: 30000,
          maxMemoryUsage: 50 * 1024 * 1024, // 50MB
          maxCpuTime: 15000,
          maxFileSize: 10 * 1024 * 1024, // 10MB
          maxNetworkRequests: 100,
          maxFileDescriptors: 10
        };

      case 'high':
        return {
          maxExecutionTime: 10000,
          maxMemoryUsage: 25 * 1024 * 1024, // 25MB
          maxCpuTime: 5000,
          maxFileSize: 5 * 1024 * 1024, // 5MB
          maxNetworkRequests: 10,
          maxFileDescriptors: 5
        };

      default:
        return this.getResourceLimits('medium');
    }
  }
}
