import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

/**
 * Audit & Reporting Schemas
 *
 * Complete audit trail and custom report management.
 */

export const auditLogs = sqliteTable('audit_logs', {
	id: text('id').primaryKey(),
	tenantId: text('tenant_id').notNull(),
	eventType: text('event_type').notNull(), // 'user.created', 'license.assigned', 'policy.changed', etc.
	actorId: text('actor_id').notNull(), // User or system that performed action
	actorType: text('actor_type').notNull(), // 'user', 'system', 'workflow'

	resourceId: text('resource_id'),
	resourceType: text('resource_type'), // 'user', 'license', 'policy', etc.

	action: text('action').notNull(), // 'created', 'updated', 'deleted', 'assigned', etc.
	result: text('result').notNull(), // 'success', 'failed'

	// Details
	details: text('details'), // JSON with full context
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),

	// Timing
	timestamp: text('timestamp').notNull(),

	// Compliance
	complianceCategory: text('compliance_category'), // For GDPR/HIPAA/SOC2 reporting
}, (table) => ({
	tenantTimestampIdx: index('idx_audit_tenant_timestamp').on(table.tenantId, table.timestamp),
	eventTypeIdx: index('idx_audit_event_type').on(table.eventType),
	actorIdx: index('idx_audit_actor').on(table.actorId),
	resourceIdx: index('idx_audit_resource').on(table.resourceId),
}));

export const reports = sqliteTable('reports', {
	id: text('id').primaryKey(),
	tenantId: text('tenant_id').notNull(),
	name: text('name').notNull(),
	type: text('type').notNull(), // 'compliance', 'security', 'license', 'custom'
	format: text('format').notNull(), // 'pdf', 'csv', 'json'

	// Schedule
	schedule: text('schedule'), // Cron expression for recurring reports

	// Configuration
	parameters: text('parameters'), // JSON query parameters

	// Metadata
	createdAt: text('created_at').notNull(),
	createdBy: text('created_by').notNull(),
	lastGeneratedAt: text('last_generated_at'),
});

export const reportExecutions = sqliteTable('report_executions', {
	id: text('id').primaryKey(),
	reportId: text('report_id').notNull(),
	tenantId: text('tenant_id').notNull(),

	generatedAt: text('generated_at').notNull(),
	generatedBy: text('generated_by').notNull(),

	status: text('status').notNull(), // 'completed', 'failed'
	fileUrl: text('file_url'), // R2 URL for generated report

	rowCount: integer('row_count'),
	fileSize: integer('file_size'),
});
