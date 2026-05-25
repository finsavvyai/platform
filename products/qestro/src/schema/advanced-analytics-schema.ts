import {
  sqliteTable,
  text,
  integer,
  real
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { coreSchema } from './core-schema.js';

// Enhanced test cases table - Add enterprise features (SQLite version)
export const enhancedTestCases = sqliteTable('enhanced_test_cases', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  testCaseId: text('test_case_id').notNull().references(() => coreSchema.testCases.id, { onDelete: 'cascade' }),

  // AI enhancements
  aiGenerated: integer('ai_generated', { mode: 'boolean' }).default(false),
  aiConfidence: text('ai_confidence'),
  aiSuggestions: text('ai_suggestions', { mode: 'json' }).$defaultFn(() => '[]'),
  smartSelectors: text('smart_selectors', { mode: 'json' }).$defaultFn(() => '[]'),

  // Advanced assertions
  visualAssertions: text('visual_assertions', { mode: 'json' }).$defaultFn(() => '[]'),
  performanceAssertions: text('performance_assertions', { mode: 'json' }).$defaultFn(() => '[]'),
  accessibilityAssertions: text('accessibility_assertions', { mode: 'json' }).$defaultFn(() => '[]'),

  // Test data management
  parameterization: text('parameterization', { mode: 'json' }).$defaultFn(() => '{}'),
  testDataSets: text('test_data_sets', { mode: 'json' }).$defaultFn(() => '[]'),
  dataValidationRules: text('data_validation_rules', { mode: 'json' }).$defaultFn(() => '[]'),

  // Cross-browser/device testing
  browserMatrix: text('browser_matrix', { mode: 'json' }).$defaultFn(() => '[]'),
  deviceMatrix: text('device_matrix', { mode: 'json' }).$defaultFn(() => '[]'),

  // Integration metadata
  apiEndpoints: text('api_endpoints', { mode: 'json' }).$defaultFn(() => '[]'),
  databaseQueries: text('database_queries', { mode: 'json' }).$defaultFn(() => '[]'),

  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  testCaseIdIdx: sql`CREATE INDEX enhanced_test_cases_test_case_id_idx ON ${table.name} (test_case_id)`,
  aiGeneratedIdx: sql`CREATE INDEX enhanced_test_cases_ai_generated_idx ON ${table.name} (ai_generated)`,
}));

// API test cases table - Dedicated API testing (SQLite version)
export const apiTestCases = sqliteTable('api_test_cases', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => coreSchema.projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),

  // Test metadata
  name: text('name').notNull(),
  description: text('description'),

  // API details
  method: text('method').notNull(),
  endpoint: text('endpoint').notNull(),
  headers: text('headers', { mode: 'json' }).$defaultFn(() => '{}'),
  queryParams: text('query_params', { mode: 'json' }).$defaultFn(() => '{}'),
  requestBody: text('request_body', { mode: 'json' }),

  // Validation rules
  statusCodeValidation: text('status_code_validation', { mode: 'json' }).notNull(),
  responseSchemaValidation: text('response_schema_validation', { mode: 'json' }),
  responseTimeValidation: text('response_time_validation', { mode: 'json' }),
  customValidations: text('custom_validations', { mode: 'json' }).$defaultFn(() => '[]'),

  // Test configuration
  retryConfig: text('retry_config', { mode: 'json' }).$defaultFn(() => '{}'),
  timeoutMs: integer('timeout_ms').default(30000),

  // Dependencies and prerequisites
  prerequisites: text('prerequisites', { mode: 'json' }).$defaultFn(() => '[]'),
  dependencies: text('dependencies', { mode: 'json' }).$defaultFn(() => '[]'),

  // Tags and organization
  tags: text('tags', { mode: 'json' }).$defaultFn(() => '[]'),
  category: text('category'),
  priority: text('priority').default('medium'),

  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  projectIdIdx: sql`CREATE INDEX api_test_cases_project_id_idx ON ${table.name} (project_id)`,
  userIdIdx: sql`CREATE INDEX api_test_cases_user_id_idx ON ${table.name} (user_id)`,
  methodIdx: sql`CREATE INDEX api_test_cases_method_idx ON ${table.name} (method)`,
  categoryIdx: sql`CREATE INDEX api_test_cases_category_idx ON ${table.name} (category)`,
  priorityIdx: sql`CREATE INDEX api_test_cases_priority_idx ON ${table.name} (priority)`,
}));

// Test execution environments table - Environment management (SQLite version)
export const testExecutionEnvironments = sqliteTable('test_execution_environments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => coreSchema.projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),

  // Environment metadata
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').notNull(), // local, cloud, hybrid

  // Environment configuration
  browserConfig: text('browser_config', { mode: 'json' }).$defaultFn(() => '{}'),
  deviceConfig: text('device_config', { mode: 'json' }).$defaultFn(() => '{}'),
  networkConfig: text('network_config', { mode: 'json' }).$defaultFn(() => '{}'),

  // Cloud provider settings
  cloudProvider: text('cloud_provider'), // browserstack, saucelabs, lambdatest
  cloudCredentials: text('cloud_credentials', { mode: 'json' }),

  // Environment variables and settings
  environmentVariables: text('environment_variables', { mode: 'json' }).$defaultFn(() => '{}'),
  customSettings: text('custom_settings', { mode: 'json' }).$defaultFn(() => '{}'),

  // Status and health
  status: text('status').default('inactive'), // active, inactive, error, maintenance
  lastHealthCheck: integer('last_health_check', { mode: 'timestamp' }),
  healthStatus: text('health_status', { mode: 'json' }).$defaultFn(() => '{}'),

  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  projectIdIdx: sql`CREATE INDEX test_execution_environments_project_id_idx ON ${table.name} (project_id)`,
  userIdIdx: sql`CREATE INDEX test_execution_environments_user_id_idx ON ${table.name} (user_id)`,
  typeIdx: sql`CREATE INDEX test_execution_environments_type_idx ON ${table.name} (type)`,
  statusIdx: sql`CREATE INDEX test_execution_environments_status_idx ON ${table.name} (status)`,
  cloudProviderIdx: sql`CREATE INDEX test_execution_environments_cloud_provider_idx ON ${table.name} (cloud_provider)`,
}));

// Advanced analytics table - Enhanced metrics and insights (SQLite version)
export const advancedAnalytics = sqliteTable('advanced_analytics', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => coreSchema.projects.id, { onDelete: 'cascade' }),

  // Time bucket
  date: integer('date', { mode: 'timestamp' }).notNull(),
  granularity: text('granularity').notNull(), // hour, day, week, month

  // Test execution metrics
  totalTests: integer('total_tests').default(0),
  passedTests: integer('passed_tests').default(0),
  failedTests: integer('failed_tests').default(0),
  skippedTests: integer('skipped_tests').default(0),

  // Performance metrics
  avgExecutionTime: integer('avg_execution_time').default(0),
  minExecutionTime: integer('min_execution_time'),
  maxExecutionTime: integer('max_execution_time'),

  // Quality metrics
  testCoverage: real('test_coverage'),
  codeQualityScore: real('code_quality_score'),
  bugDetectionRate: real('bug_detection_rate'),

  // AI metrics
  aiGeneratedTests: integer('ai_generated_tests').default(0),
  aiSuggestionAccuracy: real('ai_suggestion_accuracy'),

  // Platform distribution
  browserDistribution: text('browser_distribution', { mode: 'json' }).$defaultFn(() => '{}'),
  deviceDistribution: text('device_distribution', { mode: 'json' }).$defaultFn(() => '{}'),
  platformDistribution: text('platform_distribution', { mode: 'json' }).$defaultFn(() => '{}'),

  // Integration metrics
  apiTestCount: integer('api_test_count').default(0),
  databaseTestCount: integer('database_test_count').default(0),
  pluginUsageCount: integer('plugin_usage_count').default(0),

  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  userIdDateIdx: sql`CREATE UNIQUE INDEX advanced_analytics_user_date_granularity_unique ON ${table.name} (user_id, date, granularity)`,
  projectIdIdx: sql`CREATE INDEX advanced_analytics_project_id_idx ON ${table.name} (project_id)`,
  dateIdx: sql`CREATE INDEX advanced_analytics_date_idx ON ${table.name} (date)`,
  granularityIdx: sql`CREATE INDEX advanced_analytics_granularity_idx ON ${table.name} (granularity)`,
}));

// Security audit logs table - Compliance and security tracking (SQLite version)
export const securityAuditLogs = sqliteTable('security_audit_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').references(() => coreSchema.users.id, { onDelete: 'set null' }),

  // Event details
  eventType: text('event_type').notNull(), // login, logout, data_access, permission_change, etc.
  eventCategory: text('event_category').notNull(), // authentication, authorization, data, system
  severity: text('severity').notNull(), // low, medium, high, critical

  // Event metadata
  description: text('description').notNull(),
  resourceType: text('resource_type'), // user, project, test_case, plugin, etc.
  resourceId: text('resource_id'),

  // Request context
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  sessionId: text('session_id'),

  // Additional data
  metadata: text('metadata', { mode: 'json' }).$defaultFn(() => '{}'),

  // Status
  status: text('status').notNull(), // success, failure, blocked

  timestamp: integer('timestamp', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  userIdIdx: sql`CREATE INDEX security_audit_logs_user_id_idx ON ${table.name} (user_id)`,
  eventTypeIdx: sql`CREATE INDEX security_audit_logs_event_type_idx ON ${table.name} (event_type)`,
  eventCategoryIdx: sql`CREATE INDEX security_audit_logs_event_category_idx ON ${table.name} (event_category)`,
  severityIdx: sql`CREATE INDEX security_audit_logs_severity_idx ON ${table.name} (severity)`,
  timestampIdx: sql`CREATE INDEX security_audit_logs_timestamp_idx ON ${table.name} (timestamp)`,
  statusIdx: sql`CREATE INDEX security_audit_logs_status_idx ON ${table.name} (status)`,
}));

// Database connections table - Database testing system (SQLite version)
export const databaseConnections = sqliteTable('database_connections', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => coreSchema.projects.id, { onDelete: 'cascade' }),

  // Connection details
  name: text('name').notNull(),
  type: text('type').notNull(), // postgresql, mysql, mongodb, redis
  host: text('host').notNull(),
  port: integer('port').notNull(),
  database: text('database').notNull(),
  username: text('username').notNull(),
  password: text('password'), // encrypted

  // Connection configuration
  ssl: integer('ssl', { mode: 'boolean' }).default(false),
  connectionTimeout: integer('connection_timeout').default(30000),
  maxConnections: integer('max_connections').default(10),
  additionalConfig: text('additional_config', { mode: 'json' }).$defaultFn(() => '{}'),

  // Status and monitoring
  status: text('status').notNull().default('disconnected'), // connected, disconnected, error
  lastHealthCheck: integer('last_health_check', { mode: 'timestamp' }),
  healthCheckInterval: integer('health_check_interval').default(60000), // milliseconds

  // Usage tracking
  testCasesCount: integer('test_cases_count').default(0),
  lastUsed: integer('last_used', { mode: 'timestamp' }),

  // Tags and organization
  tags: text('tags', { mode: 'json' }).$defaultFn(() => '[]'),
  environment: text('environment').default('development'), // development, staging, production

  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  userIdIdx: sql`CREATE INDEX database_connections_user_id_idx ON ${table.name} (user_id)`,
  projectIdIdx: sql`CREATE INDEX database_connections_project_id_idx ON ${table.name} (project_id)`,
  typeIdx: sql`CREATE INDEX database_connections_type_idx ON ${table.name} (type)`,
  statusIdx: sql`CREATE INDEX database_connections_status_idx ON ${table.name} (status)`,
  environmentIdx: sql`CREATE INDEX database_connections_environment_idx ON ${table.name} (environment)`,
  isActiveIdx: sql`CREATE INDEX database_connections_is_active_idx ON ${table.name} (is_active)`,
}));

// Database test cases table - Database testing capabilities (SQLite version)
export const databaseTestCases = sqliteTable('database_test_cases', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => coreSchema.projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),
  connectionId: text('connection_id').notNull().references(() => databaseConnections.id, { onDelete: 'cascade' }),

  // Test metadata
  name: text('name').notNull(),
  description: text('description'),
  testType: text('test_type').notNull(), // data-integrity, performance, security, migration

  // Database operations
  setupQueries: text('setup_queries', { mode: 'json' }).$defaultFn(() => '[]'),
  testQueries: text('test_queries', { mode: 'json' }).notNull(),
  teardownQueries: text('teardown_queries', { mode: 'json' }).$defaultFn(() => '[]'),

  // Validation rules
  dataValidations: text('data_validations', { mode: 'json' }).$defaultFn(() => '[]'),
  constraintValidations: text('constraint_validations', { mode: 'json' }).$defaultFn(() => '[]'),
  performanceThresholds: text('performance_thresholds', { mode: 'json' }).$defaultFn(() => '{}'),

  // Transaction management
  useTransaction: integer('use_transaction', { mode: 'boolean' }).default(true),
  isolationLevel: text('isolation_level').default('READ_COMMITTED'),

  // Scheduling and automation
  schedule: text('schedule', { mode: 'json' }),
  isScheduled: integer('is_scheduled', { mode: 'boolean' }).default(false),

  // Tags and organization
  tags: text('tags', { mode: 'json' }).$defaultFn(() => '[]'),
  category: text('category'),
  priority: text('priority').default('medium'),

  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  projectIdIdx: sql`CREATE INDEX database_test_cases_project_id_idx ON ${table.name} (project_id)`,
  userIdIdx: sql`CREATE INDEX database_test_cases_user_id_idx ON ${table.name} (user_id)`,
  connectionIdIdx: sql`CREATE INDEX database_test_cases_connection_id_idx ON ${table.name} (connection_id)`,
  testTypeIdx: sql`CREATE INDEX database_test_cases_test_type_idx ON ${table.name} (test_type)`,
  isScheduledIdx: sql`CREATE INDEX database_test_cases_is_scheduled_idx ON ${table.name} (is_scheduled)`,
}));

// Database test results table - Database testing results (SQLite version)
export const databaseTestResults = sqliteTable('database_test_results', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  testCaseId: text('test_case_id').notNull().references(() => databaseTestCases.id, { onDelete: 'cascade' }),
  connectionId: text('connection_id').notNull().references(() => databaseConnections.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),

  // Execution details
  startTime: integer('start_time', { mode: 'timestamp' }).notNull(),
  endTime: integer('end_time', { mode: 'timestamp' }).notNull(),
  duration: integer('duration').notNull(), // milliseconds
  status: text('status').notNull(), // passed, failed, error

  // Results
  queryResults: text('query_results', { mode: 'json' }).$defaultFn(() => '[]'),
  validationResults: text('validation_results', { mode: 'json' }).$defaultFn(() => '[]'),

  // Performance metrics
  totalExecutionTime: integer('total_execution_time').notNull(),
  queryCount: integer('query_count').notNull(),
  averageQueryTime: real('average_query_time'),
  memoryUsage: integer('memory_usage'), // bytes
  cpuUsage: real('cpu_usage'), // percentage
  diskIO: integer('disk_io'), // bytes

  // Error handling
  error: text('error'),
  stackTrace: text('stack_trace'),

  // Execution logs and artifacts
  executionLogs: text('execution_logs', { mode: 'json' }).$defaultFn(() => '[]'),
  dataSnapshots: text('data_snapshots', { mode: 'json' }).$defaultFn(() => '[]'),

  // Trigger context
  triggeredBy: text('triggered_by').default('manual'), // manual, scheduled, api, webhook
  triggerMetadata: text('trigger_metadata', { mode: 'json' }).$defaultFn(() => '{}'),

  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  testCaseIdIdx: sql`CREATE INDEX database_test_results_test_case_id_idx ON ${table.name} (test_case_id)`,
  connectionIdIdx: sql`CREATE INDEX database_test_results_connection_id_idx ON ${table.name} (connection_id)`,
  userIdIdx: sql`CREATE INDEX database_test_results_user_id_idx ON ${table.name} (user_id)`,
  statusIdx: sql`CREATE INDEX database_test_results_status_idx ON ${table.name} (status)`,
  startTimeIdx: sql`CREATE INDEX database_test_results_start_time_idx ON ${table.name} (start_time)`,
  durationIdx: sql`CREATE INDEX database_test_results_duration_idx ON ${table.name} (duration)`,
}));

// Database schema versions table - Track database schema changes (SQLite version)
export const databaseSchemaVersions = sqliteTable('database_schema_versions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  connectionId: text('connection_id').notNull().references(() => databaseConnections.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),

  // Version information
  version: text('version').notNull(),
  description: text('description'),

  // Schema snapshot
  schemaSnapshot: text('schema_snapshot', { mode: 'json' }).notNull(), // complete schema structure
  tablesSnapshot: text('tables_snapshot', { mode: 'json' }).notNull(), // table definitions
  constraintsSnapshot: text('constraints_snapshot', { mode: 'json' }).notNull(), // constraints
  indexesSnapshot: text('indexes_snapshot', { mode: 'json' }).notNull(), // indexes

  // Change tracking
  changesFromPrevious: text('changes_from_previous', { mode: 'json' }).$defaultFn(() => '[]'), // differences from previous version
  migrationQueries: text('migration_queries', { mode: 'json' }).$defaultFn(() => '[]'), // queries to apply this version
  rollbackQueries: text('rollback_queries', { mode: 'json' }).$defaultFn(() => '[]'), // queries to rollback this version

  // Validation
  isValidated: integer('is_validated', { mode: 'boolean' }).default(false),
  validationResults: text('validation_results', { mode: 'json' }).$defaultFn(() => '[]'),

  // Status
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  tags: text('tags', { mode: 'json' }).$defaultFn(() => '[]'),

  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  connectionIdIdx: sql`CREATE INDEX database_schema_versions_connection_id_idx ON ${table.name} (connection_id)`,
  userIdIdx: sql`CREATE INDEX database_schema_versions_user_id_idx ON ${table.name} (user_id)`,
  versionIdx: sql`CREATE INDEX database_schema_versions_version_idx ON ${table.name} (version)`,
  isValidatedIdx: sql`CREATE INDEX database_schema_versions_is_validated_idx ON ${table.name} (is_validated)`,
  isActiveIdx: sql`CREATE INDEX database_schema_versions_is_active_idx ON ${table.name} (is_active)`,
}));

// Advanced analytics and security schema export
export const advancedAnalyticsSchema = {
  enhancedTestCases,
  apiTestCases,
  testExecutionEnvironments,
  advancedAnalytics,
  securityAuditLogs,
  databaseConnections,
  databaseTestCases,
  databaseTestResults,
  databaseSchemaVersions,
};

export default advancedAnalyticsSchema;
