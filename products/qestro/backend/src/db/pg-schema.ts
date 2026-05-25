import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  index,
  foreignKey,
  unique,
  serial,
} from 'drizzle-orm/pg-core';

/**
 * PostgreSQL Enums for type safety
 */
export const userRoleEnum = pgEnum('user_role', ['admin', 'user', 'viewer', 'team_lead']);
export const subscriptionPlanEnum = pgEnum('subscription_plan', [
  'free',
  'starter',
  'pro',
  'enterprise',
]);
export const testStatusEnum = pgEnum('test_status', [
  'draft',
  'active',
  'archived',
  'disabled',
]);
export const testPriorityEnum = pgEnum('test_priority', [
  'low',
  'medium',
  'high',
  'critical',
]);
export const testTypeEnum = pgEnum('test_type', ['functional', 'regression', 'smoke', 'e2e']);
export const frameworkEnum = pgEnum('framework', ['playwright', 'cypress', 'maestro', 'api']);
export const testRunStatusEnum = pgEnum('test_run_status', [
  'pending',
  'running',
  'passed',
  'failed',
  'skipped',
  'cancelled',
]);
export const recordingStatusEnum = pgEnum('recording_status', [
  'recording',
  'completed',
  'processing',
  'error',
  'failed',
]);
export const automationRunStatusEnum = pgEnum('automation_run_status', [
  'queued',
  'running',
  'passed',
  'failed',
  'partial',
  'cancelled',
]);
export const integrationType = pgEnum('integration_type', [
  'github',
  'gitlab',
  'jira',
  'slack',
  'teams',
  'discord',
]);
export const integrationStatusEnum = pgEnum('integration_status', ['connected', 'disconnected', 'error']);
export const notificationTypeEnum = pgEnum('notification_type', [
  'test_result',
  'test_failure',
  'system',
  'alert',
  'info',
]);

/**
 * Users table
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }),
    firstName: varchar('first_name', { length: 100 }),
    lastName: varchar('last_name', { length: 100 }),
    avatarUrl: text('avatar_url'),
    role: userRoleEnum('role').notNull().default('user'),
    subscription: subscriptionPlanEnum('subscription').notNull().default('free'),
    isEmailVerified: boolean('is_email_verified').notNull().default(false),
    googleId: varchar('google_id', { length: 255 }).unique(),
    githubId: varchar('github_id', { length: 255 }).unique(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: index('users_email_idx').on(table.email),
    googleIdIdx: index('users_google_id_idx').on(table.googleId),
    githubIdIdx: index('users_github_id_idx').on(table.githubId),
  })
);

/**
 * Projects table
 */
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    type: varchar('type', { length: 50 }), // 'web', 'mobile', 'api', 'hybrid'
    platform: varchar('platform', { length: 50 }), // 'browser', 'ios', 'android', 'rest', 'graphql'
    settings: jsonb('settings'), // Project-specific configuration
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('projects_user_id_idx').on(table.userId),
    createdAtIdx: index('projects_created_at_idx').on(table.createdAt),
  })
);

/**
 * Team members table
 */
export const teamMembers = pgTable(
  'team_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 50 }).notNull().default('member'), // 'owner', 'admin', 'member', 'viewer'
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectIdIdx: index('team_members_project_id_idx').on(table.projectId),
    userIdIdx: index('team_members_user_id_idx').on(table.userId),
    projectUserUniqueIdx: unique('team_members_project_user_unique').on(table.projectId, table.userId),
  })
);

/**
 * Test cases table
 */
export const testCases = pgTable(
  'test_cases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    status: testStatusEnum('status').notNull().default('draft'),
    priority: testPriorityEnum('priority').notNull().default('medium'),
    type: testTypeEnum('type').notNull().default('functional'),
    framework: frameworkEnum('framework').notNull().default('playwright'),
    tags: text('tags').array(),
    testCode: text('test_code'), // Playwright/Cypress code
    testData: jsonb('test_data'), // Arbitrary test metadata
    jiraIssue: varchar('jira_issue', { length: 255 }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectIdIdx: index('test_cases_project_id_idx').on(table.projectId),
    statusIdx: index('test_cases_status_idx').on(table.status),
    createdAtIdx: index('test_cases_created_at_idx').on(table.createdAt),
  })
);

/**
 * Test plans table
 */
export const testPlans = pgTable(
  'test_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    status: testStatusEnum('status').notNull().default('draft'),
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectIdIdx: index('test_plans_project_id_idx').on(table.projectId),
    statusIdx: index('test_plans_status_idx').on(table.status),
  })
);

/**
 * Test runs table
 */
export const testRuns = pgTable(
  'test_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    testPlanId: uuid('test_plan_id').references(() => testPlans.id, { onDelete: 'set null' }),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    status: testRunStatusEnum('status').notNull().default('pending'),
    environment: varchar('environment', { length: 100 }),
    browser: varchar('browser', { length: 50 }), // 'chromium', 'firefox', 'webkit'
    passed: integer('passed').notNull().default(0),
    failed: integer('failed').notNull().default(0),
    skipped: integer('skipped').notNull().default(0),
    total: integer('total').notNull().default(0),
    durationMs: integer('duration_ms').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectIdIdx: index('test_runs_project_id_idx').on(table.projectId),
    testPlanIdIdx: index('test_runs_test_plan_id_idx').on(table.testPlanId),
    statusIdx: index('test_runs_status_idx').on(table.status),
    createdAtIdx: index('test_runs_created_at_idx').on(table.createdAt),
  })
);

/**
 * Test results table
 */
export const testResults = pgTable(
  'test_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    testRunId: uuid('test_run_id').notNull().references(() => testRuns.id, { onDelete: 'cascade' }),
    testCaseId: uuid('test_case_id').notNull().references(() => testCases.id, { onDelete: 'cascade' }),
    status: testRunStatusEnum('status').notNull(),
    durationMs: integer('duration_ms').notNull().default(0),
    errorMessage: text('error_message'),
    stackTrace: text('stack_trace'),
    screenshotUrl: text('screenshot_url'),
    healed: boolean('healed').notNull().default(false),
    healingDetails: jsonb('healing_details'), // Details of self-healing suggestion
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    testRunIdIdx: index('test_results_test_run_id_idx').on(table.testRunId),
    testCaseIdIdx: index('test_results_test_case_id_idx').on(table.testCaseId),
    statusIdx: index('test_results_status_idx').on(table.status),
  })
);

/**
 * Automation runs table
 */
export const automationRuns = pgTable(
  'automation_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    status: automationRunStatusEnum('status').notNull(),
    passedTests: integer('passed_tests').notNull().default(0),
    failedTests: integer('failed_tests').notNull().default(0),
    skippedTests: integer('skipped_tests').notNull().default(0),
    totalTests: integer('total_tests').notNull().default(0),
    startTime: timestamp('start_time', { withTimezone: true }),
    endTime: timestamp('end_time', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectIdIdx: index('automation_runs_project_id_idx').on(table.projectId),
    statusIdx: index('automation_runs_status_idx').on(table.status),
    createdAtIdx: index('automation_runs_created_at_idx').on(table.createdAt),
  })
);

/**
 * Recording sessions table
 */
export const recordingSessions = pgTable(
  'recording_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    url: text('url').notNull(),
    status: recordingStatusEnum('status').notNull().default('recording'),
    duration: integer('duration').notNull().default(0), // in seconds
    interactionCount: integer('interaction_count').notNull().default(0),
    framework: frameworkEnum('framework').notNull().default('playwright'),
    confidence: integer('confidence').notNull().default(0), // 0-100 confidence score
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectIdIdx: index('recording_sessions_project_id_idx').on(table.projectId),
    userIdIdx: index('recording_sessions_user_id_idx').on(table.userId),
    statusIdx: index('recording_sessions_status_idx').on(table.status),
  })
);

/**
 * API keys table (for programmatic access)
 */
export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    keyHash: varchar('key_hash', { length: 255 }).notNull().unique(), // hashed API key
    prefix: varchar('prefix', { length: 10 }).notNull(), // first 10 chars for display
    scopes: text('scopes').array().notNull(), // ['test:read', 'test:write', 'run:execute']
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('api_keys_user_id_idx').on(table.userId),
    keyHashIdx: index('api_keys_key_hash_idx').on(table.keyHash),
  })
);

/**
 * Scheduled tests table
 */
export const scheduledTests = pgTable(
  'scheduled_tests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    cronExpression: varchar('cron_expression', { length: 255 }).notNull(),
    testPlanId: uuid('test_plan_id').references(() => testPlans.id, { onDelete: 'set null' }),
    isActive: boolean('is_active').notNull().default(true),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    nextRunAt: timestamp('next_run_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectIdIdx: index('scheduled_tests_project_id_idx').on(table.projectId),
    isActiveIdx: index('scheduled_tests_is_active_idx').on(table.isActive),
    nextRunAtIdx: index('scheduled_tests_next_run_at_idx').on(table.nextRunAt),
  })
);

/**
 * Notifications table
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    message: text('message').notNull(),
    type: notificationTypeEnum('type').notNull().default('info'),
    isRead: boolean('is_read').notNull().default(false),
    data: jsonb('data'), // Additional context (test_id, run_id, etc)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('notifications_user_id_idx').on(table.userId),
    isReadIdx: index('notifications_is_read_idx').on(table.isRead),
    createdAtIdx: index('notifications_created_at_idx').on(table.createdAt),
  })
);

/**
 * Integrations table (GitHub, GitLab, Jira, Slack, etc)
 */
export const integrations = pgTable(
  'integrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    type: integrationType('type').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    status: integrationStatusEnum('status').notNull().default('disconnected'),
    config: jsonb('config').notNull(), // API tokens, webhooks, etc (encrypted in app)
    connectedAt: timestamp('connected_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectIdIdx: index('integrations_project_id_idx').on(table.projectId),
    typeIdx: index('integrations_type_idx').on(table.type),
    statusIdx: index('integrations_status_idx').on(table.status),
  })
);

/**
 * Audit logs table
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 100 }).notNull(), // 'create', 'update', 'delete', 'run', etc
    resourceType: varchar('resource_type', { length: 100 }).notNull(), // 'test', 'project', 'test_run', etc
    resourceId: varchar('resource_id', { length: 255 }),
    details: jsonb('details'), // Full change details
    ipAddress: varchar('ip_address', { length: 45 }), // IPv4 or IPv6
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('audit_logs_user_id_idx').on(table.userId),
    resourceTypeIdx: index('audit_logs_resource_type_idx').on(table.resourceType),
    createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
  })
);

/**
 * Subscriptions table (Stripe integration)
 */
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
    plan: subscriptionPlanEnum('plan').notNull().default('free'),
    stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
    stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }).unique(),
    status: varchar('status', { length: 50 }).notNull().default('active'), // 'active', 'paused', 'cancelled'
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('subscriptions_user_id_idx').on(table.userId),
    statusIdx: index('subscriptions_status_idx').on(table.status),
  })
);

/**
 * Usage records table (for metering and analytics)
 */
export const usageRecords = pgTable(
  'usage_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    metric: varchar('metric', { length: 100 }).notNull(), // 'test_runs', 'api_calls', 'storage_gb'
    value: integer('value').notNull(),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('usage_records_user_id_idx').on(table.userId),
    metricIdx: index('usage_records_metric_idx').on(table.metric),
    periodIdx: index('usage_records_period_idx').on(table.periodStart, table.periodEnd),
  })
);

/**
 * Virtual services table (for mocking APIs)
 */
export const virtualServices = pgTable(
  'virtual_services',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    method: varchar('method', { length: 10 }).notNull().default('GET'), // HTTP method
    urlPath: varchar('url_path', { length: 512 }).notNull(),
    statusCode: integer('status_code').notNull().default(200),
    jsonBody: jsonb('json_body'), // Response body
    headers: jsonb('headers'), // Response headers
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectIdIdx: index('virtual_services_project_id_idx').on(table.projectId),
    methodUrlIdx: index('virtual_services_method_url_idx').on(table.method, table.urlPath),
  })
);

/**
 * Virtual service requests table (for logging mocked requests)
 */
export const virtualServiceRequests = pgTable(
  'virtual_service_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    virtualServiceId: uuid('virtual_service_id').references(() => virtualServices.id, { onDelete: 'cascade' }),
    method: varchar('method', { length: 10 }).notNull(),
    url: text('url').notNull(),
    headers: jsonb('headers'),
    body: jsonb('body'),
    queryParams: jsonb('query_params'),
    absoluteUrl: text('absolute_url').notNull(),
    wasMatched: boolean('was_matched').notNull().default(false),
    timingTotal: integer('timing_total').notNull().default(0),
    timingServe: integer('timing_serve').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    virtualServiceIdIdx: index('virtual_service_requests_virtual_service_id_idx').on(
      table.virtualServiceId
    ),
    createdAtIdx: index('virtual_service_requests_created_at_idx').on(table.createdAt),
  })
);

/**
 * Cycles table (for test planning/sprints)
 */
export const cycles = pgTable(
  'cycles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 50 }).notNull().default('planning'), // 'planning', 'active', 'completed'
    startDate: timestamp('start_date', { withTimezone: true }),
    endDate: timestamp('end_date', { withTimezone: true }),
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectIdIdx: index('cycles_project_id_idx').on(table.projectId),
    statusIdx: index('cycles_status_idx').on(table.status),
  })
);

/**
 * Export all table definitions
 */
export const schema = {
  users,
  projects,
  teamMembers,
  testCases,
  testPlans,
  testRuns,
  testResults,
  automationRuns,
  recordingSessions,
  apiKeys,
  scheduledTests,
  notifications,
  integrations,
  auditLogs,
  subscriptions,
  usageRecords,
  virtualServices,
  virtualServiceRequests,
  cycles,
};
