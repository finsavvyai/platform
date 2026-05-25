import {
  sqliteTable,
  text,
  integer,
  real,
  blob
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Users table - SQLite version
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  avatar: text('avatar'),
  role: text('role').notNull().default('user'), // user, admin, enterprise
  subscription: text('subscription').default('free'), // free, pro, enterprise
  isEmailVerified: integer('is_email_verified', { mode: 'boolean' }).default(false),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  emailIdx: sql`CREATE INDEX users_email_idx ON ${table.name} (email)`,
  roleIdx: sql`CREATE INDEX users_role_idx ON ${table.name} (role)`,
}));

// Projects table - SQLite version
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').notNull(), // mobile, web, hybrid
  platform: text('platform'), // ios, android, chrome, firefox, etc.
  settings: text('settings', { mode: 'json' }).$defaultFn(() => '{}'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  userIdIdx: sql`CREATE INDEX projects_user_id_idx ON ${table.name} (user_id)`,
  typeIdx: sql`CREATE INDEX projects_type_idx ON ${table.name} (type)`,
}));

// Recording sessions table - SQLite version
export const recordingSessions = sqliteTable('recording_sessions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name'),
  type: text('type').notNull(), // mobile, web
  platform: text('platform').notNull(),
  status: text('status').notNull().default('idle'), // idle, recording, processing, completed, error
  startTime: integer('start_time', { mode: 'timestamp' }),
  endTime: integer('end_time', { mode: 'timestamp' }),
  duration: integer('duration').default(0), // in seconds
  actionsCount: integer('actions_count').default(0),
  metadata: text('metadata', { mode: 'json' }).$defaultFn(() => '{}'),
  artifacts: text('artifacts', { mode: 'json' }).$defaultFn(() => '{}'), // screenshots, videos, logs
  exportFormats: text('export_formats', { mode: 'json' }).$defaultFn(() => '[]'), // maestro, workflow-use, json
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  projectIdIdx: sql`CREATE INDEX recording_sessions_project_id_idx ON ${table.name} (project_id)`,
  userIdIdx: sql`CREATE INDEX recording_sessions_user_id_idx ON ${table.name} (user_id)`,
  statusIdx: sql`CREATE INDEX recording_sessions_status_idx ON ${table.name} (status)`,
  typeIdx: sql`CREATE INDEX recording_sessions_type_idx ON ${table.name} (type)`,
}));

// Recorded actions table - SQLite version
export const recordedActions = sqliteTable('recorded_actions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionId: text('session_id').notNull().references(() => recordingSessions.id, { onDelete: 'cascade' }),
  sequenceNumber: integer('sequence_number').notNull(),
  type: text('type').notNull(), // tap, type, swipe, scroll, assert, wait, screenshot, navigate
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  coordinates: text('coordinates', { mode: 'json' }), // { x, y }
  text: text('text'),
  element: text('element'),
  selector: text('selector'),
  screenshot: text('screenshot'), // file path or URL
  metadata: text('metadata', { mode: 'json' }).$defaultFn(() => '{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  sessionIdIdx: sql`CREATE INDEX recorded_actions_session_id_idx ON ${table.name} (session_id)`,
  sequenceIdx: sql`CREATE INDEX recorded_actions_sequence_idx ON ${table.name} (session_id, sequence_number)`,
  typeIdx: sql`CREATE INDEX recorded_actions_type_idx ON ${table.name} (type)`,
}));

// Test suites table - SQLite version
export const testSuites = sqliteTable('test_suites', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').notNull(), // mobile, web, hybrid
  testCases: text('test_cases', { mode: 'json' }).$defaultFn(() => '[]'), // array of test case IDs
  settings: text('settings', { mode: 'json' }).$defaultFn(() => '{}'),
  schedule: text('schedule', { mode: 'json' }), // cron-like scheduling configuration
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  lastRunAt: integer('last_run_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  projectIdIdx: sql`CREATE INDEX test_suites_project_id_idx ON ${table.name} (project_id)`,
  userIdIdx: sql`CREATE INDEX test_suites_user_id_idx ON ${table.name} (user_id)`,
  typeIdx: sql`CREATE INDEX test_suites_type_idx ON ${table.name} (type)`,
}));

// Test cases table - SQLite version
export const testCases = sqliteTable('test_cases', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').references(() => recordingSessions.id, { onDelete: 'set null' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').notNull(), // mobile, web
  platform: text('platform'),
  testData: text('test_data', { mode: 'json' }).notNull(), // Maestro YAML, workflow-use YAML, or custom format
  expectedResults: text('expected_results', { mode: 'json' }).$defaultFn(() => '[]'),
  tags: text('tags', { mode: 'json' }).$defaultFn(() => '[]'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  projectIdIdx: sql`CREATE INDEX test_cases_project_id_idx ON ${table.name} (project_id)`,
  sessionIdIdx: sql`CREATE INDEX test_cases_session_id_idx ON ${table.name} (session_id)`,
  userIdIdx: sql`CREATE INDEX test_cases_user_id_idx ON ${table.name} (user_id)`,
  typeIdx: sql`CREATE INDEX test_cases_type_idx ON ${table.name} (type)`,
}));

// Test runs table - SQLite version
export const testRuns = sqliteTable('test_runs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  testSuiteId: text('test_suite_id').references(() => testSuites.id, { onDelete: 'cascade' }),
  testCaseId: text('test_case_id').references(() => testCases.id, { onDelete: 'cascade' }),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'), // pending, running, passed, failed, error
  startTime: integer('start_time', { mode: 'timestamp' }),
  endTime: integer('end_time', { mode: 'timestamp' }),
  duration: integer('duration'), // in milliseconds
  results: text('results', { mode: 'json' }).$defaultFn(() => '{}'),
  logs: text('logs', { mode: 'json' }).$defaultFn(() => '[]'),
  screenshots: text('screenshots', { mode: 'json' }).$defaultFn(() => '[]'),
  videos: text('videos', { mode: 'json' }).$defaultFn(() => '[]'),
  errorMessage: text('error_message'),
  environment: text('environment', { mode: 'json' }).$defaultFn(() => '{}'), // device info, browser info, etc.
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  testSuiteIdIdx: sql`CREATE INDEX test_runs_test_suite_id_idx ON ${table.name} (test_suite_id)`,
  testCaseIdIdx: sql`CREATE INDEX test_runs_test_case_id_idx ON ${table.name} (test_case_id)`,
  projectIdIdx: sql`CREATE INDEX test_runs_project_id_idx ON ${table.name} (project_id)`,
  userIdIdx: sql`CREATE INDEX test_runs_user_id_idx ON ${table.name} (user_id)`,
  statusIdx: sql`CREATE INDEX test_runs_status_idx ON ${table.name} (status)`,
}));

// Integrations table - SQLite version
export const integrations = sqliteTable('integrations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // slack, teams, discord, email, webhook, github, jira
  name: text('name').notNull(),
  config: text('config', { mode: 'json' }).notNull(), // integration-specific configuration
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  lastTriggeredAt: integer('last_triggered_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  userIdIdx: sql`CREATE INDEX integrations_user_id_idx ON ${table.name} (user_id)`,
  projectIdIdx: sql`CREATE INDEX integrations_project_id_idx ON ${table.name} (project_id)`,
  typeIdx: sql`CREATE INDEX integrations_type_idx ON ${table.name} (type)`,
}));

// API keys table - SQLite version
export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull(), // hashed API key
  keyPrefix: text('key_prefix').notNull(), // first few characters for identification
  permissions: text('permissions', { mode: 'json' }).$defaultFn(() => '[]'), // array of permission strings
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  userIdIdx: sql`CREATE INDEX api_keys_user_id_idx ON ${table.name} (user_id)`,
  keyHashIdx: sql`CREATE UNIQUE INDEX api_keys_key_hash_unique ON ${table.name} (key_hash)`,
}));

// Usage analytics table - SQLite version
export const usageAnalytics = sqliteTable('usage_analytics', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  date: integer('date', { mode: 'timestamp' }).notNull(),
  recordingMinutes: integer('recording_minutes').default(0),
  testRuns: integer('test_runs').default(0),
  apiCalls: integer('api_calls').default(0),
  storageUsed: integer('storage_used').default(0), // in bytes
  bandwidth: integer('bandwidth').default(0), // in bytes
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  userIdDateIdx: sql`CREATE UNIQUE INDEX usage_analytics_user_date_unique ON ${table.name} (user_id, date)`,
  projectIdIdx: sql`CREATE INDEX usage_analytics_project_id_idx ON ${table.name} (project_id)`,
  dateIdx: sql`CREATE INDEX usage_analytics_date_idx ON ${table.name} (date)`,
}));

// Data sources table - SQLite version
export const dataSources = sqliteTable('data_sources', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(), // postgresql, mysql, mongodb, redis, api, graphql, rest
  config: text('config', { mode: 'json' }).notNull(), // connection configuration
  status: text('status').notNull().default('inactive'), // active, inactive, error
  lastTestedAt: integer('last_tested_at', { mode: 'timestamp' }),
  tags: text('tags', { mode: 'json' }).$defaultFn(() => '[]'),
  metadata: text('metadata', { mode: 'json' }).$defaultFn(() => '{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
  userIdIdx: sql`CREATE INDEX data_sources_user_id_idx ON ${table.name} (user_id)`,
  typeIdx: sql`CREATE INDEX data_sources_type_idx ON ${table.name} (type)`,
  statusIdx: sql`CREATE INDEX data_sources_status_idx ON ${table.name} (status)`,
}));

// Core schema export
export const coreSchema = {
  users,
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
};

export default coreSchema;
