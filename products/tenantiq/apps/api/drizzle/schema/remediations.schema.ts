import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * Remediation Engine Schemas
 *
 * Tracks remediation actions and their execution steps.
 */

export const remediations = sqliteTable('remediations', {
	id: text('id').primaryKey(),
	alertId: text('alert_id').notNull(),
	tenantId: text('tenant_id').notNull(),
	actionType: text('action_type').notNull(), // 'decommission_user', 'downgrade_license', 'enable_policy', 'block_ip', etc.
	status: text('status').notNull().default('pending'), // 'pending', 'running', 'completed', 'failed', 'rolled_back'

	// Scheduling
	scheduledAt: text('scheduled_at'), // ISO date for deferred execution

	// Execution details
	initiatedBy: text('initiated_by').notNull(),
	initiatedAt: text('initiated_at').notNull(),
	startedAt: text('started_at'),
	completedAt: text('completed_at'),

	// Action data
	targetResourceId: text('target_resource_id').notNull(),
	targetResourceType: text('target_resource_type').notNull(),
	actionParameters: text('action_parameters'), // JSON

	// Results
	success: integer('success').default(0), // boolean
	errorMessage: text('error_message'),
	stepsCompleted: text('steps_completed'), // JSON array of completed steps

	// Rollback
	canRollback: integer('can_rollback').default(1), // boolean
	rollbackData: text('rollback_data'), // JSON snapshot for rollback
	rolledBackAt: text('rolled_back_at'),
	rolledBackBy: text('rolled_back_by'),
});

export const remediationSteps = sqliteTable('remediation_steps', {
	id: text('id').primaryKey(),
	remediationId: text('remediation_id').notNull(),
	stepNumber: integer('step_number').notNull(),
	description: text('description').notNull(),
	status: text('status').notNull(), // 'pending', 'running', 'completed', 'failed', 'skipped'
	startedAt: text('started_at'),
	completedAt: text('completed_at'),
	result: text('result'), // JSON
});
