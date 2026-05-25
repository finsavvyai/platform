/**
 * Plugin Sandbox - Secure execution with resource limits
 */

import { PluginInstallation, ExecutionContext, PluginResult, ValidationResult } from './types.js';

interface SandboxConfig {
  cpuTimeLimit: number;
  memoryLimit: number;
  networkTimeout: number;
}

const DANGEROUS_PATTERNS = [
  /require\s*\(/g,
  /import\s+.*from/g,
  /process\./g,
  /child_process/g,
  /fs\./g,
  /eval\s*\(/g,
  /Function\s*\(/g,
  /setTimeout.*Infinity/g,
];

const INTERNAL_IPS = [/^localhost$/, /^127\./, /^192\.168\./, /^10\./, /^172\.(1[6-9]|2[0-9]|3[01])\./, /^::1$/, /^fc00:/];

export class PluginSandbox {
  private config: SandboxConfig;
  private executing: Map<string, AbortController> = new Map();

  constructor(config?: Partial<SandboxConfig>) {
    this.config = { cpuTimeLimit: 5000, memoryLimit: 256, networkTimeout: 3000, ...config };
  }

  validatePluginCode(code: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(code)) errors.push(`Dangerous pattern: ${pattern.source}`);
    }

    // Validate with shared code-sandbox patterns
    const { validateCode } = require('../../lib/code-sandbox.js');
    const sandboxValidation = validateCode(code);
    if (!sandboxValidation.safe) {
      errors.push(...sandboxValidation.violations);
    }

    try {
      new Function(code);
    } catch (e) {
      errors.push(`Syntax error: ${e instanceof Error ? e.message : 'Invalid'}`);
    }

    if (/while\s*\(\s*true\s*\)/.test(code)) warnings.push('Infinite loop without break');
    if (/fetch\s*\(/.test(code) && !/catch\s*\(/.test(code)) warnings.push('Network request without error handling');

    return { valid: errors.length === 0, errors, warnings };
  }

  async executePlugin(installation: PluginInstallation, context: ExecutionContext): Promise<PluginResult> {
    const start = Date.now();
    const timeout = context.timeout || this.config.cpuTimeLimit;
    const abort = new AbortController();
    this.executing.set(installation.id, abort);

    try {
      const validation = this.validatePluginCode(installation.plugin.currentVersion.code || '');
      if (!validation.valid) {
        return { success: false, error: `Validation failed: ${validation.errors.join('; ')}`, executionTime: Date.now() - start };
      }

      const ctx = this.createContext(installation, context);
      const result = await Promise.race([
        this.executeWithContext(installation.plugin.currentVersion.code || '', ctx),
        new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), timeout)),
      ]);

      return { success: true, data: result, executionTime: Date.now() - start };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown';
      return { success: false, error: msg === 'timeout' ? `Timeout exceeded ${timeout}ms` : msg, executionTime: Date.now() - start };
    } finally {
      this.executing.delete(installation.id);
      abort.abort();
    }
  }

  private createContext(inst: PluginInstallation, ctx: ExecutionContext): Record<string, unknown> {
    return {
      projectId: ctx.projectId,
      userId: ctx.userId,
      qestroVersion: ctx.qestroVersion,
      environment: ctx.environment,
      pluginConfig: inst.config || {},
      console: {
        log: (...args: unknown[]) => console.log(`[${inst.plugin.name}]`, ...args),
        error: (...args: unknown[]) => console.error(`[${inst.plugin.name}]`, ...args),
        warn: (...args: unknown[]) => console.warn(`[${inst.plugin.name}]`, ...args),
      },
      fetch: (url: string, opts?: RequestInit) => this.safeFetch(url, opts),
      JSON: { parse: (t: string) => JSON.parse(t), stringify: (v: unknown) => JSON.stringify(v) },
      Math,
      Date,
      String,
      Array,
      Object,
      Promise,
    };
  }

  private async executeWithContext(code: string, ctx: Record<string, unknown>): Promise<unknown> {
    const fn = new Function(...Object.keys(ctx), `'use strict'; return (async () => { ${code} })()`);
    return fn(...Object.values(ctx));
  }

  private async safeFetch(url: string, opts?: RequestInit): Promise<Response> {
    try {
      const parsed = new URL(url);
      if (INTERNAL_IPS.some((p) => p.test(parsed.hostname))) throw new Error('Internal IPs blocked');

      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), this.config.networkTimeout);

      try {
        const res = await fetch(url, { ...opts, signal: ctrl.signal });
        clearTimeout(tid);
        return res;
      } catch (e) {
        clearTimeout(tid);
        throw e;
      }
    } catch (e) {
      throw new Error(`Network failed: ${e instanceof Error ? e.message : 'Unknown'}`);
    }
  }

  async abortExecution(id: string): Promise<void> {
    this.executing.get(id)?.abort();
    this.executing.delete(id);
  }

  getActiveCount(): number {
    return this.executing.size;
  }
}
