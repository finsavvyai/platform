import {
  sqliteTable,
  text,
  integer,
  real
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { coreSchema } from './core-schema.js';

// API endpoints table - SQLite version
export const apiEndpoints = sqliteTable('api_endpoints', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  baseUrl: text('base_url').notNull(),
  version: text('version').notNull(),
  authentication: text('authentication', { mode: 'json' }).notNull(), // type, config
  headers: text('headers', { mode: 'json' }).$defaultFn(() => '{}'),
  rateLimit: text('rate_limit'), // requests, window, burst
  timeout: integer('timeout').default(30000),
  retryConfig: text('retry_config'), // attempts, delay, backoff
  healthCheck: text('health_check'), // endpoint, method, expectedStatus, interval
  documentation: text('documentation'), // openApiSpec, postmanCollection, customDocs
  tags: text('tags', { mode: 'json' }).$defaultFn(() => '[]'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  lastHealthCheck: integer('last_health_check', { mode: 'timestamp' }),
  healthStatus: text('health_status').default('unknown'), // healthy, degraded, down, unknown
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  userIdIdx: sql`CREATE INDEX api_endpoints_user_id_idx ON ${table.name} (user_id)`,
  baseUrlIdx: sql`CREATE INDEX api_endpoints_base_url_idx ON ${table.name} (base_url)`,
  isActiveIdx: sql`CREATE INDEX api_endpoints_is_active_idx ON ${table.name} (is_active)`,
  healthStatusIdx: sql`CREATE INDEX api_endpoints_health_status_idx ON ${table.name} (health_status)`,
}));

// API calls table - SQLite version
export const apiCalls = sqliteTable('api_calls', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  endpointId: text('endpoint_id').notNull().references(() => apiEndpoints.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),
  method: text('method').notNull(),
  path: text('path').notNull(),
  headers: text('headers', { mode: 'json' }).$defaultFn(() => '{}'),
  queryParams: text('query_params', { mode: 'json' }).$defaultFn(() => '{}'),
  body: text('body', { mode: 'json' }),
  responseStatus: integer('response_status'),
  responseHeaders: text('response_headers', { mode: 'json' }).$defaultFn(() => '{}'),
  responseBody: text('response_body', { mode: 'json' }),
  responseTime: integer('response_time'), // milliseconds
  success: integer('success', { mode: 'boolean' }).notNull(),
  error: text('error'),
  validationResults: text('validation_results', { mode: 'json' }).$defaultFn(() => '[]'),
  transformedData: text('transformed_data', { mode: 'json' }),
  executedAt: integer('executed_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  endpointIdIdx: sql`CREATE INDEX api_calls_endpoint_id_idx ON ${table.name} (endpoint_id)`,
  userIdIdx: sql`CREATE INDEX api_calls_user_id_idx ON ${table.name} (user_id)`,
  methodIdx: sql`CREATE INDEX api_calls_method_idx ON ${table.name} (method)`,
  successIdx: sql`CREATE INDEX api_calls_success_idx ON ${table.name} (success)`,
  executedAtIdx: sql`CREATE INDEX api_calls_executed_at_idx ON ${table.name} (executed_at)`,
}));

// Webhook endpoints table - SQLite version
export const webhookEndpoints = sqliteTable('webhook_endpoints', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  url: text('url').notNull(),
  events: text('events', { mode: 'json' }).notNull(), // array of event names
  secret: text('secret').notNull(),
  headers: text('headers', { mode: 'json' }).$defaultFn(() => '{}'),
  authentication: text('authentication', { mode: 'json' }), // type, config
  retryPolicy: text('retry_policy', { mode: 'json' }).notNull(), // attempts, delay, exponentialBackoff
  filters: text('filters', { mode: 'json' }), // conditions, operator
  transformation: text('transformation', { mode: 'json' }), // transformation rules
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  lastTriggered: integer('last_triggered', { mode: 'timestamp' }),
  successCount: integer('success_count').default(0),
  failureCount: integer('failure_count').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  userIdIdx: sql`CREATE INDEX webhook_endpoints_user_id_idx ON ${table.name} (user_id)`,
  urlIdx: sql`CREATE INDEX webhook_endpoints_url_idx ON ${table.name} (url)`,
  isActiveIdx: sql`CREATE INDEX webhook_endpoints_is_active_idx ON ${table.name} (is_active)`,
}));

// Webhook deliveries table - SQLite version
export const webhookDeliveries = sqliteTable('webhook_deliveries', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  webhookId: text('webhook_id').notNull().references(() => webhookEndpoints.id, { onDelete: 'cascade' }),
  event: text('event').notNull(),
  payload: text('payload', { mode: 'json' }).notNull(),
  response: text('response', { mode: 'json' }),
  responseStatus: integer('response_status'),
  responseTime: integer('response_time'), // milliseconds
  attempt: integer('attempt').default(1),
  success: integer('success', { mode: 'boolean' }).notNull(),
  error: text('error'),
  deliveredAt: integer('delivered_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  webhookIdIdx: sql`CREATE INDEX webhook_deliveries_webhook_id_idx ON ${table.name} (webhook_id)`,
  eventIdx: sql`CREATE INDEX webhook_deliveries_event_idx ON ${table.name} (event)`,
  successIdx: sql`CREATE INDEX webhook_deliveries_success_idx ON ${table.name} (success)`,
  deliveredAtIdx: sql`CREATE INDEX webhook_deliveries_delivered_at_idx ON ${table.name} (delivered_at)`,
}));

// External integrations table - SQLite version
export const externalIntegrations = sqliteTable('external_integrations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(), // webhook, polling, streaming, batch
  provider: text('provider').notNull(), // github, slack, jira, etc.
  config: text('config', { mode: 'json' }).notNull(), // endpoints, authentication, schedule, etc.
  dataMappings: text('data_mappings', { mode: 'json' }).$defaultFn(() => '[]'), // field mappings
  errorHandling: text('error_handling', { mode: 'json' }).notNull(), // retry policy, failure webhook, alert channels
  monitoring: text('monitoring', { mode: 'json' }).notNull(), // health check interval, thresholds, alert conditions
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  lastSync: integer('last_sync', { mode: 'timestamp' }),
  syncStats: text('sync_stats', { mode: 'json' }).$defaultFn(() => '{}'), // totalRecords, successfulRecords, failedRecords, lastError
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  userIdIdx: sql`CREATE INDEX external_integrations_user_id_idx ON ${table.name} (user_id)`,
  typeIdx: sql`CREATE INDEX external_integrations_type_idx ON ${table.name} (type)`,
  providerIdx: sql`CREATE INDEX external_integrations_provider_idx ON ${table.name} (provider)`,
  isActiveIdx: sql`CREATE INDEX external_integrations_is_active_idx ON ${table.name} (is_active)`,
}));

// API analytics table - SQLite version
export const apiAnalytics = sqliteTable('api_analytics', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  endpointId: text('endpoint_id').notNull().references(() => apiEndpoints.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),
  date: integer('date', { mode: 'timestamp' }).notNull(), // date bucket (hour, day, etc.)
  requestCount: integer('request_count').default(0),
  successCount: integer('success_count').default(0),
  errorCount: integer('error_count').default(0),
  totalResponseTime: integer('total_response_time').default(0), // sum for average calculation
  minResponseTime: integer('min_response_time'),
  maxResponseTime: integer('max_response_time'),
  statusCodes: text('status_codes', { mode: 'json' }).$defaultFn(() => '{}'), // count by status code
  errorTypes: text('error_types', { mode: 'json' }).$defaultFn(() => '{}'), // count by error type
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  endpointIdDateIdx: sql`CREATE UNIQUE INDEX api_analytics_endpoint_date_unique ON ${table.name} (endpoint_id, date)`,
  userIdIdx: sql`CREATE INDEX api_analytics_user_id_idx ON ${table.name} (user_id)`,
  dateIdx: sql`CREATE INDEX api_analytics_date_idx ON ${table.name} (date)`,
}));

// Data transformation rules table - SQLite version
export const transformationRules = sqliteTable('transformation_rules', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').notNull(), // map, filter, aggregate, custom
  sourceField: text('source_field'),
  targetField: text('target_field'),
  function: text('function'), // custom transformation function
  parameters: text('parameters', { mode: 'json' }).$defaultFn(() => '{}'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  usageCount: integer('usage_count').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  userIdIdx: sql`CREATE INDEX transformation_rules_user_id_idx ON ${table.name} (user_id)`,
  typeIdx: sql`CREATE INDEX transformation_rules_type_idx ON ${table.name} (type)`,
  isActiveIdx: sql`CREATE INDEX transformation_rules_is_active_idx ON ${table.name} (is_active)`,
}));

// Scheduled tests table - SQLite version (moved from core schema)
export const scheduledTests = sqliteTable('scheduled_tests', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),
  dataSourceId: text('data_source_id').notNull().references(() => coreSchema.dataSources.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  testType: text('test_type').notNull(), // query, api, performance, security
  config: text('config', { mode: 'json' }).notNull(), // test configuration
  schedule: text('schedule', { mode: 'json' }).notNull(), // schedule configuration
  alerts: text('alerts', { mode: 'json' }).notNull(), // alert configuration
  thresholds: text('thresholds', { mode: 'json' }).$defaultFn(() => '{}'), // performance thresholds
  status: text('status').notNull().default('active'), // active, paused, stopped, error
  lastRun: integer('last_run', { mode: 'timestamp' }),
  nextRun: integer('next_run', { mode: 'timestamp' }),
  runCount: integer('run_count').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  userIdIdx: sql`CREATE INDEX scheduled_tests_user_id_idx ON ${table.name} (user_id)`,
  dataSourceIdIdx: sql`CREATE INDEX scheduled_tests_data_source_id_idx ON ${table.name} (data_source_id)`,
  testTypeIdx: sql`CREATE INDEX scheduled_tests_test_type_idx ON ${table.name} (test_type)`,
  statusIdx: sql`CREATE INDEX scheduled_tests_status_idx ON ${table.name} (status)`,
  nextRunIdx: sql`CREATE INDEX scheduled_tests_next_run_idx ON ${table.name} (next_run)`,
}));

// Test results table - SQLite version
export const testResults = sqliteTable('test_results', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  testId: text('test_id').notNull().references(() => scheduledTests.id, { onDelete: 'cascade' }),
  runId: text('run_id').notNull(),
  startTime: integer('start_time', { mode: 'timestamp' }).notNull(),
  endTime: integer('end_time', { mode: 'timestamp' }).notNull(),
  duration: integer('duration').notNull(), // milliseconds
  success: integer('success', { mode: 'boolean' }).notNull(),
  metrics: text('metrics', { mode: 'json' }).$defaultFn(() => '{}'), // performance metrics
  results: text('results', { mode: 'json' }), // test results data
  error: text('error'),
  alertsTriggered: text('alerts_triggered', { mode: 'json' }).$defaultFn(() => '[]'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  testIdIdx: sql`CREATE INDEX test_results_test_id_idx ON ${table.name} (test_id)`,
  runIdIdx: sql`CREATE INDEX test_results_run_id_idx ON ${table.name} (run_id)`,
  startTimeIdx: sql`CREATE INDEX test_results_start_time_idx ON ${table.name} (start_time)`,
  successIdx: sql`CREATE INDEX test_results_success_idx ON ${table.name} (success)`,
}));

// Notification logs table - SQLite version
export const notificationLogs = sqliteTable('notification_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  testId: text('test_id').references(() => scheduledTests.id, { onDelete: 'cascade' }),
  channelId: text('channel_id'),
  type: text('type').notNull(), // email, sms, slack, webhook, voice
  recipient: text('recipient').notNull(),
  subject: text('subject'),
  message: text('message').notNull(),
  status: text('status').notNull(), // sent, failed, pending, retry
  attempt: integer('attempt').default(1),
  sentAt: integer('sent_at', { mode: 'timestamp' }),
  error: text('error'),
  metadata: text('metadata', { mode: 'json' }).$defaultFn(() => '{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  testIdIdx: sql`CREATE INDEX notification_logs_test_id_idx ON ${table.name} (test_id)`,
  typeIdx: sql`CREATE INDEX notification_logs_type_idx ON ${table.name} (type)`,
  statusIdx: sql`CREATE INDEX notification_logs_status_idx ON ${table.name} (status)`,
  sentAtIdx: sql`CREATE INDEX notification_logs_sent_at_idx ON ${table.name} (sent_at)`,
}));

// Saved queries table - SQLite version
export const savedQueries = sqliteTable('saved_queries', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),
  dataSourceId: text('data_source_id').notNull().references(() => coreSchema.dataSources.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  query: text('query').notNull(),
  parameters: text('parameters', { mode: 'json' }).$defaultFn(() => '{}'),
  lastExecuted: integer('last_executed', { mode: 'timestamp' }),
  avgExecutionTime: integer('avg_execution_time'), // milliseconds
  executionCount: integer('execution_count').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  userIdIdx: sql`CREATE INDEX saved_queries_user_id_idx ON ${table.name} (user_id)`,
  dataSourceIdIdx: sql`CREATE INDEX saved_queries_data_source_id_idx ON ${table.name} (data_source_id)`,
}));

// Saved API endpoints table - SQLite version
export const savedEndpoints = sqliteTable('saved_endpoints', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),
  dataSourceId: text('data_source_id').notNull().references(() => coreSchema.dataSources.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  method: text('method').notNull(), // GET, POST, PUT, DELETE, PATCH
  path: text('path').notNull(),
  headers: text('headers', { mode: 'json' }).$defaultFn(() => '{}'),
  body: text('body', { mode: 'json' }),
  queryParams: text('query_params', { mode: 'json' }).$defaultFn(() => '{}'),
  lastTested: integer('last_tested', { mode: 'timestamp' }),
  avgResponseTime: integer('avg_response_time'), // milliseconds
  testCount: integer('test_count').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  userIdIdx: sql`CREATE INDEX saved_endpoints_user_id_idx ON ${table.name} (user_id)`,
  dataSourceIdIdx: sql`CREATE INDEX saved_endpoints_data_source_id_idx ON ${table.name} (data_source_id)`,
  methodIdx: sql`CREATE INDEX saved_endpoints_method_idx ON ${table.name} (method)`,
}));

// Reports table - SQLite version
export const reports = sqliteTable('reports', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),
  testId: text('test_id').references(() => scheduledTests.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // security, performance, general, penetration
  title: text('title').notNull(),
  description: text('description'),
  content: text('content', { mode: 'json' }).notNull(), // report data
  pdfPath: text('pdf_path'),
  status: text('status').notNull().default('generating'), // generating, completed, failed
  sharedAt: integer('shared_at', { mode: 'timestamp' }),
  sharedWith: text('shared_with', { mode: 'json' }).$defaultFn(() => '[]'), // emails, slack channels, etc.
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  userIdIdx: sql`CREATE INDEX reports_user_id_idx ON ${table.name} (user_id)`,
  testIdIdx: sql`CREATE INDEX reports_test_id_idx ON ${table.name} (test_id)`,
  typeIdx: sql`CREATE INDEX reports_type_idx ON ${table.name} (type)`,
  statusIdx: sql`CREATE INDEX reports_status_idx ON ${table.name} (status)`,
}));

// API management schema export
export const apiManagementSchema = {
  apiEndpoints,
  apiCalls,
  webhookEndpoints,
  webhookDeliveries,
  externalIntegrations,
  apiAnalytics,
  transformationRules,
  scheduledTests,
  testResults,
  notificationLogs,
  savedQueries,
  savedEndpoints,
  reports,
};

export default apiManagementSchema;
