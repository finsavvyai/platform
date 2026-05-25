import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

/**
 * Alert & Recommendation System Schemas
 *
 * Manages alerts, their lifecycle, and historical tracking.
 */

export const alerts = sqliteTable('alerts', {
	id: text('id').primaryKey(),
	tenantId: text('tenant_id').notNull(),
	type: text('type').notNull(), // 'security', 'optimization', 'compliance', 'operational'
	severity: text('severity').notNull(), // 'critical', 'high', 'medium', 'low'
	title: text('title').notNull(),
	description: text('description').notNull(),
	source: text('source').notNull(), // 'intelligence_engine', 'graph_api', 'manual'
	status: text('status').notNull().default('active'), // 'active', 'dismissed', 'resolved', 'in_progress'
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull(),
	resolvedAt: text('resolved_at'),
	resolvedBy: text('resolved_by'),
	resolutionNotes: text('resolution_notes'),

	// Business impact
	estimatedCostImpact: integer('estimated_cost_impact'), // cents per month
	estimatedRiskScore: integer('estimated_risk_score'), // 0-100
	affectedUsers: integer('affected_users'),

	// Context
	resourceId: text('resource_id'), // user_id, license_id, etc.
	resourceType: text('resource_type'), // 'user', 'license', 'policy', etc.
	metadata: text('metadata'), // JSON with additional context

	// Recommendations
	recommendations: text('recommendations'), // JSON array of recommended actions

	// Auto-remediation
	canAutoRemediate: integer('can_auto_remediate').default(0), // boolean
	autoRemediationAction: text('auto_remediation_action'),
}, (table) => ({
	tenantStatusIdx: index('idx_alerts_tenant_status').on(table.tenantId, table.status),
	severityIdx: index('idx_alerts_severity').on(table.severity),
	createdAtIdx: index('idx_alerts_created_at').on(table.createdAt),
}));

export const alertHistory = sqliteTable('alert_history', {
	id: text('id').primaryKey(),
	alertId: text('alert_id').notNull(),
	action: text('action').notNull(), // 'created', 'updated', 'dismissed', 'resolved', 'remediated'
	performedBy: text('performed_by').notNull(),
	performedAt: text('performed_at').notNull(),
	notes: text('notes'),
	metadata: text('metadata'), // JSON
});
