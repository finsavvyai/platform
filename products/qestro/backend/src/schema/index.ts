import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  primaryKey,
  index,
  unique,
  decimal,
  serial,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Import payment schema
import {
  paymentCustomers,
  subscriptions,
  paymentMethods,
  invoices,
  usageMetrics,
  promoCodes,
  promoCodeUsages,
  subscriptionEvents,
} from "./payment-schema.js";

// Import visual regression schema
import {
  visualBaselines,
  visualTestResults,
  visualDiffRegions,
} from "./visual-regression-schema.js";

// Import plugin schema
import {
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
} from "./plugin-schema.js";

// Import voice schema
import {
  voiceRecordings,
  voiceCommands,
  voiceCommandHistory,
  voiceAnnotations,
  voicePreferences,
  voiceAnalytics,
} from "./voice-schema.js";

// Import API testing schema
import {
  apiTestingCollections,
  apiTestingRequests,
  apiTestingEnvironments,
  apiTestingHistory,
} from "./api-testing-schema.js";

// Import backup schema
import {
  backups,
  recoveryProcedures,
  recoveryExecutions,
  disasterScenarios,
  backupSchedules,
  backupValidations,
  recoveryNotifications,
  backupRetentionPolicies,
  disasterRecoveryDrills,
  backupStorageLocations,
  backupArchiveLogs,
  recoveryMetrics,
} from "./backup-schema.js";

// OAuth accounts table for storing provider-specific user information
export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 50 }).notNull(), // github, azure, google
    providerAccountId: varchar("provider_account_id", {
      length: 255,
    }).notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    expiresAt: timestamp("expires_at"),
    scope: text("scope"),
    tokenType: varchar("token_type", { length: 50 }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    providerAccountIdx: index("oauth_provider_account_idx").on(
      table.provider,
      table.providerAccountId,
    ),
    userIdIdx: index("oauth_user_id_idx").on(table.userId),
  }),
);

// Users table
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    password: varchar("password", { length: 255 }), // nullable for OAuth users
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    avatar: text("avatar"),
    role: varchar("role", { length: 20 }).notNull().default("user"), // user, admin, enterprise
    subscription: varchar("subscription", { length: 20 }).default("free"), // free, pro, enterprise
    isEmailVerified: boolean("is_email_verified").default(false),
    authMethod: varchar("auth_method", { length: 20 }).default("email"), // email, github, azure
    theme: varchar("theme", { length: 20 }).default("dark"), // light, dark, system
    lastActiveProjectId: uuid("last_active_project_id"),
    lastLoginAt: timestamp("last_login_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    emailIdx: index("users_email_idx").on(table.email),
    roleIdx: index("users_role_idx").on(table.role),
  }),
);

// Teams table
export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    ownerId: uuid("owner_id").notNull(),
    description: text("description"),
    plan: varchar("plan", { length: 50 }).default("free"),
    maxMembers: integer("max_members").default(5),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    nameIdx: index("teams_name_idx").on(table.name),
    ownerIdx: index("teams_owner_idx").on(table.ownerId),
  }),
);

// Team Members table
export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: varchar("role", { length: 50 }).notNull().default("member"), // owner, admin, member
    joinedAt: timestamp("joined_at").defaultNow(),
    invitedBy: uuid("invited_by"),
  },
  (table) => ({
    teamUserIdx: index("team_members_team_user_idx").on(table.teamId, table.userId),
  }),
);

// Projects table
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    type: varchar("type", { length: 20 }).notNull(), // mobile, web, hybrid
    platform: varchar("platform", { length: 50 }), // ios, android, chrome, firefox, etc.
    settings: jsonb("settings").default({}),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("projects_user_id_idx").on(table.userId),
    typeIdx: index("projects_type_idx").on(table.type),
  }),
);

// Recording sessions table
export const recordingSessions = pgTable(
  "recording_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }),
    type: varchar("type", { length: 20 }).notNull(), // mobile, web
    platform: varchar("platform", { length: 50 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("idle"), // idle, recording, processing, completed, error
    startTime: timestamp("start_time"),
    endTime: timestamp("end_time"),
    duration: integer("duration").default(0), // in seconds
    actionsCount: integer("actions_count").default(0),
    metadata: jsonb("metadata").default({}),
    artifacts: jsonb("artifacts").default({}), // screenshots, videos, logs
    exportFormats: jsonb("export_formats").default([]), // maestro, workflow-use, json
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    projectIdIdx: index("recording_sessions_project_id_idx").on(
      table.projectId,
    ),
    userIdIdx: index("recording_sessions_user_id_idx").on(table.userId),
    statusIdx: index("recording_sessions_status_idx").on(table.status),
    typeIdx: index("recording_sessions_type_idx").on(table.type),
  }),
);

// Recorded actions table
export const recordedActions = pgTable(
  "recorded_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => recordingSessions.id, { onDelete: "cascade" }),
    sequenceNumber: integer("sequence_number").notNull(),
    type: varchar("type", { length: 20 }).notNull(), // tap, type, swipe, scroll, assert, wait, screenshot, navigate
    timestamp: timestamp("timestamp").notNull(),
    coordinates: jsonb("coordinates"), // { x, y }
    text: text("text"),
    element: varchar("element", { length: 500 }),
    selector: varchar("selector", { length: 500 }),
    screenshot: text("screenshot"), // file path or URL
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    sessionIdIdx: index("recorded_actions_session_id_idx").on(table.sessionId),
    sequenceIdx: index("recorded_actions_sequence_idx").on(
      table.sessionId,
      table.sequenceNumber,
    ),
    typeIdx: index("recorded_actions_type_idx").on(table.type),
  }),
);

// Test suites table
export const testSuites = pgTable(
  "test_suites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    type: varchar("type", { length: 20 }).notNull(), // mobile, web, hybrid
    testCases: jsonb("test_cases").default([]), // array of test case IDs
    settings: jsonb("settings").default({}),
    schedule: jsonb("schedule"), // cron-like scheduling configuration
    isActive: boolean("is_active").default(true),
    lastRunAt: timestamp("last_run_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    projectIdIdx: index("test_suites_project_id_idx").on(table.projectId),
    userIdIdx: index("test_suites_user_id_idx").on(table.userId),
    typeIdx: index("test_suites_type_idx").on(table.type),
  }),
);

// Test cases table
export const testCases = pgTable(
  "test_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => recordingSessions.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    type: varchar("type", { length: 20 }).notNull(), // mobile, web
    platform: varchar("platform", { length: 50 }),
    testData: jsonb("test_data").notNull(), // Maestro YAML, workflow-use YAML, or custom format
    expectedResults: jsonb("expected_results").default([]),
    tags: jsonb("tags").default([]),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    projectIdIdx: index("test_cases_project_id_idx").on(table.projectId),
    sessionIdIdx: index("test_cases_session_id_idx").on(table.sessionId),
    userIdIdx: index("test_cases_user_id_idx").on(table.userId),
    typeIdx: index("test_cases_type_idx").on(table.type),
  }),
);

// Test runs table
export const testRuns = pgTable(
  "test_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    testSuiteId: uuid("test_suite_id").references(() => testSuites.id, {
      onDelete: "cascade",
    }),
    testCaseId: uuid("test_case_id").references(() => testCases.id, {
      onDelete: "cascade",
    }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, running, passed, failed, error
    startTime: timestamp("start_time"),
    endTime: timestamp("end_time"),
    duration: integer("duration"), // in milliseconds
    results: jsonb("results").default({}),
    logs: jsonb("logs").default([]),
    screenshots: jsonb("screenshots").default([]),
    videos: jsonb("videos").default([]),
    errorMessage: text("error_message"),
    environment: jsonb("environment").default({}), // device info, browser info, etc.
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    testSuiteIdIdx: index("test_runs_test_suite_id_idx").on(table.testSuiteId),
    testCaseIdIdx: index("test_runs_test_case_id_idx").on(table.testCaseId),
    projectIdIdx: index("test_runs_project_id_idx").on(table.projectId),
    userIdIdx: index("test_runs_user_id_idx").on(table.userId),
    statusIdx: index("test_runs_status_idx").on(table.status),
  }),
);

// Integrations table
export const integrations = pgTable(
  "integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    type: varchar("type", { length: 50 }).notNull(), // slack, teams, discord, email, webhook, github, jira
    name: varchar("name", { length: 255 }).notNull(),
    config: jsonb("config").notNull(), // integration-specific configuration
    isActive: boolean("is_active").default(true),
    lastTriggeredAt: timestamp("last_triggered_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("integrations_user_id_idx").on(table.userId),
    projectIdIdx: index("integrations_project_id_idx").on(table.projectId),
    typeIdx: index("integrations_type_idx").on(table.type),
  }),
);

// API keys table
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    keyHash: varchar("key_hash", { length: 255 }).notNull(), // hashed API key
    keyPrefix: varchar("key_prefix", { length: 10 }).notNull(), // first few characters for identification
    permissions: jsonb("permissions").default([]), // array of permission strings
    lastUsedAt: timestamp("last_used_at"),
    expiresAt: timestamp("expires_at"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("api_keys_user_id_idx").on(table.userId),
    keyHashIdx: unique("api_keys_key_hash_unique").on(table.keyHash),
  }),
);

// Usage analytics table
export const usageAnalytics = pgTable(
  "usage_analytics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    date: timestamp("date").notNull(),
    recordingMinutes: integer("recording_minutes").default(0),
    testRuns: integer("test_runs").default(0),
    apiCalls: integer("api_calls").default(0),
    storageUsed: integer("storage_used").default(0), // in bytes
    bandwidth: integer("bandwidth").default(0), // in bytes
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdDateIdx: unique("usage_analytics_user_date_unique").on(
      table.userId,
      table.date,
    ),
    projectIdIdx: index("usage_analytics_project_id_idx").on(table.projectId),
    dateIdx: index("usage_analytics_date_idx").on(table.date),
  }),
);

// Data sources table
export const dataSources = pgTable(
  "data_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    type: varchar("type", { length: 50 }).notNull(), // postgresql, mysql, mongodb, redis, api, graphql, rest
    config: jsonb("config").notNull(), // connection configuration
    status: varchar("status", { length: 20 }).notNull().default("inactive"), // active, inactive, error
    lastTestedAt: timestamp("last_tested_at"),
    tags: jsonb("tags").default([]),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("data_sources_user_id_idx").on(table.userId),
    typeIdx: index("data_sources_type_idx").on(table.type),
    statusIdx: index("data_sources_status_idx").on(table.status),
  }),
);

// Scheduled tests table
export const scheduledTests = pgTable(
  "scheduled_tests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dataSourceId: uuid("data_source_id")
      .notNull()
      .references(() => dataSources.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    testType: varchar("test_type", { length: 50 }).notNull(), // query, api, performance, security
    config: jsonb("config").notNull(), // test configuration
    schedule: jsonb("schedule").notNull(), // schedule configuration
    alerts: jsonb("alerts").notNull(), // alert configuration
    thresholds: jsonb("thresholds").default({}), // performance thresholds
    status: varchar("status", { length: 20 }).notNull().default("active"), // active, paused, stopped, error
    lastRun: timestamp("last_run"),
    nextRun: timestamp("next_run"),
    runCount: integer("run_count").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("scheduled_tests_user_id_idx").on(table.userId),
    dataSourceIdIdx: index("scheduled_tests_data_source_id_idx").on(
      table.dataSourceId,
    ),
    testTypeIdx: index("scheduled_tests_test_type_idx").on(table.testType),
    statusIdx: index("scheduled_tests_status_idx").on(table.status),
    nextRunIdx: index("scheduled_tests_next_run_idx").on(table.nextRun),
  }),
);

// Test results table
export const testResults = pgTable(
  "test_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    testId: uuid("test_id")
      .notNull()
      .references(() => scheduledTests.id, { onDelete: "cascade" }),
    runId: uuid("run_id").notNull(),
    startTime: timestamp("start_time").notNull(),
    endTime: timestamp("end_time").notNull(),
    duration: integer("duration").notNull(), // milliseconds
    success: boolean("success").notNull(),
    metrics: jsonb("metrics").default({}), // performance metrics
    results: jsonb("results"), // test results data
    error: text("error"),
    alertsTriggered: jsonb("alerts_triggered").default([]),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    testIdIdx: index("test_results_test_id_idx").on(table.testId),
    runIdIdx: index("test_results_run_id_idx").on(table.runId),
    startTimeIdx: index("test_results_start_time_idx").on(table.startTime),
    successIdx: index("test_results_success_idx").on(table.success),
  }),
);

// Notification logs table
export const notificationLogs = pgTable(
  "notification_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    testId: uuid("test_id").references(() => scheduledTests.id, {
      onDelete: "cascade",
    }),
    channelId: varchar("channel_id", { length: 255 }),
    type: varchar("type", { length: 50 }).notNull(), // email, sms, slack, webhook, voice
    recipient: varchar("recipient", { length: 500 }).notNull(),
    subject: varchar("subject", { length: 500 }),
    message: text("message").notNull(),
    status: varchar("status", { length: 20 }).notNull(), // sent, failed, pending, retry
    attempt: integer("attempt").default(1),
    sentAt: timestamp("sent_at"),
    error: text("error"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    testIdIdx: index("notification_logs_test_id_idx").on(table.testId),
    typeIdx: index("notification_logs_type_idx").on(table.type),
    statusIdx: index("notification_logs_status_idx").on(table.status),
    sentAtIdx: index("notification_logs_sent_at_idx").on(table.sentAt),
  }),
);

// Saved queries table
export const savedQueries = pgTable(
  "saved_queries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dataSourceId: uuid("data_source_id")
      .notNull()
      .references(() => dataSources.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    query: text("query").notNull(),
    parameters: jsonb("parameters").default({}),
    lastExecuted: timestamp("last_executed"),
    avgExecutionTime: integer("avg_execution_time"), // milliseconds
    executionCount: integer("execution_count").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("saved_queries_user_id_idx").on(table.userId),
    dataSourceIdIdx: index("saved_queries_data_source_id_idx").on(
      table.dataSourceId,
    ),
  }),
);

// Saved API endpoints table
export const savedEndpoints = pgTable(
  "saved_endpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dataSourceId: uuid("data_source_id")
      .notNull()
      .references(() => dataSources.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    method: varchar("method", { length: 10 }).notNull(), // GET, POST, PUT, DELETE, PATCH
    path: varchar("path", { length: 1000 }).notNull(),
    headers: jsonb("headers").default({}),
    body: jsonb("body"),
    queryParams: jsonb("query_params").default({}),
    lastTested: timestamp("last_tested"),
    avgResponseTime: integer("avg_response_time"), // milliseconds
    testCount: integer("test_count").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("saved_endpoints_user_id_idx").on(table.userId),
    dataSourceIdIdx: index("saved_endpoints_data_source_id_idx").on(
      table.dataSourceId,
    ),
    methodIdx: index("saved_endpoints_method_idx").on(table.method),
  }),
);

// Reports table
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    testId: uuid("test_id").references(() => scheduledTests.id, {
      onDelete: "cascade",
    }),
    type: varchar("type", { length: 50 }).notNull(), // security, performance, general, penetration
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    content: jsonb("content").notNull(), // report data
    pdfPath: varchar("pdf_path", { length: 500 }),
    status: varchar("status", { length: 20 }).notNull().default("generating"), // generating, completed, failed
    sharedAt: timestamp("shared_at"),
    sharedWith: jsonb("shared_with").default([]), // emails, slack channels, etc.
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("reports_user_id_idx").on(table.userId),
    testIdIdx: index("reports_test_id_idx").on(table.testId),
    typeIdx: index("reports_type_idx").on(table.type),
    statusIdx: index("reports_status_idx").on(table.status),
  }),
);

// API endpoints table
export const apiEndpoints = pgTable(
  "api_endpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    baseUrl: varchar("base_url", { length: 1000 }).notNull(),
    version: varchar("version", { length: 50 }).notNull(),
    authentication: jsonb("authentication").notNull(), // type, config
    headers: jsonb("headers").default({}),
    rateLimit: jsonb("rate_limit"), // requests, window, burst
    timeout: integer("timeout").default(30000),
    retryConfig: jsonb("retry_config"), // attempts, delay, backoff
    healthCheck: jsonb("health_check"), // endpoint, method, expectedStatus, interval
    documentation: jsonb("documentation"), // openApiSpec, postmanCollection, customDocs
    tags: jsonb("tags").default([]),
    isActive: boolean("is_active").default(true),
    lastHealthCheck: timestamp("last_health_check"),
    healthStatus: varchar("health_status", { length: 20 }).default("unknown"), // healthy, degraded, down, unknown
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("api_endpoints_user_id_idx").on(table.userId),
    baseUrlIdx: index("api_endpoints_base_url_idx").on(table.baseUrl),
    isActiveIdx: index("api_endpoints_is_active_idx").on(table.isActive),
    healthStatusIdx: index("api_endpoints_health_status_idx").on(
      table.healthStatus,
    ),
  }),
);

// API calls table
export const apiCalls = pgTable(
  "api_calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    endpointId: uuid("endpoint_id")
      .notNull()
      .references(() => apiEndpoints.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    method: varchar("method", { length: 10 }).notNull(),
    path: varchar("path", { length: 1000 }).notNull(),
    headers: jsonb("headers").default({}),
    queryParams: jsonb("query_params").default({}),
    body: jsonb("body"),
    responseStatus: integer("response_status"),
    responseHeaders: jsonb("response_headers").default({}),
    responseBody: jsonb("response_body"),
    responseTime: integer("response_time"), // milliseconds
    success: boolean("success").notNull(),
    error: text("error"),
    validationResults: jsonb("validation_results").default([]),
    transformedData: jsonb("transformed_data"),
    executedAt: timestamp("executed_at").defaultNow(),
  },
  (table) => ({
    endpointIdIdx: index("api_calls_endpoint_id_idx").on(table.endpointId),
    userIdIdx: index("api_calls_user_id_idx").on(table.userId),
    methodIdx: index("api_calls_method_idx").on(table.method),
    successIdx: index("api_calls_success_idx").on(table.success),
    executedAtIdx: index("api_calls_executed_at_idx").on(table.executedAt),
  }),
);

// Webhook endpoints table
export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    url: varchar("url", { length: 1000 }).notNull(),
    events: jsonb("events").notNull(), // array of event names
    secret: varchar("secret", { length: 255 }).notNull(),
    headers: jsonb("headers").default({}),
    authentication: jsonb("authentication"), // type, config
    retryPolicy: jsonb("retry_policy").notNull(), // attempts, delay, exponentialBackoff
    filters: jsonb("filters"), // conditions, operator
    transformation: jsonb("transformation"), // transformation rules
    isActive: boolean("is_active").default(true),
    lastTriggered: timestamp("last_triggered"),
    successCount: integer("success_count").default(0),
    failureCount: integer("failure_count").default(0),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("webhook_endpoints_user_id_idx").on(table.userId),
    urlIdx: index("webhook_endpoints_url_idx").on(table.url),
    isActiveIdx: index("webhook_endpoints_is_active_idx").on(table.isActive),
  }),
);

// Webhook deliveries table
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    webhookId: uuid("webhook_id")
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: "cascade" }),
    event: varchar("event", { length: 100 }).notNull(),
    payload: jsonb("payload").notNull(),
    response: jsonb("response"),
    responseStatus: integer("response_status"),
    responseTime: integer("response_time"), // milliseconds
    attempt: integer("attempt").default(1),
    success: boolean("success").notNull(),
    error: text("error"),
    deliveredAt: timestamp("delivered_at").defaultNow(),
  },
  (table) => ({
    webhookIdIdx: index("webhook_deliveries_webhook_id_idx").on(
      table.webhookId,
    ),
    eventIdx: index("webhook_deliveries_event_idx").on(table.event),
    successIdx: index("webhook_deliveries_success_idx").on(table.success),
    deliveredAtIdx: index("webhook_deliveries_delivered_at_idx").on(
      table.deliveredAt,
    ),
  }),
);

// External integrations table
export const externalIntegrations = pgTable(
  "external_integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    type: varchar("type", { length: 50 }).notNull(), // webhook, polling, streaming, batch
    provider: varchar("provider", { length: 100 }).notNull(), // github, slack, jira, etc.
    config: jsonb("config").notNull(), // endpoints, authentication, schedule, etc.
    dataMappings: jsonb("data_mappings").default([]), // field mappings
    errorHandling: jsonb("error_handling").notNull(), // retry policy, failure webhook, alert channels
    monitoring: jsonb("monitoring").notNull(), // health check interval, thresholds, alert conditions
    isActive: boolean("is_active").default(true),
    lastSync: timestamp("last_sync"),
    syncStats: jsonb("sync_stats").default({}), // totalRecords, successfulRecords, failedRecords, lastError
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("external_integrations_user_id_idx").on(table.userId),
    typeIdx: index("external_integrations_type_idx").on(table.type),
    providerIdx: index("external_integrations_provider_idx").on(table.provider),
    isActiveIdx: index("external_integrations_is_active_idx").on(
      table.isActive,
    ),
  }),
);

// API analytics table
export const apiAnalytics = pgTable(
  "api_analytics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    endpointId: uuid("endpoint_id")
      .notNull()
      .references(() => apiEndpoints.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: timestamp("date").notNull(), // date bucket (hour, day, etc.)
    requestCount: integer("request_count").default(0),
    successCount: integer("success_count").default(0),
    errorCount: integer("error_count").default(0),
    totalResponseTime: integer("total_response_time").default(0), // sum for average calculation
    minResponseTime: integer("min_response_time"),
    maxResponseTime: integer("max_response_time"),
    statusCodes: jsonb("status_codes").default({}), // count by status code
    errorTypes: jsonb("error_types").default({}), // count by error type
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    endpointIdDateIdx: unique("api_analytics_endpoint_date_unique").on(
      table.endpointId,
      table.date,
    ),
    userIdIdx: index("api_analytics_user_id_idx").on(table.userId),
    dateIdx: index("api_analytics_date_idx").on(table.date),
  }),
);

// Data transformation rules table
export const transformationRules = pgTable(
  "transformation_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    type: varchar("type", { length: 50 }).notNull(), // map, filter, aggregate, custom
    sourceField: varchar("source_field", { length: 500 }),
    targetField: varchar("target_field", { length: 500 }),
    function: text("function"), // custom transformation function
    parameters: jsonb("parameters").default({}),
    isActive: boolean("is_active").default(true),
    usageCount: integer("usage_count").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("transformation_rules_user_id_idx").on(table.userId),
    typeIdx: index("transformation_rules_type_idx").on(table.type),
    isActiveIdx: index("transformation_rules_is_active_idx").on(table.isActive),
  }),
);

// Enhanced test cases table - Add enterprise features
export const enhancedTestCases = pgTable(
  "enhanced_test_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    testCaseId: uuid("test_case_id")
      .notNull()
      .references(() => testCases.id, { onDelete: "cascade" }),

    // AI enhancements
    aiGenerated: boolean("ai_generated").default(false),
    aiConfidence: varchar("ai_confidence", { length: 10 }),
    aiSuggestions: jsonb("ai_suggestions").default([]),
    smartSelectors: jsonb("smart_selectors").default([]),

    // Advanced assertions
    visualAssertions: jsonb("visual_assertions").default([]),
    performanceAssertions: jsonb("performance_assertions").default([]),
    accessibilityAssertions: jsonb("accessibility_assertions").default([]),

    // Test data management
    parameterization: jsonb("parameterization").default({}),
    testDataSets: jsonb("test_data_sets").default([]),
    dataValidationRules: jsonb("data_validation_rules").default([]),

    // Cross-browser/device testing
    browserMatrix: jsonb("browser_matrix").default([]),
    deviceMatrix: jsonb("device_matrix").default([]),

    // Integration metadata
    apiEndpoints: jsonb("api_endpoints").default([]),
    databaseQueries: jsonb("database_queries").default([]),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    testCaseIdIdx: index("enhanced_test_cases_test_case_id_idx").on(
      table.testCaseId,
    ),
    aiGeneratedIdx: index("enhanced_test_cases_ai_generated_idx").on(
      table.aiGenerated,
    ),
  }),
);

// API test cases table - Dedicated API testing
export const apiTestCases = pgTable(
  "api_test_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Test metadata
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),

    // API details
    method: varchar("method", { length: 10 }).notNull(),
    endpoint: varchar("endpoint", { length: 1000 }).notNull(),
    headers: jsonb("headers").default({}),
    queryParams: jsonb("query_params").default({}),
    requestBody: jsonb("request_body"),

    // Validation rules
    statusCodeValidation: jsonb("status_code_validation").notNull(),
    responseSchemaValidation: jsonb("response_schema_validation"),
    responseTimeValidation: jsonb("response_time_validation"),
    customValidations: jsonb("custom_validations").default([]),

    // Test configuration
    retryConfig: jsonb("retry_config").default({}),
    timeoutMs: integer("timeout_ms").default(30000),

    // Dependencies and prerequisites
    prerequisites: jsonb("prerequisites").default([]),
    dependencies: jsonb("dependencies").default([]),

    // Tags and organization
    tags: jsonb("tags").default([]),
    category: varchar("category", { length: 100 }),
    priority: varchar("priority", { length: 20 }).default("medium"),

    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    projectIdIdx: index("api_test_cases_project_id_idx").on(table.projectId),
    userIdIdx: index("api_test_cases_user_id_idx").on(table.userId),
    methodIdx: index("api_test_cases_method_idx").on(table.method),
    categoryIdx: index("api_test_cases_category_idx").on(table.category),
    priorityIdx: index("api_test_cases_priority_idx").on(table.priority),
  }),
);

// Database connections table - MOVED HERE to resolve ESM forward reference
export const databaseConnections = pgTable(
  "database_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),

    // Connection details
    name: varchar("name", { length: 255 }).notNull(),
    type: varchar("type", { length: 20 }).notNull(), // postgresql, mysql, mongodb, redis
    host: varchar("host", { length: 255 }).notNull(),
    port: integer("port").notNull(),
    database: varchar("database", { length: 255 }).notNull(),
    username: varchar("username", { length: 255 }).notNull(),
    password: varchar("password", { length: 500 }), // encrypted

    // Connection configuration
    ssl: boolean("ssl").default(false),
    connectionTimeout: integer("connection_timeout").default(30000),
    maxConnections: integer("max_connections").default(10),
    additionalConfig: jsonb("additional_config").default({}),

    // Status and monitoring
    status: varchar("status", { length: 20 }).notNull().default("disconnected"), // connected, disconnected, error
    lastHealthCheck: timestamp("last_health_check"),
    healthCheckInterval: integer("health_check_interval").default(60000), // milliseconds

    // Usage tracking
    testCasesCount: integer("test_cases_count").default(0),
    lastUsed: timestamp("last_used"),

    // Tags and organization
    tags: jsonb("tags").default([]),
    environment: varchar("environment", { length: 50 }).default("development"), // development, staging, production

    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("database_connections_user_id_idx").on(table.userId),
    projectIdIdx: index("database_connections_project_id_idx").on(
      table.projectId,
    ),
    typeIdx: index("database_connections_type_idx").on(table.type),
    statusIdx: index("database_connections_status_idx").on(table.status),
    environmentIdx: index("database_connections_environment_idx").on(
      table.environment,
    ),
    isActiveIdx: index("database_connections_is_active_idx").on(table.isActive),
  }),
);

// Database test cases table - Database testing capabilities
export const databaseTestCases = pgTable(
  "database_test_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => databaseConnections.id, { onDelete: "cascade" }),

    // Test metadata
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    testType: varchar("test_type", { length: 50 }).notNull(), // data-integrity, performance, security, migration

    // Database operations
    setupQueries: jsonb("setup_queries").default([]),
    testQueries: jsonb("test_queries").notNull(),
    teardownQueries: jsonb("teardown_queries").default([]),

    // Validation rules
    dataValidations: jsonb("data_validations").default([]),
    constraintValidations: jsonb("constraint_validations").default([]),
    performanceThresholds: jsonb("performance_thresholds").default({}),

    // Transaction management
    useTransaction: boolean("use_transaction").default(true),
    isolationLevel: varchar("isolation_level", { length: 20 }).default(
      "READ_COMMITTED",
    ),

    // Scheduling and automation
    schedule: jsonb("schedule"),
    isScheduled: boolean("is_scheduled").default(false),

    // Tags and organization
    tags: jsonb("tags").default([]),
    category: varchar("category", { length: 100 }),
    priority: varchar("priority", { length: 20 }).default("medium"),

    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    projectIdIdx: index("database_test_cases_project_id_idx").on(
      table.projectId,
    ),
    userIdIdx: index("database_test_cases_user_id_idx").on(table.userId),
    connectionIdIdx: index("database_test_cases_connection_id_idx").on(
      table.connectionId,
    ),
    testTypeIdx: index("database_test_cases_test_type_idx").on(table.testType),
    isScheduledIdx: index("database_test_cases_is_scheduled_idx").on(
      table.isScheduled,
    ),
  }),
);

// Test execution environments table - Environment management
export const testExecutionEnvironments = pgTable(
  "test_execution_environments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Environment metadata
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    type: varchar("type", { length: 50 }).notNull(), // local, cloud, hybrid

    // Environment configuration
    browserConfig: jsonb("browser_config").default({}),
    deviceConfig: jsonb("device_config").default({}),
    networkConfig: jsonb("network_config").default({}),

    // Cloud provider settings
    cloudProvider: varchar("cloud_provider", { length: 50 }), // browserstack, saucelabs, lambdatest
    cloudCredentials: jsonb("cloud_credentials"),

    // Environment variables and settings
    environmentVariables: jsonb("environment_variables").default({}),
    customSettings: jsonb("custom_settings").default({}),

    // Status and health
    status: varchar("status", { length: 20 }).default("inactive"), // active, inactive, error, maintenance
    lastHealthCheck: timestamp("last_health_check"),
    healthStatus: jsonb("health_status").default({}),

    isDefault: boolean("is_default").default(false),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    projectIdIdx: index("test_execution_environments_project_id_idx").on(
      table.projectId,
    ),
    userIdIdx: index("test_execution_environments_user_id_idx").on(
      table.userId,
    ),
    typeIdx: index("test_execution_environments_type_idx").on(table.type),
    statusIdx: index("test_execution_environments_status_idx").on(table.status),
    cloudProviderIdx: index(
      "test_execution_environments_cloud_provider_idx",
    ).on(table.cloudProvider),
  }),
);

// Advanced analytics table - Enhanced metrics and insights
export const advancedAnalytics = pgTable(
  "advanced_analytics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),

    // Time bucket
    date: timestamp("date").notNull(),
    granularity: varchar("granularity", { length: 10 }).notNull(), // hour, day, week, month

    // Test execution metrics
    totalTests: integer("total_tests").default(0),
    passedTests: integer("passed_tests").default(0),
    failedTests: integer("failed_tests").default(0),
    skippedTests: integer("skipped_tests").default(0),

    // Performance metrics
    avgExecutionTime: integer("avg_execution_time").default(0),
    minExecutionTime: integer("min_execution_time"),
    maxExecutionTime: integer("max_execution_time"),

    // Quality metrics
    testCoverage: decimal("test_coverage", { precision: 5, scale: 2 }),
    codeQualityScore: decimal("code_quality_score", { precision: 5, scale: 2 }),
    bugDetectionRate: decimal("bug_detection_rate", { precision: 5, scale: 2 }),

    // AI metrics
    aiGeneratedTests: integer("ai_generated_tests").default(0),
    aiSuggestionAccuracy: decimal("ai_suggestion_accuracy", {
      precision: 5,
      scale: 2,
    }),

    // Platform distribution
    browserDistribution: jsonb("browser_distribution").default({}),
    deviceDistribution: jsonb("device_distribution").default({}),
    platformDistribution: jsonb("platform_distribution").default({}),

    // Integration metrics
    apiTestCount: integer("api_test_count").default(0),
    databaseTestCount: integer("database_test_count").default(0),
    pluginUsageCount: integer("plugin_usage_count").default(0),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdDateIdx: unique("advanced_analytics_user_date_granularity_unique").on(
      table.userId,
      table.date,
      table.granularity,
    ),
    projectIdIdx: index("advanced_analytics_project_id_idx").on(
      table.projectId,
    ),
    dateIdx: index("advanced_analytics_date_idx").on(table.date),
    granularityIdx: index("advanced_analytics_granularity_idx").on(
      table.granularity,
    ),
  }),
);

// Security audit logs table - Compliance and security tracking
export const securityAuditLogs = pgTable(
  "security_audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    // Event details
    eventType: varchar("event_type", { length: 100 }).notNull(), // login, logout, data_access, permission_change, etc.
    eventCategory: varchar("event_category", { length: 50 }).notNull(), // authentication, authorization, data, system
    severity: varchar("severity", { length: 20 }).notNull(), // low, medium, high, critical

    // Event metadata
    description: text("description").notNull(),
    resourceType: varchar("resource_type", { length: 100 }), // user, project, test_case, plugin, etc.
    resourceId: uuid("resource_id"),

    // Request context
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    sessionId: varchar("session_id", { length: 255 }),

    // Additional data
    metadata: jsonb("metadata").default({}),

    // Status
    status: varchar("status", { length: 20 }).notNull(), // success, failure, blocked

    timestamp: timestamp("timestamp").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("security_audit_logs_user_id_idx").on(table.userId),
    eventTypeIdx: index("security_audit_logs_event_type_idx").on(
      table.eventType,
    ),
    eventCategoryIdx: index("security_audit_logs_event_category_idx").on(
      table.eventCategory,
    ),
    severityIdx: index("security_audit_logs_severity_idx").on(table.severity),
    timestampIdx: index("security_audit_logs_timestamp_idx").on(
      table.timestamp,
    ),
    statusIdx: index("security_audit_logs_status_idx").on(table.status),
  }),
);

// Phase 4: Database Testing System Tables
// Note: databaseConnections is defined earlier in this file to resolve ESM forward reference

// Database test results table
export const databaseTestResults = pgTable(
  "database_test_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    testCaseId: uuid("test_case_id")
      .notNull()
      .references(() => databaseTestCases.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => databaseConnections.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Execution details
    startTime: timestamp("start_time").notNull(),
    endTime: timestamp("end_time").notNull(),
    duration: integer("duration").notNull(), // milliseconds
    status: varchar("status", { length: 20 }).notNull(), // passed, failed, error

    // Results
    queryResults: jsonb("query_results").default([]),
    validationResults: jsonb("validation_results").default([]),

    // Performance metrics
    totalExecutionTime: integer("total_execution_time").notNull(),
    queryCount: integer("query_count").notNull(),
    averageQueryTime: decimal("average_query_time", {
      precision: 10,
      scale: 2,
    }),
    memoryUsage: integer("memory_usage"), // bytes
    cpuUsage: decimal("cpu_usage", { precision: 5, scale: 2 }), // percentage
    diskIO: integer("disk_io"), // bytes

    // Error handling
    error: text("error"),
    stackTrace: text("stack_trace"),

    // Execution logs and artifacts
    executionLogs: jsonb("execution_logs").default([]),
    dataSnapshots: jsonb("data_snapshots").default([]),

    // Trigger context
    triggeredBy: varchar("triggered_by", { length: 20 }).default("manual"), // manual, scheduled, api, webhook
    triggerMetadata: jsonb("trigger_metadata").default({}),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    testCaseIdIdx: index("database_test_results_test_case_id_idx").on(
      table.testCaseId,
    ),
    connectionIdIdx: index("database_test_results_connection_id_idx").on(
      table.connectionId,
    ),
    userIdIdx: index("database_test_results_user_id_idx").on(table.userId),
    statusIdx: index("database_test_results_status_idx").on(table.status),
    startTimeIdx: index("database_test_results_start_time_idx").on(
      table.startTime,
    ),
    durationIdx: index("database_test_results_duration_idx").on(table.duration),
  }),
);

// Database schema versions table - Track database schema changes
export const databaseSchemaVersions = pgTable(
  "database_schema_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => databaseConnections.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Version information
    version: varchar("version", { length: 100 }).notNull(),
    description: text("description"),

    // Schema snapshot
    schemaSnapshot: jsonb("schema_snapshot").notNull(), // complete schema structure
    tablesSnapshot: jsonb("tables_snapshot").notNull(), // table definitions
    constraintsSnapshot: jsonb("constraints_snapshot").notNull(), // constraints
    indexesSnapshot: jsonb("indexes_snapshot").notNull(), // indexes

    // Change tracking
    changesFromPrevious: jsonb("changes_from_previous").default([]), // differences from previous version
    migrationQueries: jsonb("migration_queries").default([]), // queries to apply this version
    rollbackQueries: jsonb("rollback_queries").default([]), // queries to rollback this version

    // Validation
    isValidated: boolean("is_validated").default(false),
    validationResults: jsonb("validation_results").default([]),

    // Status
    isActive: boolean("is_active").default(true),
    tags: jsonb("tags").default([]),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    connectionIdIdx: index("database_schema_versions_connection_id_idx").on(
      table.connectionId,
    ),
    userIdIdx: index("database_schema_versions_user_id_idx").on(table.userId),
    versionIdx: index("database_schema_versions_version_idx").on(table.version),
    isValidatedIdx: index("database_schema_versions_is_validated_idx").on(
      table.isValidated,
    ),
    isActiveIdx: index("database_schema_versions_is_active_idx").on(
      table.isActive,
    ),
  }),
);

// ==========================================
// SECURITY CENTER TABLES
// ==========================================

// Security Scans
export const securityScans = pgTable(
  "security_scans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    target: varchar("target", { length: 2000 }).notNull(),
    scanType: varchar("scan_type", { length: 50 }).notNull(), // full, owasp, quick, custom
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, running, completed, failed
    startTime: timestamp("start_time"),
    endTime: timestamp("end_time"),
    duration: integer("duration"), // seconds
    summary: jsonb("summary").default({}), // totalFindings, critical, high, medium, low
    config: jsonb("config").default({}), // scan configuration
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("security_scans_user_id_idx").on(table.userId),
    projectIdIdx: index("security_scans_project_id_idx").on(table.projectId),
    statusIdx: index("security_scans_status_idx").on(table.status),
    scanTypeIdx: index("security_scans_scan_type_idx").on(table.scanType),
    startTimeIdx: index("security_scans_start_time_idx").on(table.startTime),
  }),
);

// Security Findings
export const securityFindings = pgTable(
  "security_findings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => securityScans.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    severity: varchar("severity", { length: 20 }).notNull(), // critical, high, medium, low, info
    category: varchar("category", { length: 100 }), // OWASP category or custom
    cvssScore: decimal("cvss_score", { precision: 3, scale: 1 }),
    location: varchar("location", { length: 1000 }), // URL, file path, etc.
    evidence: text("evidence"),
    recommendation: text("recommendation"),
    cveId: varchar("cve_id", { length: 50 }),
    status: varchar("status", { length: 20 }).notNull().default("open"), // open, fixed, ignored, false_positive
    fixedAt: timestamp("fixed_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    scanIdIdx: index("security_findings_scan_id_idx").on(table.scanId),
    severityIdx: index("security_findings_severity_idx").on(table.severity),
    categoryIdx: index("security_findings_category_idx").on(table.category),
    statusIdx: index("security_findings_status_idx").on(table.status),
  }),
);

// Compliance Frameworks
export const complianceFrameworks = pgTable(
  "compliance_frameworks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    frameworkType: varchar("framework_type", { length: 50 }).notNull(), // soc2, gdpr, hipaa, pci
    name: varchar("name", { length: 255 }).notNull(),
    overallScore: integer("overall_score").default(0),
    lastAssessment: timestamp("last_assessment"),
    controls: jsonb("controls").default([]), // array of control statuses
    evidence: jsonb("evidence").default([]), // evidence documents
    nextAssessment: timestamp("next_assessment"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("compliance_frameworks_user_id_idx").on(table.userId),
    frameworkTypeIdx: index("compliance_frameworks_type_idx").on(table.frameworkType),
  }),
);

// ==========================================
// CLOUD DEVICE HUB TABLES
// ==========================================

// Cloud Device Providers
export const cloudDeviceProviders = pgTable(
  "cloud_device_providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerType: varchar("provider_type", { length: 50 }).notNull(), // browserstack, saucelabs, lambdatest, local
    name: varchar("name", { length: 255 }).notNull(),
    config: jsonb("config").default({}), // encrypted credentials, API keys
    isConnected: boolean("is_connected").default(false),
    deviceCount: integer("device_count").default(0),
    lastSyncAt: timestamp("last_sync_at"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("cloud_device_providers_user_id_idx").on(table.userId),
    providerTypeIdx: index("cloud_device_providers_type_idx").on(table.providerType),
    isConnectedIdx: index("cloud_device_providers_connected_idx").on(table.isConnected),
  }),
);

// Cloud Devices
export const cloudDevices = pgTable(
  "cloud_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => cloudDeviceProviders.id, { onDelete: "cascade" }),
    externalId: varchar("external_id", { length: 255 }), // provider's device ID
    name: varchar("name", { length: 255 }).notNull(),
    platform: varchar("platform", { length: 20 }).notNull(), // ios, android
    model: varchar("model", { length: 255 }).notNull(),
    osVersion: varchar("os_version", { length: 50 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("available"), // available, busy, offline, maintenance
    location: jsonb("location").default({}), // type, region
    capabilities: jsonb("capabilities").default({}), // screenshots, video, network simulation
    tags: jsonb("tags").default([]),
    lastSeenAt: timestamp("last_seen_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    providerIdIdx: index("cloud_devices_provider_id_idx").on(table.providerId),
    platformIdx: index("cloud_devices_platform_idx").on(table.platform),
    statusIdx: index("cloud_devices_status_idx").on(table.status),
    externalIdIdx: index("cloud_devices_external_id_idx").on(table.externalId),
  }),
);

// Cloud Device Reservations
export const cloudDeviceReservations = pgTable(
  "cloud_device_reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => cloudDevices.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    startTime: timestamp("start_time").notNull(),
    endTime: timestamp("end_time").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("scheduled"), // scheduled, active, completed, cancelled
    purpose: text("purpose"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    deviceIdIdx: index("cloud_device_reservations_device_id_idx").on(table.deviceId),
    userIdIdx: index("cloud_device_reservations_user_id_idx").on(table.userId),
    statusIdx: index("cloud_device_reservations_status_idx").on(table.status),
    startTimeIdx: index("cloud_device_reservations_start_time_idx").on(table.startTime),
  }),
);

// ==========================================
// API CONNECTOR TABLES
// ==========================================

// API Connectors Table
export const apiConnectors = pgTable(
  "api_connectors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 255 }).notNull(),
    language: varchar("language", { length: 50 }).notNull(),
    runtime: varchar("runtime", { length: 50 }),
    code: text("code"),
    types: text("types"),
    config: text("config"),
    tests: text("tests"),
    documentation: text("documentation"),
    metadata: jsonb("metadata").default({}),
    status: varchar("status", { length: 20 }).default("draft"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("api_connectors_user_id_idx").on(table.userId),
    projectIdIdx: index("api_connectors_project_id_idx").on(table.projectId),
    statusIdx: index("api_connectors_status_idx").on(table.status),
  })
);

// Connector Jobs Table
export const connectorJobs = pgTable(
  "connector_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    connectorName: varchar("connector_name", { length: 255 }),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    type: varchar("type", { length: 50 }).notNull(),
    result: text("result"), // JSON stringified result
    error: text("error"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("connector_jobs_user_id_idx").on(table.userId),
    statusIdx: index("connector_jobs_status_idx").on(table.status),
  })
);

// ==========================================
// SSO / ENTERPRISE AUTH TABLES
// ==========================================

// SSO Configuration Table
export const ssoConfigs = pgTable(
  "sso_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    providerType: varchar("provider_type", { length: 50 }).notNull(), // azure_ad, okta, google, saml_generic, oidc_generic
    enabled: boolean("enabled").default(true),

    // OIDC/OAuth Config
    clientId: varchar("client_id", { length: 255 }),
    clientSecret: text("client_secret"),
    authorizationUrl: varchar("authorization_url", { length: 500 }),
    tokenUrl: varchar("token_url", { length: 500 }),
    userInfoUrl: varchar("user_info_url", { length: 500 }),
    redirectUris: text("redirect_uris"), // JSON array
    scopes: text("scopes"), // JSON array

    // SAML Config
    entryPoint: varchar("entry_point", { length: 500 }),
    issuer: varchar("issuer", { length: 255 }),
    cert: text("cert"),
    privateKey: text("private_key"),
    identifierFormat: varchar("identifier_format", { length: 255 }),

    // Claim/Attribute Mapping
    emailClaim: varchar("email_claim", { length: 255 }).default("email"),
    nameClaim: varchar("name_claim", { length: 255 }).default("name"),
    groupsClaim: varchar("groups_claim", { length: 255 }).default("groups"),
    customAttributes: jsonb("custom_attributes").default({}),

    // Group/Role Mapping
    groupMappings: jsonb("group_mappings").default({}),
    autoProvision: boolean("auto_provision").default(true),
    autoAssignRole: varchar("auto_assign_role", { length: 50 }).default("user"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("sso_configs_org_id_idx").on(table.organizationId),
    providerIdx: index("sso_configs_provider_idx").on(table.providerType),
  })
);

// SSO Session Table
export const ssoSessions = pgTable(
  "sso_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").notNull(),
    providerType: varchar("provider_type", { length: 50 }).notNull(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("sso_sessions_user_id_idx").on(table.userId),
    orgIdIdx: index("sso_sessions_org_id_idx").on(table.organizationId),
    providerIdx: index("sso_sessions_provider_idx").on(table.providerType),
    expiresAtIdx: index("sso_sessions_expires_at_idx").on(table.expiresAt),
  })
);

// Export all schemas
export const schema = {
  users,
  teams,
  teamMembers,
  oauthAccounts,
  projects,
  recordingSessions,
  recordedActions,
  testSuites,
  testCases,
  testRuns,
  integrations,
  apiKeys,
  usageAnalytics,
  dataSources,
  scheduledTests,
  testResults,
  notificationLogs,
  savedQueries,
  savedEndpoints,
  reports,
  apiEndpoints,
  apiCalls,
  webhookEndpoints,
  webhookDeliveries,
  externalIntegrations,
  apiAnalytics,
  transformationRules,

  // Plugin System Tables
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

  // Voice System Tables
  voiceRecordings,
  voiceCommands,
  voiceCommandHistory,
  voiceAnnotations,
  voicePreferences,
  voiceAnalytics,

  // Enhanced Enterprise Tables
  enhancedTestCases,
  apiTestCases,
  databaseTestCases,
  testExecutionEnvironments,
  advancedAnalytics,
  securityAuditLogs,

  // Phase 4: Database Testing System
  databaseConnections,
  databaseTestResults,
  databaseSchemaVersions,

  // Payment System Tables
  paymentCustomers,
  subscriptions,
  paymentMethods,
  invoices,
  usageMetrics,
  promoCodes,
  promoCodeUsages,
  subscriptionEvents,

  // Backup and Disaster Recovery Tables
  backups,
  recoveryProcedures,
  recoveryExecutions,
  disasterScenarios,
  backupSchedules,
  backupValidations,
  recoveryNotifications,
  backupRetentionPolicies,
  disasterRecoveryDrills,
  backupStorageLocations,
  backupArchiveLogs,
  recoveryMetrics,

  // API Testing Studio Tables
  apiTestingCollections,
  apiTestingRequests,
  apiTestingEnvironments,
  apiTestingHistory,

  // Security Center Tables
  securityScans,
  securityFindings,
  complianceFrameworks,

  // Cloud Device Hub Tables
  cloudDeviceProviders,
  cloudDevices,
  cloudDeviceReservations,

  // API Connector Tables
  apiConnectors,
  connectorJobs,

  // SSO / Enterprise Auth Tables
  ssoConfigs,
  ssoSessions,

  // Visual Regression Tables
  visualBaselines,
  visualTestResults,
  visualDiffRegions,
};

export default schema;

// Re-export payment schema items for direct imports
export { subscriptions } from './payment-schema.js';
