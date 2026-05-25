/**
 * Plugin Marketplace Types
 * Shared type definitions for the plugin ecosystem
 */

export type PluginCategory = 'runner' | 'reporter' | 'generator' | 'healer' | 'integration' | 'assertion' | 'utility';

export interface Plugin {
  id: string;
  name: string;
  description: string;
  author: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  category: PluginCategory;
  versions: PluginVersion[];
  currentVersion: PluginVersion;
  tags: string[];
  repository?: string;
  documentation?: string;
  license: string;
  stats: PluginStats;
  reviews: PluginReview[];
  averageRating: number;
  featured: boolean;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PluginVersion {
  version: string; // semver format (1.0.0)
  releaseNotes?: string;
  requirements: {
    qestroVersion: string; // semver range (^1.0.0)
    dependencies?: Record<string, string>;
  };
  hooks?: {
    onInstall?: string;
    onUninstall?: string;
    onUpdate?: string;
  };
  code?: string; // Plugin source code or URL
  codeHash: string; // SHA256 for integrity
  fileSize: number;
  downloads: number;
  publishedAt: Date;
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: {
    name: string;
    email: string;
    avatar?: string;
  };
  category: PluginCategory;
  tags: string[];
  license: string;
  repository?: string;
  documentation?: string;
  requirements: {
    qestroVersion: string;
    dependencies?: Record<string, string>;
  };
  hooks?: {
    onInstall?: string;
    onUninstall?: string;
    onUpdate?: string;
  };
  icon?: string;
  keywords: string[];
}

export interface PluginInstallation {
  id: string;
  projectId: string;
  pluginId: string;
  plugin: Plugin;
  version: string;
  enabled: boolean;
  config?: Record<string, unknown>;
  installedAt: Date;
  updatedAt: Date;
}

export interface PluginReview {
  id: string;
  pluginId: string;
  userId: string;
  userName: string;
  rating: number; // 1-5
  comment: string;
  helpful: number; // upvotes
  createdAt: Date;
  updatedAt: Date;
}

export interface PluginStats {
  downloads: number;
  installs: number;
  activeInstallations: number;
  reviews: number;
  averageRating: number;
  weeklyDownloads: number;
}

export interface PluginSearchQuery {
  query?: string;
  category?: PluginCategory;
  tags?: string[];
  verified?: boolean;
  featured?: boolean;
  sortBy?: 'downloads' | 'rating' | 'newest' | 'updated';
  limit?: number;
  offset?: number;
}

export interface PluginSearchResult {
  plugins: Plugin[];
  total: number;
  limit: number;
  offset: number;
}

export interface ExecutionContext {
  projectId: string;
  userId: string;
  qestroVersion: string;
  environment: Record<string, string>;
  timeout?: number;
}

export interface PluginResult {
  success: boolean;
  data?: unknown;
  error?: string;
  executionTime: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PluginDependency {
  pluginId: string;
  version: string; // semver range
}
