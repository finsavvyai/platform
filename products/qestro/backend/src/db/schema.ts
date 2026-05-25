import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    role: text('role').notNull().default('user'),
    subscription: text('subscription').notNull().default('free'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    passwordHash: text('password_hash'),
});

export const projects = sqliteTable('projects', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    ownerId: text('owner_id').references(() => users.id).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const automationRuns = sqliteTable('automation_runs', {
    id: text('id').primaryKey(),
    projectId: text('project_id').references(() => projects.id).notNull(),
    name: text('name').notNull(),
    status: text('status').notNull(), // 'running', 'passed', 'failed', 'queued'
    passedTests: integer('passed_tests').notNull().default(0),
    failedTests: integer('failed_tests').notNull().default(0),
    skippedTests: integer('skipped_tests').notNull().default(0),
    totalTests: integer('total_tests').notNull().default(0),
    startTime: integer('start_time', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const recordingSessions = sqliteTable('recording_sessions', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    url: text('url').notNull(),
    status: text('status').notNull(), // 'recording', 'completed', 'processing', 'error'
    duration: integer('duration').notNull().default(0),
    interactionCount: integer('interaction_count').notNull().default(0),
    framework: text('framework').notNull().default('playwright'),
    confidence: integer('confidence').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const virtualServices = sqliteTable('virtual_services', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    method: text('method').notNull().default('GET'),
    urlPath: text('url_path').notNull(),
    status: integer('status').notNull().default(200),
    jsonBody: text('json_body'), // Stored as JSON string
    headers: text('headers'), // Stored as JSON string
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const testCases = sqliteTable('test_cases', {
    id: text('id').primaryKey(),
    // Human-readable display ID (e.g. "TC-0042"). UNIQUE; nullable during
    // backfill for legacy rows. New rows always populate it via allocateDisplayId().
    displayId: text('display_id'),
    projectId: text('project_id').references(() => projects.id).notNull(),
    title: text('title').notNull(),
    status: text('status').notNull().default('Draft'),
    priority: text('priority').notNull().default('Medium'),
    type: text('type').notNull().default('Functional'),
    jiraIssue: text('jira_issue'),
    description: text('description'),
    testCode: text('test_code'), // Generated Playwright code
    testData: text('test_data'), // JSON string for arbitrary metadata (e.g. acceptance runs)
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// Global per-entity counter for allocating human-readable display IDs.
// One row per entity type ('test_case' | 'test_run' | 'test_plan').
// Allocation is an atomic UPDATE ... RETURNING in D1 (see lib/display-id.ts).
export const idCounters = sqliteTable('id_counters', {
    entity: text('entity').primaryKey(),
    current: integer('current').notNull().default(0),
    updatedAt: integer('updated_at').notNull(),
});

export const virtualServiceRequests = sqliteTable('virtual_service_requests', {
    id: text('id').primaryKey(),
    virtualServiceId: text('virtual_service_id').references(() => virtualServices.id),
    method: text('method').notNull(),
    url: text('url').notNull(),
    headers: text('headers'), // JSON string
    body: text('body'), // JSON string
    queryParams: text('query_params'), // JSON string
    absoluteUrl: text('absolute_url').notNull(),
    wasMatched: integer('was_matched', { mode: 'boolean' }).notNull().default(false),
    timingTotal: integer('timing_total').notNull().default(0),
    timingServe: integer('timing_serve').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const userOnboarding = sqliteTable('user_onboarding', {
    userId: text('user_id').primaryKey().references(() => users.id),
    completedSteps: text('completed_steps').notNull().default('[]'),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// One recording per test run. Bytes live in R2 (binding RECORDINGS);
// this row is the metadata index (size, duration, content type).
export const testRunRecordings = sqliteTable('test_run_recordings', {
    runId: text('run_id').primaryKey(),
    r2Key: text('r2_key').notNull(),
    sizeBytes: integer('size_bytes').notNull().default(0),
    durationMs: integer('duration_ms').notNull().default(0),
    contentType: text('content_type').notNull().default('video/webm'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export { testPlans, testRuns, cycles } from './schema-plans';
