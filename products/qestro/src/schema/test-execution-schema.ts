import {
  sqliteTable,
  text,
  integer,
  real,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { coreSchema } from './core-schema.js';

// Test executions track a queued or active run across one or more test cases.
export const testExecutions = sqliteTable('test_executions', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => coreSchema.projects.id, { onDelete: 'cascade' }),
  testSuiteId: text('test_suite_id').references(() => coreSchema.testSuites.id, {
    onDelete: 'cascade',
  }),
  status: text('status').notNull().default('pending'),
  environment: text('environment').notNull(),
  config: text('config'),
  metadata: text('metadata'),
  summary: text('summary'),
  error: text('error'),
  requestedBy: text('requested_by').notNull(),
  scheduledFor: integer('scheduled_for'),
  startedAt: integer('started_at'),
  completedAt: integer('completed_at'),
  totalTests: integer('total_tests').default(0),
  passedTests: integer('passed_tests').default(0),
  failedTests: integer('failed_tests').default(0),
  skippedTests: integer('skipped_tests').default(0),
  duration: integer('duration'),
  artifacts: text('artifacts'),
  performance: text('performance'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  projectIdIdx: sql`CREATE INDEX test_executions_project_id_idx ON ${table.name} (project_id)`,
  statusIdx: sql`CREATE INDEX test_executions_status_idx ON ${table.name} (status)`,
  createdAtIdx: sql`CREATE INDEX test_executions_created_at_idx ON ${table.name} (created_at)`,
}));

// Each record represents one test case inside an execution.
export const testExecutionResults = sqliteTable('test_execution_results', {
  id: text('id').primaryKey(),
  executionId: text('execution_id')
    .notNull()
    .references(() => testExecutions.id, { onDelete: 'cascade' }),
  testId: text('test_id')
    .notNull()
    .references(() => coreSchema.testCases.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'),
  result: text('result'),
  artifacts: text('artifacts'),
  performance: text('performance'),
  error: text('error'),
  retryCount: integer('retry_count').default(0),
  startedAt: integer('started_at'),
  completedAt: integer('completed_at'),
  duration: integer('duration'),
  platform: text('platform'),
  executorId: text('executor_id'),
  environment: text('environment'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  executionIdIdx: sql`CREATE INDEX test_execution_results_execution_id_idx ON ${table.name} (execution_id)`,
  testIdIdx: sql`CREATE INDEX test_execution_results_test_id_idx ON ${table.name} (test_id)`,
  statusIdx: sql`CREATE INDEX test_execution_results_status_idx ON ${table.name} (status)`,
}));

// Aggregated execution metrics power reporting and trend endpoints.
export const testExecutionMetrics = sqliteTable('test_execution_metrics', {
  id: text('id').primaryKey(),
  executionId: text('execution_id')
    .notNull()
    .references(() => testExecutions.id, { onDelete: 'cascade' }),
  projectId: text('project_id')
    .notNull()
    .references(() => coreSchema.projects.id, { onDelete: 'cascade' }),
  totalTests: integer('total_tests').notNull(),
  passedTests: integer('passed_tests').notNull(),
  failedTests: integer('failed_tests').notNull(),
  skippedTests: integer('skipped_tests').notNull(),
  averageDuration: real('average_duration'),
  totalDuration: integer('total_duration'),
  successRate: real('success_rate'),
  performanceMetrics: text('performance_metrics'),
  resourceUtilization: text('resource_utilization'),
  environmentMetrics: text('environment_metrics'),
  qualityScore: real('quality_score'),
  timestamp: integer('timestamp').notNull(),
}, (table) => ({
  executionIdIdx: sql`CREATE INDEX test_execution_metrics_execution_id_idx ON ${table.name} (execution_id)`,
  projectIdIdx: sql`CREATE INDEX test_execution_metrics_project_id_idx ON ${table.name} (project_id)`,
  timestampIdx: sql`CREATE INDEX test_execution_metrics_timestamp_idx ON ${table.name} (timestamp)`,
}));

// Artifacts store files and generated data for an execution or individual test result.
export const testArtifacts = sqliteTable('test_artifacts', {
  id: text('id').primaryKey(),
  executionId: text('execution_id')
    .notNull()
    .references(() => testExecutions.id, { onDelete: 'cascade' }),
  testResultId: text('test_result_id').references(
    () => testExecutionResults.id,
    { onDelete: 'cascade' },
  ),
  type: text('type').notNull(),
  name: text('name').notNull(),
  path: text('path').notNull(),
  size: integer('size').default(0),
  contentType: text('content_type'),
  metadata: text('metadata'),
  checksum: text('checksum'),
  storageLocation: text('storage_location'),
  isPublic: integer('is_public', { mode: 'boolean' }).default(false),
  retentionUntil: integer('retention_until'),
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  executionIdIdx: sql`CREATE INDEX test_artifacts_execution_id_idx ON ${table.name} (execution_id)`,
  testResultIdIdx: sql`CREATE INDEX test_artifacts_test_result_id_idx ON ${table.name} (test_result_id)`,
  typeIdx: sql`CREATE INDEX test_artifacts_type_idx ON ${table.name} (type)`,
}));

export const testExecutionSchema = {
  testExecutions,
  testExecutionResults,
  testExecutionMetrics,
  testArtifacts,
};

export default testExecutionSchema;
