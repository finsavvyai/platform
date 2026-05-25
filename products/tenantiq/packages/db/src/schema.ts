import {
	pgTable,
	uuid,
	text,
	timestamp,
	boolean,
	integer,
	numeric,
	jsonb,
	inet,
	index,
	uniqueIndex
} from 'drizzle-orm/pg-core';

// ============================================================
// Organizations
// ============================================================
export const organizations = pgTable('organizations', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	type: text('type').notNull(), // 'direct' | 'msp'
	billingPlan: text('billing_plan').notNull().default('free'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
});

// ============================================================
// Tenants
// ============================================================
export const tenants = pgTable('tenants', {
	id: uuid('id').primaryKey().defaultRandom(),
	organizationId: uuid('organization_id').references(() => organizations.id),
	azureTenantId: text('azure_tenant_id').unique().notNull(),
	displayName: text('display_name').notNull(),
	domain: text('domain'),
	accessTokenEncrypted: text('access_token_encrypted'),
	refreshTokenEncrypted: text('refresh_token_encrypted'),
	tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
	lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
	status: text('status').default('active'), // 'active' | 'suspended' | 'disconnected'
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
});

// ============================================================
// Users Cache (synced from Graph API)
// ============================================================
export const usersCache = pgTable(
	'users_cache',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		tenantId: uuid('tenant_id')
			.references(() => tenants.id, { onDelete: 'cascade' })
			.notNull(),
		azureUserId: text('azure_user_id').notNull(),
		displayName: text('display_name'),
		email: text('email'),
		userType: text('user_type'), // 'member' | 'guest'
		accountEnabled: boolean('account_enabled'),
		lastSignIn: timestamp('last_sign_in', { withTimezone: true }),
		lastNonInteractiveSignIn: timestamp('last_non_interactive_sign_in', { withTimezone: true }),
		assignedLicenses: jsonb('assigned_licenses').default([]),
		assignedGroups: jsonb('assigned_groups').default([]),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
	},
	(table) => [
		uniqueIndex('idx_users_cache_tenant_azure').on(table.tenantId, table.azureUserId),
		index('idx_users_cache_tenant_signin').on(table.tenantId, table.lastSignIn)
	]
);

// ============================================================
// Licenses Cache
// ============================================================
export const licensesCache = pgTable(
	'licenses_cache',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		tenantId: uuid('tenant_id')
			.references(() => tenants.id, { onDelete: 'cascade' })
			.notNull(),
		skuId: text('sku_id').notNull(),
		skuName: text('sku_name').notNull(),
		total: integer('total').notNull(),
		assigned: integer('assigned').notNull(),
		costPerUnit: numeric('cost_per_unit', { precision: 10, scale: 2 }),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
	},
	(table) => [uniqueIndex('idx_licenses_cache_tenant_sku').on(table.tenantId, table.skuId)]
);

// ============================================================
// Alerts
// ============================================================
export const alerts = pgTable(
	'alerts',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		tenantId: uuid('tenant_id')
			.references(() => tenants.id, { onDelete: 'cascade' })
			.notNull(),
		ruleId: text('rule_id').notNull(),
		severity: text('severity').notNull(), // 'critical' | 'high' | 'medium' | 'low'
		category: text('category').notNull(), // 'security' | 'optimization' | 'compliance' | 'operational'
		title: text('title').notNull(),
		description: text('description'),
		businessImpact: text('business_impact'),
		affectedResources: jsonb('affected_resources').default([]),
		recommendedAction: text('recommended_action'),
		remediationType: text('remediation_type'), // 'automatic' | 'semi_automatic' | 'manual'
		status: text('status').default('active'), // 'active' | 'acknowledged' | 'resolved' | 'dismissed'
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
		resolvedAt: timestamp('resolved_at', { withTimezone: true }),
		resolvedBy: text('resolved_by')
	},
	(table) => [
		index('idx_alerts_tenant_status').on(table.tenantId, table.status),
		index('idx_alerts_tenant_severity').on(table.tenantId, table.severity)
	]
);

// ============================================================
// Remediation Log
// ============================================================
export const remediationLog = pgTable(
	'remediation_log',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		tenantId: uuid('tenant_id')
			.references(() => tenants.id, { onDelete: 'cascade' })
			.notNull(),
		alertId: uuid('alert_id').references(() => alerts.id),
		actionId: text('action_id').notNull(),
		executedBy: text('executed_by').notNull(), // user email, 'system', 'ai_agent'
		status: text('status').notNull(), // 'pending' | 'executing' | 'success' | 'failed' | 'rolled_back'
		beforeState: jsonb('before_state'),
		afterState: jsonb('after_state'),
		errorMessage: text('error_message'),
		executedAt: timestamp('executed_at', { withTimezone: true }).defaultNow(),
		rollbackAvailable: boolean('rollback_available').default(true),
		rollbackExpiresAt: timestamp('rollback_expires_at', { withTimezone: true })
	},
	(table) => [index('idx_remediation_tenant_status').on(table.tenantId, table.status)]
);

// ============================================================
// Audit Log
// ============================================================
export const auditLog = pgTable(
	'audit_log',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		tenantId: uuid('tenant_id')
			.references(() => tenants.id, { onDelete: 'cascade' })
			.notNull(),
		actor: text('actor').notNull(), // user email, 'system', 'ai_agent'
		action: text('action').notNull(),
		resourceType: text('resource_type'), // 'user', 'group', 'license', 'policy'
		resourceId: text('resource_id'),
		details: jsonb('details'),
		ipAddress: inet('ip_address'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
	},
	(table) => [index('idx_audit_log_tenant_created').on(table.tenantId, table.createdAt)]
);

// ============================================================
// Workflows
// ============================================================
export const workflows = pgTable('workflows', {
	id: uuid('id').primaryKey().defaultRandom(),
	tenantId: uuid('tenant_id')
		.references(() => tenants.id, { onDelete: 'cascade' })
		.notNull(),
	name: text('name').notNull(),
	workflowType: text('workflow_type').notNull(),
	triggerType: text('trigger_type').notNull(), // 'cron' | 'webhook' | 'manual' | 'conditional'
	triggerConfig: jsonb('trigger_config'),
	steps: jsonb('steps').notNull(),
	requiresApproval: boolean('requires_approval').default(false),
	enabled: boolean('enabled').default(true),
	lastRunAt: timestamp('last_run_at', { withTimezone: true }),
	lastRunStatus: text('last_run_status'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
});

// ============================================================
// Workflow Runs
// ============================================================
export const workflowRuns = pgTable('workflow_runs', {
	id: uuid('id').primaryKey().defaultRandom(),
	workflowId: uuid('workflow_id').references(() => workflows.id),
	tenantId: uuid('tenant_id')
		.references(() => tenants.id, { onDelete: 'cascade' })
		.notNull(),
	status: text('status').notNull(), // 'pending_approval' | 'running' | 'completed' | 'failed' | 'cancelled'
	stepsCompleted: integer('steps_completed').default(0),
	stepsTotal: integer('steps_total').notNull(),
	results: jsonb('results'),
	startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
	completedAt: timestamp('completed_at', { withTimezone: true }),
	approvedBy: text('approved_by')
});

// ============================================================
// AI Conversations
// ============================================================
export const aiConversations = pgTable('ai_conversations', {
	id: uuid('id').primaryKey().defaultRandom(),
	tenantId: uuid('tenant_id')
		.references(() => tenants.id, { onDelete: 'cascade' })
		.notNull(),
	userEmail: text('user_email').notNull(),
	messages: jsonb('messages').notNull().default([]),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
});

// ============================================================
// Webhook Configurations
// ============================================================
export const webhookConfigs = pgTable(
	'webhook_configs',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		tenantId: uuid('tenant_id')
			.references(() => tenants.id, { onDelete: 'cascade' })
			.notNull(),
		userId: uuid('user_id').references(() => platformUsers.id, { onDelete: 'cascade' }),

		// Webhook details
		webhookUrl: text('webhook_url').notNull(),
		webhookSecret: text('webhook_secret').notNull(), // HMAC secret

		// Notification preferences
		enabled: boolean('enabled').default(true),
		notificationMode: text('notification_mode').default('realtime'), // 'realtime' | 'digest_hourly' | 'digest_daily'

		// Filtering
		minSeverity: text('min_severity'), // null = all, 'critical', 'high', 'medium', 'low'
		categories: jsonb('categories').default([]), // ['security', 'compliance', 'optimization', 'operational']

		// Quiet hours
		quietHoursStart: text('quiet_hours_start'), // HH:MM format
		quietHoursEnd: text('quiet_hours_end'), // HH:MM format
		quietHoursTimezone: text('quiet_hours_timezone').default('UTC'),

		// Metadata
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
	},
	(table) => [
		index('idx_webhook_configs_tenant').on(table.tenantId),
		index('idx_webhook_configs_user').on(table.userId)
	]
);

// ============================================================
// Webhook Deliveries
// ============================================================
export const webhookDeliveries = pgTable(
	'webhook_deliveries',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		webhookConfigId: uuid('webhook_config_id')
			.references(() => webhookConfigs.id, { onDelete: 'cascade' })
			.notNull(),

		// Event details
		eventType: text('event_type').notNull(), // 'alert.created', 'alert.updated', etc.
		payload: jsonb('payload').notNull(),

		// Delivery status
		status: text('status').default('pending'), // 'pending', 'delivered', 'failed', 'retrying'
		attempts: integer('attempts').default(0),
		lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
		nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),

		// Response
		responseStatus: integer('response_status'),
		responseBody: text('response_body'),
		errorMessage: text('error_message'),

		// Timestamps
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
		deliveredAt: timestamp('delivered_at', { withTimezone: true })
	},
	(table) => [
		index('idx_webhook_deliveries_config').on(table.webhookConfigId),
		index('idx_webhook_deliveries_status').on(table.status),
		index('idx_webhook_deliveries_next_retry').on(table.nextRetryAt)
	]
);

// ============================================================
// Platform Users
// ============================================================
export const platformUsers = pgTable('platform_users', {
	id: uuid('id').primaryKey().defaultRandom(),
	organizationId: uuid('organization_id').references(() => organizations.id),
	email: text('email').unique().notNull(),
	name: text('name'),
	role: text('role').notNull().default('viewer'), // 'viewer' | 'operator' | 'admin' | 'super_admin'
	azureOid: text('azure_oid'), // Azure AD object ID
	lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
});
