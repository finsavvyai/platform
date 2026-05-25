import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { organizations } from './organizations.js';

/**
 * Runbook engine — incident playbook execution state.
 *
 * Runbook *definitions* live as JSON in `skills/runbooks/*.json` (loaded by
 * apps/api/src/services/runbooks/loader.ts) — they're versioned with code,
 * not stored in DB. We persist *runs* and per-step logs so operators can
 * audit, replay, and debug incident response.
 *
 *   tf_runbook_runs          one row per execution attempt
 *   tf_runbook_step_logs     one row per step inside a run
 */

export const tfRunbookRuns = sqliteTable(
  'tf_runbook_runs',
  {
    id: text('id').primaryKey(),
    runbookId: text('runbook_id').notNull(),

    // Optional alert that triggered this run (null for manual runs).
    triggerAlertId: text('trigger_alert_id'),
    // Free-form source label: 'manual' | 'alert' | 'webhook' | 'cron'.
    triggerSource: text('trigger_source').notNull().default('manual'),

    status: text('status', {
      enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
    })
      .notNull()
      .default('pending'),

    startedAt: text('started_at'),
    completedAt: text('completed_at'),

    // Index of the step currently executing (or last attempted if failed).
    currentStepIndex: integer('current_step_index').notNull().default(0),

    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => users.id),
    orgId: text('org_id').references(() => organizations.id),

    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    statusIdx: index('idx_tf_runbook_runs_status').on(table.status),
    startedAtIdx: index('idx_tf_runbook_runs_started_at').on(table.startedAt),
    runbookIdIdx: index('idx_tf_runbook_runs_runbook_id').on(table.runbookId),
    ownerIdx: index('idx_tf_runbook_runs_owner').on(table.ownerUserId),
  }),
);

export const tfRunbookStepLogs = sqliteTable(
  'tf_runbook_step_logs',
  {
    id: text('id').primaryKey(),
    runId: text('run_id')
      .notNull()
      .references(() => tfRunbookRuns.id),

    stepIndex: integer('step_index').notNull(),
    // Action name the step invoked (e.g., 'call_skill', 'http_request').
    action: text('action').notNull(),

    // JSON-serialized inputs and outputs for replay/debugging.
    inputJson: text('input_json'),
    outputJson: text('output_json'),

    status: text('status', {
      enum: ['pending', 'running', 'success', 'error', 'skipped'],
    })
      .notNull()
      .default('pending'),

    startedAt: text('started_at'),
    completedAt: text('completed_at'),
    errorMessage: text('error_message'),
  },
  (table) => ({
    runIdIdx: index('idx_tf_runbook_step_logs_run_id').on(table.runId),
    statusIdx: index('idx_tf_runbook_step_logs_status').on(table.status),
    startedAtIdx: index('idx_tf_runbook_step_logs_started_at').on(table.startedAt),
  }),
);

export type TfRunbookRun = typeof tfRunbookRuns.$inferSelect;
export type NewTfRunbookRun = typeof tfRunbookRuns.$inferInsert;
export type TfRunbookStepLog = typeof tfRunbookStepLogs.$inferSelect;
export type NewTfRunbookStepLog = typeof tfRunbookStepLogs.$inferInsert;
