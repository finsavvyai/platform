/**
 * Remediation Engine Schema
 *
 * Tables for automated remediation playbooks and execution runs.
 */
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations.js';

export const remediationPlaybooks = sqliteTable('remediation_playbooks', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  triggerType: text('trigger_type').notNull(), // manual, policy_violation, threshold
  triggerConfig: text('trigger_config'), // JSON config for auto-trigger
  steps: text('steps').notNull(), // JSON array of ordered steps
  status: text('status').notNull().default('active'), // active, disabled, archived
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const remediationRuns = sqliteTable('remediation_runs', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  playbookId: text('playbook_id').notNull().references(() => remediationPlaybooks.id),
  triggeredBy: text('triggered_by').notNull(), // userId or 'system'
  status: text('status').notNull().default('running'), // running, completed, failed, cancelled
  currentStep: integer('current_step').notNull().default(0),
  totalSteps: integer('total_steps').notNull(),
  stepResults: text('step_results'), // JSON array of step outcomes
  startedAt: text('started_at').notNull().default(sql`(datetime('now'))`),
  completedAt: text('completed_at'),
  errorMessage: text('error_message'),
});
