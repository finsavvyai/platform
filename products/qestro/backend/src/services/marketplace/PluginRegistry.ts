/**
 * Plugin Registry Service - Manages registration, versioning, discovery
 */

import semver from 'semver';
import {
  Plugin,
  PluginVersion,
  PluginManifest,
  PluginCategory,
  PluginSearchQuery,
  PluginSearchResult,
} from './types.js';

interface StoredPlugin {
  id: string;
  name: string;
  description: string;
  author: Record<string, unknown>;
  category: PluginCategory;
  versions: PluginVersion[];
  currentVersionId: string;
  tags: string[];
  repository?: string;
  documentation?: string;
  license: string;
  stats: Record<string, number>;
  featured: boolean;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class PluginRegistry {
  private plugins: Map<string, StoredPlugin> = new Map();
  private pluginsByCategory: Map<PluginCategory, string[]> = new Map();

  constructor() {
    ['runner', 'reporter', 'generator', 'healer', 'integration', 'assertion', 'utility'].forEach(
      (cat) => this.pluginsByCategory.set(cat as PluginCategory, [])
    );
  }

  async registerPlugin(manifest: PluginManifest, authorId: string): Promise<Plugin> {
    this.validateManifest(manifest);
    const pluginId = this.generateId(manifest.name);
    if (this.plugins.has(pluginId)) throw new Error(`Plugin "${manifest.name}" exists`);

    const plugin: StoredPlugin = {
      id: pluginId,
      name: manifest.name,
      description: manifest.description,
      author: { id: authorId, ...manifest.author },
      category: manifest.category,
      versions: [
        {
          version: manifest.version,
          releaseNotes: '',
          requirements: manifest.requirements,
          hooks: manifest.hooks,
          codeHash: '',
          fileSize: 0,
          downloads: 0,
          publishedAt: new Date(),
        },
      ],
      currentVersionId: manifest.version,
      tags: manifest.tags,
      repository: manifest.repository,
      documentation: manifest.documentation,
      license: manifest.license,
      stats: { downloads: 0, installs: 0, activeInstallations: 0, reviews: 0, averageRating: 0, weeklyDownloads: 0 },
      featured: false,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.plugins.set(pluginId, plugin);
    this.pluginsByCategory.get(manifest.category)!.push(pluginId);
    return this.formatPlugin(plugin);
  }

  async publishVersion(pluginId: string, version: PluginVersion): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error(`Plugin "${pluginId}" not found`);
    const current = plugin.versions[plugin.versions.length - 1];
    if (!semver.gt(version.version, current.version)) {
      throw new Error(`Version must be > ${current.version}`);
    }
    plugin.versions.push(version);
    plugin.currentVersionId = version.version;
    plugin.updatedAt = new Date();
  }

  async getPlugin(pluginId: string): Promise<Plugin | null> {
    const p = this.plugins.get(pluginId);
    return p ? this.formatPlugin(p) : null;
  }

  async searchPlugins(query: PluginSearchQuery): Promise<PluginSearchResult> {
    let results = Array.from(this.plugins.values());
    const q = query.query?.toLowerCase();

    results = results.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q) && !p.tags.some((t) => t.toLowerCase().includes(q))) return false;
      if (query.category && p.category !== query.category) return false;
      if (query.tags?.length && !query.tags.every((tag) => p.tags.includes(tag))) return false;
      if (query.verified !== undefined && p.verified !== query.verified) return false;
      if (query.featured !== undefined && p.featured !== query.featured) return false;
      return true;
    });

    const sorters: Record<string, (a: StoredPlugin, b: StoredPlugin) => number> = {
      downloads: (a, b) => b.stats.downloads - a.stats.downloads,
      rating: (a, b) => b.stats.averageRating - a.stats.averageRating,
      newest: (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      updated: (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    };

    results.sort(sorters[query.sortBy || 'downloads']);
    const limit = query.limit || 20;
    const offset = query.offset || 0;

    return {
      plugins: results.slice(offset, offset + limit).map((p) => this.formatPlugin(p)),
      total: results.length,
      limit,
      offset,
    };
  }

  async getFeaturedPlugins(): Promise<Plugin[]> {
    return Array.from(this.plugins.values())
      .filter((p) => p.featured)
      .sort((a, b) => b.stats.downloads - a.stats.downloads)
      .slice(0, 10)
      .map((p) => this.formatPlugin(p));
  }

  async getPopularPlugins(limit: number = 10): Promise<Plugin[]> {
    return Array.from(this.plugins.values())
      .sort((a, b) => b.stats.weeklyDownloads - a.stats.weeklyDownloads)
      .slice(0, limit)
      .map((p) => this.formatPlugin(p));
  }

  async getCategoryPlugins(category: PluginCategory): Promise<Plugin[]> {
    return (this.pluginsByCategory.get(category) || [])
      .map((id) => this.plugins.get(id))
      .filter((p): p is StoredPlugin => p !== undefined)
      .sort((a, b) => b.stats.downloads - a.stats.downloads)
      .map((p) => this.formatPlugin(p));
  }

  private validateManifest(m: PluginManifest): void {
    if (!m.name?.trim()) throw new Error('Plugin name required');
    if (!m.description?.trim()) throw new Error('Description required');
    if (!semver.valid(m.version)) throw new Error('Invalid semver format');
    if (!['runner', 'reporter', 'generator', 'healer', 'integration', 'assertion', 'utility'].includes(m.category)) {
      throw new Error(`Invalid category: ${m.category}`);
    }
    if (!m.author.name || !m.author.email) throw new Error('Author name/email required');
  }

  private generateId(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  private formatPlugin(p: StoredPlugin): Plugin {
    const cv = p.versions.find((v) => v.version === p.currentVersionId);
    if (!cv) throw new Error(`Current version missing for ${p.id}`);
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      author: p.author as any,
      category: p.category,
      versions: p.versions,
      currentVersion: cv,
      tags: p.tags,
      repository: p.repository,
      documentation: p.documentation,
      license: p.license,
      stats: p.stats as any,
      reviews: [],
      averageRating: p.stats.averageRating as number,
      featured: p.featured,
      verified: p.verified,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }
}
