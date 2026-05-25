/**
 * Plugin Installer - Handles installation, removal, dependencies
 */

import semver from 'semver';
import { Plugin, PluginInstallation, PluginDependency } from './types.js';
import { PluginRegistry } from './PluginRegistry.js';

interface InstalledPlugin {
  id: string;
  projectId: string;
  pluginId: string;
  version: string;
  enabled: boolean;
  config?: Record<string, unknown>;
  installedAt: Date;
  updatedAt: Date;
}

export class PluginInstaller {
  private installations: Map<string, InstalledPlugin[]> = new Map();

  constructor(private registry: PluginRegistry) {}

  async installPlugin(projectId: string, pluginId: string, version?: string): Promise<PluginInstallation> {
    const plugin = await this.registry.getPlugin(pluginId);
    if (!plugin) throw new Error(`Plugin "${pluginId}" not found`);

    const targetVersion = version || plugin.currentVersion.version;
    const pv = plugin.versions.find((v) => v.version === targetVersion);
    if (!pv) throw new Error(`Plugin version "${targetVersion}" not found`);

    const installs = this.installations.get(projectId) || [];
    if (installs.some((i) => i.pluginId === pluginId)) {
      throw new Error(`Plugin "${pluginId}" already installed`);
    }

    await this.resolveDependencies(projectId, plugin);
    if (pv.hooks?.onInstall) await this.executeHook(pv.hooks.onInstall, projectId, plugin);

    const inst: InstalledPlugin = {
      id: `inst-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      projectId,
      pluginId,
      version: targetVersion,
      enabled: true,
      installedAt: new Date(),
      updatedAt: new Date(),
    };

    installs.push(inst);
    this.installations.set(projectId, installs);
    return this.format(inst, plugin);
  }

  async uninstallPlugin(projectId: string, pluginId: string): Promise<void> {
    const installs = this.installations.get(projectId) || [];
    const inst = installs.find((i) => i.pluginId === pluginId);
    if (!inst) throw new Error(`Plugin "${pluginId}" not installed`);

    const plugin = await this.registry.getPlugin(pluginId);
    if (!plugin) throw new Error(`Plugin "${pluginId}" not found`);

    const pv = plugin.versions.find((v) => v.version === inst.version);
    if (pv?.hooks?.onUninstall) await this.executeHook(pv.hooks.onUninstall, projectId, plugin);

    const updated = installs.filter((i) => i.pluginId !== pluginId);
    if (updated.length === 0) this.installations.delete(projectId);
    else this.installations.set(projectId, updated);
  }

  async updatePlugin(projectId: string, pluginId: string): Promise<PluginInstallation> {
    const installs = this.installations.get(projectId) || [];
    const inst = installs.find((i) => i.pluginId === pluginId);
    if (!inst) throw new Error(`Plugin "${pluginId}" not installed`);

    const plugin = await this.registry.getPlugin(pluginId);
    if (!plugin) throw new Error(`Plugin "${pluginId}" not found`);
    if (inst.version === plugin.currentVersion.version) return this.format(inst, plugin);

    if (plugin.currentVersion.hooks?.onUpdate) {
      await this.executeHook(plugin.currentVersion.hooks.onUpdate, projectId, plugin);
    }

    inst.version = plugin.currentVersion.version;
    inst.updatedAt = new Date();
    return this.format(inst, plugin);
  }

  async getInstalledPlugins(projectId: string): Promise<PluginInstallation[]> {
    const installs = this.installations.get(projectId) || [];
    const result: PluginInstallation[] = [];

    for (const inst of installs) {
      const plugin = await this.registry.getPlugin(inst.pluginId);
      if (plugin) result.push(this.format(inst, plugin));
    }

    return result;
  }

  async checkCompatibility(pluginId: string, qestroVersion: string): Promise<boolean> {
    const plugin = await this.registry.getPlugin(pluginId);
    return plugin ? semver.satisfies(qestroVersion, plugin.currentVersion.requirements.qestroVersion) : false;
  }

  private async resolveDependencies(projectId: string, plugin: Plugin): Promise<void> {
    const deps = this.extractDeps(plugin.currentVersion);
    const installs = this.installations.get(projectId) || [];

    for (const dep of deps) {
      if (installs.some((i) => i.pluginId === dep.pluginId)) continue;

      const depPlugin = await this.registry.getPlugin(dep.pluginId);
      if (!depPlugin) throw new Error(`Dependency "${dep.pluginId}" not found`);
      if (!semver.satisfies(depPlugin.currentVersion.version, dep.version)) {
        throw new Error(`Dependency "${dep.pluginId}" version mismatch: ${dep.version}`);
      }

      await this.installPlugin(projectId, dep.pluginId, depPlugin.currentVersion.version);
      await this.resolveDependencies(projectId, depPlugin);
    }
  }

  private extractDeps(version: any): PluginDependency[] {
    const deps: PluginDependency[] = [];
    if (version.requirements?.dependencies) {
      for (const [id, range] of Object.entries(version.requirements.dependencies)) {
        deps.push({ pluginId: id, version: range as string });
      }
    }
    return deps;
  }

  private async executeHook(code: string, projectId: string, plugin: Plugin): Promise<void> {
    const { executeInSandbox } = await import('../../lib/code-sandbox.js');
    const result = await executeInSandbox(
      `return (async () => { ${code} })()`,
      { projectId, plugin },
    );
    if (!result.success) {
      throw new Error(`Hook failed: ${result.error}`);
    }
  }

  private format(inst: InstalledPlugin, plugin: Plugin): PluginInstallation {
    return { id: inst.id, projectId: inst.projectId, pluginId: inst.pluginId, plugin, version: inst.version, enabled: inst.enabled, config: inst.config, installedAt: inst.installedAt, updatedAt: inst.updatedAt };
  }
}
