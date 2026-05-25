import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * Workflow Automation Schemas
 *
 * Manages automated workflows and their executions.
 */

export const workflows = sqliteTable('workflows', {
	id: text('id').primaryKey(),
	tenantId: text('tenant_id').notNull(),
	name: text('name').notNull(),
	type: text('type').notNull(), // 'onboarding', 'offboarding', 'license_optimization', etc.
	schedule: text('schedule'), // Cron expression
	enabled: integer('enabled').default(1), // boolean

	// Configuration
	parameters: text('parameters'), // JSON
	conditions: text('conditions'), // JSON (if X then Y logic)

	// Metadata
	createdAt: text('created_at').notNull(),
	createdBy: text('created_by').notNull(),
	updatedAt: text('updated_at').notNull(),
	lastExecutedAt: text('last_executed_at'),
	nextExecutionAt: text('next_execution_at'),
});

export const workflowExecutions = sqliteTable('workflow_executions', {
	id: text('id').primaryKey(),
	workflowId: text('workflow_id').notNull(),
	tenantId: text('tenant_id').notNull(),
	status: text('status').notNull(), // 'pending', 'running', 'completed', 'failed', 'cancelled'
	triggerType: text('trigger_type').notNull(), // 'scheduled', 'manual', 'event', 'conditional'

	startedAt: text('started_at').notNull(),
	completedAt: text('completed_at'),

	stepsTotal: integer('steps_total'),
	stepsCompleted: integer('steps_completed'),
	stepsFailed: integer('steps_failed'),

	result: text('result'), // JSON
	errorMessage: text('error_message'),
});
