import {
  sqliteTable,
  text,
  integer,
  real
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { coreSchema } from './core-schema.js';

// Plugins table - Core plugin metadata and code (SQLite version)
export const plugins = sqliteTable('plugins', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  version: text('version').notNull(),
  authorId: text('author_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),

  // Plugin metadata
  type: text('type').notNull(), // test-generator, validator, integration, reporter, data-provider
  category: text('category').notNull(),
  description: text('description').notNull(),
  longDescription: text('long_description'),

  // Code and configuration
  code: text('code').notNull(),
  entryPoint: text('entry_point').notNull(),
  configuration: text('configuration', { mode: 'json' }).$defaultFn(() => '{}'),

  // Security and permissions
  permissions: text('permissions', { mode: 'json' }).$defaultFn(() => '[]'), // array of permission strings
  securityScanStatus: text('security_scan_status').default('pending'), // pending, passed, failed, warning
  securityScanResults: text('security_scan_results', { mode: 'json' }).$defaultFn(() => '{}'),

  // Marketplace data
  isPublic: integer('is_public', { mode: 'boolean' }).default(false),
  isApproved: integer('is_approved', { mode: 'boolean' }).default(false),
  downloads: integer('downloads').default(0),
  rating: real('rating').default(0.00),
  reviewCount: integer('review_count').default(0),

  // AI generation metadata
  aiGenerated: integer('ai_generated', { mode: 'boolean' }).default(false),
  generationPrompt: text('generation_prompt'),
  confidence: real('confidence'),

  // Status and lifecycle
  status: text('status').notNull().default('draft'), // draft, published, deprecated, banned
  isActive: integer('is_active', { mode: 'boolean' }).default(true),

  // Timestamps
  publishedAt: integer('published_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  authorIdIdx: sql`CREATE INDEX plugins_author_id_idx ON ${table.name} (author_id)`,
  typeIdx: sql`CREATE INDEX plugins_type_idx ON ${table.name} (type)`,
  categoryIdx: sql`CREATE INDEX plugins_category_idx ON ${table.name} (category)`,
  statusIdx: sql`CREATE INDEX plugins_status_idx ON ${table.name} (status)`,
  isPublicIdx: sql`CREATE INDEX plugins_is_public_idx ON ${table.name} (is_public)`,
  ratingIdx: sql`CREATE INDEX plugins_rating_idx ON ${table.name} (rating)`,
  downloadsIdx: sql`CREATE INDEX plugins_downloads_idx ON ${table.name} (downloads)`,
}));

// Plugin versions table - Version history and management (SQLite version)
export const pluginVersions = sqliteTable('plugin_versions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  pluginId: text('plugin_id').notNull().references(() => plugins.id, { onDelete: 'cascade' }),
  version: text('version').notNull(),

  // Version metadata
  changelog: text('changelog'),
  breakingChanges: text('breaking_changes'),

  // Code and configuration for this version
  code: text('code').notNull(),
  entryPoint: text('entry_point').notNull(),
  configuration: text('configuration', { mode: 'json' }).$defaultFn(() => '{}'),

  // Security scan for this version
  securityScanStatus: text('security_scan_status').default('pending'),
  securityScanResults: text('security_scan_results', { mode: 'json' }).$defaultFn(() => '{}'),

  // Version status
  isLatest: integer('is_latest', { mode: 'boolean' }).default(false),
  isStable: integer('is_stable', { mode: 'boolean' }).default(false),
  isDeprecated: integer('is_deprecated', { mode: 'boolean' }).default(false),

  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  pluginIdIdx: sql`CREATE INDEX plugin_versions_plugin_id_idx ON ${table.name} (plugin_id)`,
  versionIdx: sql`CREATE INDEX plugin_versions_version_idx ON ${table.name} (version)`,
  isLatestIdx: sql`CREATE INDEX plugin_versions_is_latest_idx ON ${table.name} (is_latest)`,
  pluginVersionUnique: sql`CREATE UNIQUE INDEX plugin_versions_plugin_version_unique ON ${table.name} (plugin_id, version)`,
}));

// Plugin dependencies table - Dependency tracking and conflict resolution (SQLite version)
export const pluginDependencies = sqliteTable('plugin_dependencies', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  pluginId: text('plugin_id').notNull().references(() => plugins.id, { onDelete: 'cascade' }),
  dependencyPluginId: text('dependency_plugin_id').references(() => plugins.id, { onDelete: 'cascade' }),

  // Dependency metadata
  dependencyName: text('dependency_name').notNull(),
  dependencyType: text('dependency_type').notNull(), // plugin, npm, system, api
  versionConstraint: text('version_constraint').notNull(), // semver constraint
  isOptional: integer('is_optional', { mode: 'boolean' }).default(false),

  // Conflict resolution
  conflictsWith: text('conflicts_with', { mode: 'json' }).$defaultFn(() => '[]'), // array of conflicting plugin IDs
  alternatives: text('alternatives', { mode: 'json' }).$defaultFn(() => '[]'), // array of alternative plugin IDs

  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  pluginIdIdx: sql`CREATE INDEX plugin_dependencies_plugin_id_idx ON ${table.name} (plugin_id)`,
  dependencyPluginIdIdx: sql`CREATE INDEX plugin_dependencies_dependency_plugin_id_idx ON ${table.name} (dependency_plugin_id)`,
  dependencyTypeIdx: sql`CREATE INDEX plugin_dependencies_dependency_type_idx ON ${table.name} (dependency_type)`,
}));

// Plugin installations table - Track user plugin installations (SQLite version)
export const pluginInstallations = sqliteTable('plugin_installations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),
  pluginId: text('plugin_id').notNull().references(() => plugins.id, { onDelete: 'cascade' }),

  // Installation metadata
  installedVersion: text('installed_version').notNull(),
  autoUpdate: integer('auto_update', { mode: 'boolean' }).default(true),

  // Configuration
  userConfiguration: text('user_configuration', { mode: 'json' }).$defaultFn(() => '{}'),

  // Status
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  lastUsed: integer('last_used', { mode: 'timestamp' }),
  usageCount: integer('usage_count').default(0),

  // Timestamps
  installedAt: integer('installed_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  userIdIdx: sql`CREATE INDEX plugin_installations_user_id_idx ON ${table.name} (user_id)`,
  pluginIdIdx: sql`CREATE INDEX plugin_installations_plugin_id_idx ON ${table.name} (plugin_id)`,
  isActiveIdx: sql`CREATE INDEX plugin_installations_is_active_idx ON ${table.name} (is_active)`,
  userPluginUnique: sql`CREATE UNIQUE INDEX plugin_installations_user_plugin_unique ON ${table.name} (user_id, plugin_id)`,
}));

// Plugin execution logs table - Track plugin executions and performance (SQLite version)
export const pluginExecutionLogs = sqliteTable('plugin_execution_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  pluginId: text('plugin_id').notNull().references(() => plugins.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),
  installationId: text('installation_id').notNull().references(() => pluginInstallations.id, { onDelete: 'cascade' }),

  // Execution context
  executionContext: text('execution_context').notNull(), // test-generation, validation, integration, etc.
  projectId: text('project_id').references(() => coreSchema.projects.id, { onDelete: 'set null' }),
  testCaseId: text('test_case_id').references(() => coreSchema.testCases.id, { onDelete: 'set null' }),

  // Execution details
  startTime: integer('start_time', { mode: 'timestamp' }).notNull(),
  endTime: integer('end_time', { mode: 'timestamp' }),
  duration: integer('duration'), // milliseconds
  status: text('status').notNull(), // running, success, error, timeout

  // Input/Output
  input: text('input', { mode: 'json' }),
  output: text('output', { mode: 'json' }),
  error: text('error'),

  // Performance metrics
  memoryUsage: integer('memory_usage'), // bytes
  cpuUsage: real('cpu_usage'), // percentage

  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  pluginIdIdx: sql`CREATE INDEX plugin_execution_logs_plugin_id_idx ON ${table.name} (plugin_id)`,
  userIdIdx: sql`CREATE INDEX plugin_execution_logs_user_id_idx ON ${table.name} (user_id)`,
  installationIdIdx: sql`CREATE INDEX plugin_execution_logs_installation_id_idx ON ${table.name} (installation_id)`,
  statusIdx: sql`CREATE INDEX plugin_execution_logs_status_idx ON ${table.name} (status)`,
  startTimeIdx: sql`CREATE INDEX plugin_execution_logs_start_time_idx ON ${table.name} (start_time)`,
  executionContextIdx: sql`CREATE INDEX plugin_execution_logs_execution_context_idx ON ${table.name} (execution_context)`,
}));

// Plugin analytics table - Aggregate analytics data (SQLite version)
export const pluginAnalytics = sqliteTable('plugin_analytics', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  pluginId: text('plugin_id').notNull().references(() => plugins.id, { onDelete: 'cascade' }),

  // Time bucket
  date: integer('date', { mode: 'timestamp' }).notNull(), // date bucket (hour, day, week, month)
  granularity: text('granularity').notNull(), // hour, day, week, month

  // Usage metrics
  executionCount: integer('execution_count').default(0),
  successCount: integer('success_count').default(0),
  errorCount: integer('error_count').default(0),
  timeoutCount: integer('timeout_count').default(0),

  // Performance metrics
  totalDuration: integer('total_duration').default(0), // sum for average calculation
  minDuration: integer('min_duration'),
  maxDuration: integer('max_duration'),
  avgMemoryUsage: integer('avg_memory_usage'),
  avgCpuUsage: real('avg_cpu_usage'),

  // User metrics
  uniqueUsers: integer('unique_users').default(0),
  newInstallations: integer('new_installations').default(0),
  uninstallations: integer('uninstallations').default(0),

  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  pluginIdDateIdx: sql`CREATE UNIQUE INDEX plugin_analytics_plugin_date_granularity_unique ON ${table.name} (plugin_id, date, granularity)`,
  dateIdx: sql`CREATE INDEX plugin_analytics_date_idx ON ${table.name} (date)`,
  granularityIdx: sql`CREATE INDEX plugin_analytics_granularity_idx ON ${table.name} (granularity)`,
}));

// Plugin reviews table - User reviews and ratings (SQLite version)
export const pluginReviews = sqliteTable('plugin_reviews', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  pluginId: text('plugin_id').notNull().references(() => plugins.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),

  // Review content
  rating: integer('rating').notNull(), // 1-5 stars
  title: text('title'),
  content: text('content'),

  // Review metadata
  version: text('version').notNull(), // plugin version reviewed
  isVerifiedPurchase: integer('is_verified_purchase', { mode: 'boolean' }).default(false),

  // Moderation
  isApproved: integer('is_approved', { mode: 'boolean' }).default(true),
  moderationNotes: text('moderation_notes'),

  // Helpfulness
  helpfulCount: integer('helpful_count').default(0),
  notHelpfulCount: integer('not_helpful_count').default(0),

  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  pluginIdIdx: sql`CREATE INDEX plugin_reviews_plugin_id_idx ON ${table.name} (plugin_id)`,
  userIdIdx: sql`CREATE INDEX plugin_reviews_user_id_idx ON ${table.name} (user_id)`,
  ratingIdx: sql`CREATE INDEX plugin_reviews_rating_idx ON ${table.name} (rating)`,
  isApprovedIdx: sql`CREATE INDEX plugin_reviews_is_approved_idx ON ${table.name} (is_approved)`,
  userPluginUnique: sql`CREATE UNIQUE INDEX plugin_reviews_user_plugin_unique ON ${table.name} (user_id, plugin_id)`,
}));

// Plugin review helpfulness table - Track review helpfulness votes (SQLite version)
export const pluginReviewHelpfulness = sqliteTable('plugin_review_helpfulness', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  reviewId: text('review_id').notNull().references(() => pluginReviews.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),

  isHelpful: integer('is_helpful', { mode: 'boolean' }).notNull(), // true = helpful, false = not helpful

  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  reviewIdIdx: sql`CREATE INDEX plugin_review_helpfulness_review_id_idx ON ${table.name} (review_id)`,
  userIdIdx: sql`CREATE INDEX plugin_review_helpfulness_user_id_idx ON ${table.name} (user_id)`,
  userReviewUnique: sql`CREATE UNIQUE INDEX plugin_review_helpfulness_user_review_unique ON ${table.name} (user_id, review_id)`,
}));

// Plugin marketplace categories table - Hierarchical categories (SQLite version)
export const pluginCategories = sqliteTable('plugin_categories', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),

  // Hierarchy
  parentId: text('parent_id').references(() => pluginCategories.id, { onDelete: 'set null' }),

  // Display
  icon: text('icon'),
  color: text('color'), // hex color
  sortOrder: integer('sort_order').default(0),

  // Status
  isActive: integer('is_active', { mode: 'boolean' }).default(true),

  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  parentIdIdx: sql`CREATE INDEX plugin_categories_parent_id_idx ON ${table.name} (parent_id)`,
  sortOrderIdx: sql`CREATE INDEX plugin_categories_sort_order_idx ON ${table.name} (sort_order)`,
}));

// Plugin tags table - Flexible tagging system (SQLite version)
export const pluginTags = sqliteTable('plugin_tags', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  color: text('color'), // hex color

  // Usage tracking
  usageCount: integer('usage_count').default(0),

  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  usageCountIdx: sql`CREATE INDEX plugin_tags_usage_count_idx ON ${table.name} (usage_count)`,
}));

// Plugin tag associations table - Many-to-many relationship (SQLite version)
export const pluginTagAssociations = sqliteTable('plugin_tag_associations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  pluginId: text('plugin_id').notNull().references(() => plugins.id, { onDelete: 'cascade' }),
  tagId: text('tag_id').notNull().references(() => pluginTags.id, { onDelete: 'cascade' }),

  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  pluginIdIdx: sql`CREATE INDEX plugin_tag_associations_plugin_id_idx ON ${table.name} (plugin_id)`,
  tagIdIdx: sql`CREATE INDEX plugin_tag_associations_tag_id_idx ON ${table.name} (tag_id)`,
  pluginTagUnique: sql`CREATE UNIQUE INDEX plugin_tag_associations_plugin_tag_unique ON ${table.name} (plugin_id, tag_id)`,
}));

// Plugin system schema export
export const pluginSystemSchema = {
  plugins,
  pluginVersions,
  pluginDependencies,
  pluginInstallations,
  pluginExecutionLogs,
  pluginAnalytics,
  pluginReviews,
  pluginReviewHelpfulness,
  pluginCategories,
  pluginTags,
  pluginTagAssociations,
};

export default pluginSystemSchema;
