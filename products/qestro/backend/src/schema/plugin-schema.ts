import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  unique,
  decimal,
} from "drizzle-orm/pg-core";
import { users } from "./auth-schema.js";
import { projects, testCases } from "./index.js";

// Plugin System Tables

// Plugins table - Core plugin metadata and code
export const plugins = pgTable(
  "plugins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    version: varchar("version", { length: 50 }).notNull(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Plugin metadata
    type: varchar("type", { length: 50 }).notNull(), // test-generator, validator, integration, reporter, data-provider
    category: varchar("category", { length: 100 }).notNull(),
    description: text("description").notNull(),
    longDescription: text("long_description"),

    // Code and configuration
    code: text("code").notNull(),
    entryPoint: varchar("entry_point", { length: 255 }).notNull(),
    configuration: jsonb("configuration").default({}),

    // Security and permissions
    permissions: jsonb("permissions").default([]), // array of permission strings
    securityScanStatus: varchar("security_scan_status", { length: 20 }).default(
      "pending",
    ), // pending, passed, failed, warning
    securityScanResults: jsonb("security_scan_results").default({}),

    // Marketplace data
    isPublic: boolean("is_public").default(false),
    isApproved: boolean("is_approved").default(false),
    downloads: integer("downloads").default(0),
    rating: decimal("rating", { precision: 3, scale: 2 }).default("0.00"),
    reviewCount: integer("review_count").default(0),

    // AI generation metadata
    aiGenerated: boolean("ai_generated").default(false),
    generationPrompt: text("generation_prompt"),
    confidence: decimal("confidence", { precision: 3, scale: 2 }),

    // Status and lifecycle
    status: varchar("status", { length: 20 }).notNull().default("draft"), // draft, published, deprecated, banned
    isActive: boolean("is_active").default(true),

    // Timestamps
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    authorIdIdx: index("plugins_author_id_idx").on(table.authorId),
    typeIdx: index("plugins_type_idx").on(table.type),
    categoryIdx: index("plugins_category_idx").on(table.category),
    statusIdx: index("plugins_status_idx").on(table.status),
    isPublicIdx: index("plugins_is_public_idx").on(table.isPublic),
    ratingIdx: index("plugins_rating_idx").on(table.rating),
    downloadsIdx: index("plugins_downloads_idx").on(table.downloads),
  }),
);

// Plugin versions table - Version history and management
export const pluginVersions = pgTable(
  "plugin_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pluginId: uuid("plugin_id")
      .notNull()
      .references(() => plugins.id, { onDelete: "cascade" }),
    version: varchar("version", { length: 50 }).notNull(),

    // Version metadata
    changelog: text("changelog"),
    breakingChanges: text("breaking_changes"),

    // Code and configuration for this version
    code: text("code").notNull(),
    entryPoint: varchar("entry_point", { length: 255 }).notNull(),
    configuration: jsonb("configuration").default({}),

    // Security scan for this version
    securityScanStatus: varchar("security_scan_status", { length: 20 }).default(
      "pending",
    ),
    securityScanResults: jsonb("security_scan_results").default({}),

    // Version status
    isLatest: boolean("is_latest").default(false),
    isStable: boolean("is_stable").default(false),
    isDeprecated: boolean("is_deprecated").default(false),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    pluginIdIdx: index("plugin_versions_plugin_id_idx").on(table.pluginId),
    versionIdx: index("plugin_versions_version_idx").on(table.version),
    isLatestIdx: index("plugin_versions_is_latest_idx").on(table.isLatest),
    pluginVersionUnique: unique("plugin_versions_plugin_version_unique").on(
      table.pluginId,
      table.version,
    ),
  }),
);

// Plugin dependencies table - Dependency tracking and conflict resolution
export const pluginDependencies = pgTable(
  "plugin_dependencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pluginId: uuid("plugin_id")
      .notNull()
      .references(() => plugins.id, { onDelete: "cascade" }),
    dependencyPluginId: uuid("dependency_plugin_id").references(
      () => plugins.id,
      { onDelete: "cascade" },
    ),

    // Dependency metadata
    dependencyName: varchar("dependency_name", { length: 255 }).notNull(),
    dependencyType: varchar("dependency_type", { length: 50 }).notNull(), // plugin, npm, system, api
    versionConstraint: varchar("version_constraint", { length: 100 }).notNull(), // semver constraint
    isOptional: boolean("is_optional").default(false),

    // Conflict resolution
    conflictsWith: jsonb("conflicts_with").default([]), // array of conflicting plugin IDs
    alternatives: jsonb("alternatives").default([]), // array of alternative plugin IDs

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    pluginIdIdx: index("plugin_dependencies_plugin_id_idx").on(table.pluginId),
    dependencyPluginIdIdx: index(
      "plugin_dependencies_dependency_plugin_id_idx",
    ).on(table.dependencyPluginId),
    dependencyTypeIdx: index("plugin_dependencies_dependency_type_idx").on(
      table.dependencyType,
    ),
  }),
);

// Plugin installations table - Track user plugin installations
export const pluginInstallations = pgTable(
  "plugin_installations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pluginId: uuid("plugin_id")
      .notNull()
      .references(() => plugins.id, { onDelete: "cascade" }),

    // Installation metadata
    installedVersion: varchar("installed_version", { length: 50 }).notNull(),
    autoUpdate: boolean("auto_update").default(true),

    // Configuration
    userConfiguration: jsonb("user_configuration").default({}),

    // Status
    isActive: boolean("is_active").default(true),
    lastUsed: timestamp("last_used"),
    usageCount: integer("usage_count").default(0),

    // Timestamps
    installedAt: timestamp("installed_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("plugin_installations_user_id_idx").on(table.userId),
    pluginIdIdx: index("plugin_installations_plugin_id_idx").on(table.pluginId),
    isActiveIdx: index("plugin_installations_is_active_idx").on(table.isActive),
    userPluginUnique: unique("plugin_installations_user_plugin_unique").on(
      table.userId,
      table.pluginId,
    ),
  }),
);

// Plugin execution logs table - Track plugin executions and performance
export const pluginExecutionLogs = pgTable(
  "plugin_execution_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pluginId: uuid("plugin_id")
      .notNull()
      .references(() => plugins.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    installationId: uuid("installation_id")
      .notNull()
      .references(() => pluginInstallations.id, { onDelete: "cascade" }),

    // Execution context
    executionContext: varchar("execution_context", { length: 100 }).notNull(), // test-generation, validation, integration, etc.
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    testCaseId: uuid("test_case_id").references(() => testCases.id, {
      onDelete: "set null",
    }),

    // Execution details
    startTime: timestamp("start_time").notNull(),
    endTime: timestamp("end_time"),
    duration: integer("duration"), // milliseconds
    status: varchar("status", { length: 20 }).notNull(), // running, success, error, timeout

    // Input/Output
    input: jsonb("input"),
    output: jsonb("output"),
    error: text("error"),

    // Performance metrics
    memoryUsage: integer("memory_usage"), // bytes
    cpuUsage: decimal("cpu_usage", { precision: 5, scale: 2 }), // percentage

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    pluginIdIdx: index("plugin_execution_logs_plugin_id_idx").on(
      table.pluginId,
    ),
    userIdIdx: index("plugin_execution_logs_user_id_idx").on(table.userId),
    installationIdIdx: index("plugin_execution_logs_installation_id_idx").on(
      table.installationId,
    ),
    statusIdx: index("plugin_execution_logs_status_idx").on(table.status),
    startTimeIdx: index("plugin_execution_logs_start_time_idx").on(
      table.startTime,
    ),
    executionContextIdx: index(
      "plugin_execution_logs_execution_context_idx",
    ).on(table.executionContext),
  }),
);

// Plugin analytics table - Aggregate analytics data
export const pluginAnalytics = pgTable(
  "plugin_analytics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pluginId: uuid("plugin_id")
      .notNull()
      .references(() => plugins.id, { onDelete: "cascade" }),

    // Time bucket
    date: timestamp("date").notNull(), // date bucket (hour, day, week, month)
    granularity: varchar("granularity", { length: 10 }).notNull(), // hour, day, week, month

    // Usage metrics
    executionCount: integer("execution_count").default(0),
    successCount: integer("success_count").default(0),
    errorCount: integer("error_count").default(0),
    timeoutCount: integer("timeout_count").default(0),

    // Performance metrics
    totalDuration: integer("total_duration").default(0), // sum for average calculation
    minDuration: integer("min_duration"),
    maxDuration: integer("max_duration"),
    avgMemoryUsage: integer("avg_memory_usage"),
    avgCpuUsage: decimal("avg_cpu_usage", { precision: 5, scale: 2 }),

    // User metrics
    uniqueUsers: integer("unique_users").default(0),
    newInstallations: integer("new_installations").default(0),
    uninstallations: integer("uninstallations").default(0),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    pluginIdDateIdx: unique(
      "plugin_analytics_plugin_date_granularity_unique",
    ).on(table.pluginId, table.date, table.granularity),
    dateIdx: index("plugin_analytics_date_idx").on(table.date),
    granularityIdx: index("plugin_analytics_granularity_idx").on(
      table.granularity,
    ),
  }),
);

// Plugin reviews table - User reviews and ratings
export const pluginReviews = pgTable(
  "plugin_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pluginId: uuid("plugin_id")
      .notNull()
      .references(() => plugins.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Review content
    rating: integer("rating").notNull(), // 1-5 stars
    title: varchar("title", { length: 255 }),
    content: text("content"),

    // Review metadata
    version: varchar("version", { length: 50 }).notNull(), // plugin version reviewed
    isVerifiedPurchase: boolean("is_verified_purchase").default(false),

    // Moderation
    isApproved: boolean("is_approved").default(true),
    moderationNotes: text("moderation_notes"),

    // Helpfulness
    helpfulCount: integer("helpful_count").default(0),
    notHelpfulCount: integer("not_helpful_count").default(0),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    pluginIdIdx: index("plugin_reviews_plugin_id_idx").on(table.pluginId),
    userIdIdx: index("plugin_reviews_user_id_idx").on(table.userId),
    ratingIdx: index("plugin_reviews_rating_idx").on(table.rating),
    isApprovedIdx: index("plugin_reviews_is_approved_idx").on(table.isApproved),
    userPluginUnique: unique("plugin_reviews_user_plugin_unique").on(
      table.userId,
      table.pluginId,
    ),
  }),
);

// Plugin review helpfulness table - Track review helpfulness votes
export const pluginReviewHelpfulness = pgTable(
  "plugin_review_helpfulness",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => pluginReviews.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    isHelpful: boolean("is_helpful").notNull(), // true = helpful, false = not helpful

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    reviewIdIdx: index("plugin_review_helpfulness_review_id_idx").on(
      table.reviewId,
    ),
    userIdIdx: index("plugin_review_helpfulness_user_id_idx").on(table.userId),
    userReviewUnique: unique("plugin_review_helpfulness_user_review_unique").on(
      table.userId,
      table.reviewId,
    ),
  }),
);

// Plugin marketplace categories table - Hierarchical categories
export const pluginCategories = pgTable(
  "plugin_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    description: text("description"),

    // Hierarchy
    parentId: uuid("parent_id").references(() => pluginCategories.id, {
      onDelete: "set null",
    }),

    // Display
    icon: varchar("icon", { length: 100 }),
    color: varchar("color", { length: 7 }), // hex color
    sortOrder: integer("sort_order").default(0),

    // Status
    isActive: boolean("is_active").default(true),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    parentIdIdx: index("plugin_categories_parent_id_idx").on(table.parentId),
    sortOrderIdx: index("plugin_categories_sort_order_idx").on(table.sortOrder),
  }),
);

// Plugin tags table - Flexible tagging system
export const pluginTags = pgTable(
  "plugin_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 50 }).notNull().unique(),
    slug: varchar("slug", { length: 50 }).notNull().unique(),
    description: text("description"),
    color: varchar("color", { length: 7 }), // hex color

    // Usage tracking
    usageCount: integer("usage_count").default(0),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    usageCountIdx: index("plugin_tags_usage_count_idx").on(table.usageCount),
  }),
);

// Plugin tag associations table - Many-to-many relationship
export const pluginTagAssociations = pgTable(
  "plugin_tag_associations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pluginId: uuid("plugin_id")
      .notNull()
      .references(() => plugins.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => pluginTags.id, { onDelete: "cascade" }),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    pluginIdIdx: index("plugin_tag_associations_plugin_id_idx").on(
      table.pluginId,
    ),
    tagIdIdx: index("plugin_tag_associations_tag_id_idx").on(table.tagId),
    pluginTagUnique: unique("plugin_tag_associations_plugin_tag_unique").on(
      table.pluginId,
      table.tagId,
    ),
  }),
);
