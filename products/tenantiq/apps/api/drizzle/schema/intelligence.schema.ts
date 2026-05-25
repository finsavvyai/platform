import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * Intelligence Engine Schemas
 *
 * Tracks background scans and user activity snapshots for continuous tenant analysis.
 */

export const intelligenceScans = sqliteTable('intelligence_scans', {
	id: text('id').primaryKey(),
	tenantId: text('tenant_id').notNull(),
	scanType: text('scan_type').notNull(), // 'inactive_users', 'license_waste', 'security', 'compliance', 'backup'
	startedAt: text('started_at').notNull(),
	completedAt: text('completed_at'),
	status: text('status').notNull(), // 'running', 'completed', 'failed'
	findingsCount: integer('findings_count').default(0),
	alertsCreated: integer('alerts_created').default(0),
	metadata: text('metadata'), // JSON
});

export const userActivitySnapshots = sqliteTable('user_activity_snapshots', {
	id: text('id').primaryKey(),
	tenantId: text('tenant_id').notNull(),
	userId: text('user_id').notNull(),
	lastSignIn: text('last_sign_in'),
	lastExchangeActivity: text('last_exchange_activity'),
	lastTeamsActivity: text('last_teams_activity'),
	lastSharepointActivity: text('last_sharepoint_activity'),
	assignedLicenses: text('assigned_licenses'), // JSON array
	licenseCostMonthly: integer('license_cost_monthly'), // cents
	snapshotDate: text('snapshot_date').notNull(),
	activityScore: integer('activity_score'), // 0-100, based on recent activity
});
