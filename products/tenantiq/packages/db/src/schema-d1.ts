/**
 * D1/SQLite Schema for TenantIQ
 *
 * This schema matches the Cloudflare D1 database created via 0001_initial_d1.sql.
 * Use this for all Cloudflare Workers (D1) queries.
 *
 * The schema.ts file uses pgTable (PostgreSQL) for local development / Neon.
 * This file uses sqliteTable for production D1 deployment.
 */

import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

// ============================================================
// Organizations
// ============================================================
export const organizations = sqliteTable('organizations', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	type: text('type').notNull(), // 'direct' | 'msp'
	billingPlan: text('billing_plan').notNull().default('free'),
	createdAt: integer('created_at').notNull(),
});

// ============================================================
// Tenants
// ============================================================
export const tenants = sqliteTable(
	'tenants',
	{
		id: text('id').primaryKey(),
		organizationId: text('organization_id').notNull(),
		azureTenantId: text('azure_tenant_id').notNull(),
		displayName: text('display_name').notNull(),
		domain: text('domain'),
		accessTokenEncrypted: text('access_token_encrypted'),
		refreshTokenEncrypted: text('refresh_token_encrypted'),
		tokenExpiresAt: integer('token_expires_at'),
		lastSyncAt: integer('last_sync_at'),
		status: text('status').default('active'), // 'active' | 'suspended' | 'disconnected'
		createdAt: integer('created_at').notNull(),
	},
	(table) => [
		index('idx_tenants_org').on(table.organizationId),
		uniqueIndex('idx_tenants_azure').on(table.azureTenantId),
	]
);

// ============================================================
// Platform Users
// ============================================================
export const platformUsers = sqliteTable(
	'platform_users',
	{
		id: text('id').primaryKey(),
		organizationId: text('organization_id').notNull(),
		email: text('email').notNull(),
		displayName: text('display_name'),
		passwordHash: text('password_hash'),
		role: text('role').notNull().default('admin'), // 'admin' | 'member' | 'viewer'
		status: text('status').default('active'),
		azureOid: text('azure_oid'),
		lastLoginAt: integer('last_login_at'),
		createdAt: integer('created_at').notNull(),
	},
	(table) => [
		index('idx_platform_users_org').on(table.organizationId),
		uniqueIndex('idx_platform_users_email').on(table.email),
	]
);

// ============================================================
// Users Cache (M365 users synced from Graph API)
// ============================================================
export const usersCache = sqliteTable(
	'users_cache',
	{
		id: text('id').primaryKey(),
		tenantId: text('tenant_id').notNull(),
		azureUserId: text('azure_user_id').notNull(),
		userPrincipalName: text('user_principal_name').notNull(),
		displayName: text('display_name'),
		mail: text('mail'),
		jobTitle: text('job_title'),
		department: text('department'),
		accountEnabled: integer('account_enabled').default(1), // SQLite uses INTEGER for boolean
		lastSignInAt: integer('last_sign_in_at'),
		createdAt: integer('created_at').notNull(),
		syncedAt: integer('synced_at').notNull(),
	},
	(table) => [
		index('idx_users_tenant').on(table.tenantId),
		uniqueIndex('idx_users_azure').on(table.tenantId, table.azureUserId),
	]
);

// ============================================================
// Licenses Cache
// ============================================================
export const licensesCache = sqliteTable(
	'licenses_cache',
	{
		id: text('id').primaryKey(),
		tenantId: text('tenant_id').notNull(),
		skuId: text('sku_id').notNull(),
		skuPartNumber: text('sku_part_number').notNull(),
		consumedUnits: integer('consumed_units').default(0),
		enabledUnits: integer('enabled_units').default(0),
		prepaidUnits: integer('prepaid_units').default(0),
		syncedAt: integer('synced_at').notNull(),
	},
	(table) => [index('idx_licenses_tenant').on(table.tenantId)]
);

// ============================================================
// User Licenses
// ============================================================
export const userLicenses = sqliteTable(
	'user_licenses',
	{
		id: text('id').primaryKey(),
		tenantId: text('tenant_id').notNull(),
		userId: text('user_id').notNull(),
		skuId: text('sku_id').notNull(),
		assignedAt: integer('assigned_at'),
	},
	(table) => [
		index('idx_user_licenses_tenant').on(table.tenantId),
		index('idx_user_licenses_user').on(table.userId),
	]
);

// ============================================================
// Security Alerts
// ============================================================
export const securityAlerts = sqliteTable(
	'security_alerts',
	{
		id: text('id').primaryKey(),
		tenantId: text('tenant_id').notNull(),
		alertType: text('alert_type').notNull(), // 'inactive_license' | 'security_risk' | 'compliance' | 'cost_optimization'
		severity: text('severity').notNull(), // 'low' | 'medium' | 'high' | 'critical'
		title: text('title').notNull(),
		description: text('description'),
		affectedUsers: integer('affected_users').default(0),
		potentialSavings: real('potential_savings').default(0),
		status: text('status').default('active'), // 'active' | 'acknowledged' | 'resolved' | 'dismissed'
		metadata: text('metadata'), // JSON string
		detectedAt: integer('detected_at').notNull(),
		resolvedAt: integer('resolved_at'),
	},
	(table) => [
		index('idx_alerts_tenant').on(table.tenantId),
		index('idx_alerts_status').on(table.status),
	]
);

// ============================================================
// Webhook Configs
// ============================================================
export const webhookConfigs = sqliteTable(
	'webhook_configs',
	{
		id: text('id').primaryKey(),
		tenantId: text('tenant_id').notNull(),
		webhookUrl: text('webhook_url').notNull(),
		webhookSecret: text('webhook_secret').notNull(),
		enabled: integer('enabled').default(1),
		notificationMode: text('notification_mode').default('realtime'),
		minSeverity: text('min_severity'),
		categories: text('categories'), // JSON array string
		quietHoursStart: text('quiet_hours_start'),
		quietHoursEnd: text('quiet_hours_end'),
		createdAt: integer('created_at').notNull(),
		updatedAt: integer('updated_at').notNull(),
	},
	(table) => [index('idx_webhook_configs_tenant').on(table.tenantId)]
);

// ============================================================
// SSO Connections
// ============================================================
export const ssoConnections = sqliteTable(
	'sso_connections',
	{
		id: text('id').primaryKey(),
		orgId: text('org_id').notNull(),
		provider: text('provider').notNull(), // 'saml' | 'oidc'
		displayName: text('display_name').notNull(),
		domain: text('domain').notNull(),
		issuerUrl: text('issuer_url'),
		clientId: text('client_id'),
		metadataUrl: text('metadata_url'),
		certificate: text('certificate'),
		status: text('status').notNull().default('inactive'), // 'active' | 'inactive'
		jitEnabled: integer('jit_enabled').default(1),
		createdAt: integer('created_at').notNull(),
		updatedAt: integer('updated_at').notNull(),
	},
	(table) => [
		index('idx_sso_org').on(table.orgId),
		uniqueIndex('idx_sso_domain').on(table.orgId, table.domain),
	]
);

// ============================================================
// Webhook Deliveries
// ============================================================
export const webhookDeliveries = sqliteTable(
	'webhook_deliveries',
	{
		id: text('id').primaryKey(),
		configId: text('config_id').notNull(),
		eventType: text('event_type').notNull(),
		payload: text('payload').notNull(), // JSON string
		status: text('status').notNull(), // 'pending' | 'delivered' | 'failed'
		attempts: integer('attempts').default(0),
		lastAttemptAt: integer('last_attempt_at'),
		nextRetryAt: integer('next_retry_at'),
		responseCode: integer('response_code'),
		responseBody: text('response_body'),
		createdAt: integer('created_at').notNull(),
	},
	(table) => [
		index('idx_webhook_deliveries_config').on(table.configId),
		index('idx_webhook_deliveries_status').on(table.status),
	]
);

// ============================================================
// Copilot Readiness Assessments
// ============================================================
export const copilotAssessments = sqliteTable(
	'copilot_assessments',
	{
		id: text('id').primaryKey(),
		orgId: text('org_id').notNull(),
		tenantId: text('tenant_id').notNull(),
		overallScore: integer('overall_score').notNull(),
		categoryScores: text('category_scores').notNull(), // JSON
		recommendations: text('recommendations').notNull(), // JSON
		status: text('status').notNull().default('pending'),
		startedAt: text('started_at').notNull(),
		completedAt: text('completed_at'),
		createdAt: text('created_at').notNull(),
	},
	(table) => [
		index('idx_copilot_assessments_tenant').on(table.tenantId),
		index('idx_copilot_assessments_org').on(table.orgId),
	]
);

// ============================================================
// Storage Analytics
// ============================================================
export const storageAnalytics = sqliteTable(
	'storage_analytics',
	{
		id: text('id').primaryKey(),
		orgId: text('org_id').notNull(),
		tenantId: text('tenant_id').notNull(),
		scanType: text('scan_type').notNull(),
		data: text('data'),
		totalUsedGb: real('total_used_gb').default(0),
		totalAllocatedGb: real('total_allocated_gb').default(0),
		topConsumers: text('top_consumers'),
		recommendations: text('recommendations'),
		scannedAt: integer('scanned_at').notNull(),
		createdAt: integer('created_at').notNull(),
	},
	(table) => [
		index('idx_storage_analytics_tenant').on(table.tenantId),
		index('idx_storage_analytics_org').on(table.orgId),
		index('idx_storage_analytics_type').on(table.scanType),
	]
);

// ============================================================
// Config Snapshots
// ============================================================
export const configSnapshots = sqliteTable(
	'config_snapshots',
	{
		id: text('id').primaryKey(),
		tenantId: text('tenant_id').notNull(),
		label: text('label').notNull().default(''),
		snapshotType: text('snapshot_type').notNull().default('manual'),
		categoryCount: integer('category_count').notNull().default(0),
		objectCount: integer('object_count').notNull().default(0),
		errorCount: integer('error_count').notNull().default(0),
		isBaseline: integer('is_baseline').default(0),
		baselineLabel: text('baseline_label'),
		createdBy: text('created_by').notNull().default(''),
		createdAt: text('created_at').notNull(),
	},
	(table) => [
		index('idx_config_snapshots_tenant').on(table.tenantId),
	]
);

// ============================================================
// Config Drifts
// ============================================================
export const configDrifts = sqliteTable(
	'config_drifts',
	{
		id: text('id').primaryKey(),
		tenantId: text('tenant_id').notNull(),
		snapshotId: text('snapshot_id').notNull(),
		baselineId: text('baseline_id').notNull(),
		category: text('category').notNull(),
		path: text('path').notNull(),
		oldValue: text('old_value'),
		newValue: text('new_value'),
		severity: text('severity').notNull().default('info'),
		acknowledged: integer('acknowledged').default(0),
		detectedAt: text('detected_at').notNull(),
	},
	(table) => [
		index('idx_config_drifts_tenant').on(table.tenantId),
		index('idx_config_drifts_snapshot').on(table.snapshotId),
	]
);

// ============================================================
// Sync Jobs
// ============================================================
export const syncJobs = sqliteTable(
	'sync_jobs',
	{
		id: text('id').primaryKey(),
		orgId: text('org_id').notNull(),
		tenantId: text('tenant_id').notNull(),
		type: text('type').notNull(),
		status: text('status').notNull().default('pending'),
		startedAt: integer('started_at'),
		completedAt: integer('completed_at'),
		errorMessage: text('error_message'),
		itemsProcessed: integer('items_processed').default(0),
		itemsFailed: integer('items_failed').default(0),
		createdAt: integer('created_at').notNull(),
	},
	(table) => [
		index('idx_sync_jobs_org').on(table.orgId),
		index('idx_sync_jobs_tenant').on(table.tenantId),
		index('idx_sync_jobs_status').on(table.status),
	]
);

// ============================================================
// Platform Metrics
// ============================================================
export const platformMetrics = sqliteTable(
	'platform_metrics',
	{
		id: text('id').primaryKey(),
		metricType: text('metric_type').notNull(),
		value: real('value').notNull(),
		metadata: text('metadata'),
		recordedAt: integer('recorded_at').notNull(),
	},
	(table) => [
		index('idx_platform_metrics_type').on(table.metricType),
		index('idx_platform_metrics_recorded').on(table.recordedAt),
	]
);

// ============================================================
// Drift Suppression Rules
// ============================================================
export const driftSuppressionRules = sqliteTable(
	'drift_suppression_rules',
	{
		id: text('id').primaryKey(),
		orgId: text('org_id').notNull(),
		tenantId: text('tenant_id').notNull(),
		category: text('category').notNull(),
		pathPattern: text('path_pattern').notNull(),
		reason: text('reason'),
		createdBy: text('created_by').notNull(),
		createdAt: integer('created_at').notNull(),
	},
	(table) => [
		index('idx_drift_suppression_tenant').on(table.tenantId),
		index('idx_drift_suppression_org').on(table.orgId),
	]
);

// ============================================================
// PSA/RMM Integrations
// ============================================================
export const integrations = sqliteTable(
	'integrations',
	{
		id: text('id').primaryKey(),
		orgId: text('org_id').notNull(),
		provider: text('provider').notNull(), // 'connectwise' | 'datto' | 'kaseya'
		configEncrypted: text('config_encrypted').notNull(),
		status: text('status').notNull().default('pending'), // pending | active | error | disconnected
		lastSyncAt: text('last_sync_at'),
		syncIntervalMinutes: integer('sync_interval_minutes').default(60),
		metadata: text('metadata'), // JSON: company_id, site_url, etc.
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull(),
	},
	(table) => [
		index('idx_integrations_org').on(table.orgId),
		index('idx_integrations_provider').on(table.provider),
	]
);

export const integrationMappings = sqliteTable(
	'integration_mappings',
	{
		id: text('id').primaryKey(),
		integrationId: text('integration_id').notNull(),
		entityType: text('entity_type').notNull(), // 'tenant' | 'alert' | 'user' | 'agreement'
		localId: text('local_id').notNull(),
		remoteId: text('remote_id').notNull(),
		remoteName: text('remote_name'),
		syncedAt: text('synced_at').notNull(),
	},
	(table) => [
		index('idx_int_mappings_integration').on(table.integrationId),
		uniqueIndex('idx_int_mappings_unique').on(table.integrationId, table.entityType, table.localId),
	]
);

// ============================================================
// Partners
// ============================================================
export const partners = sqliteTable(
	'partners',
	{
		id: text('id').primaryKey(),
		orgId: text('org_id').notNull(),
		name: text('name').notNull(),
		website: text('website'),
		contactEmail: text('contact_email').notNull(),
		apiKeyHash: text('api_key_hash'),
		status: text('status').notNull().default('active'),
		createdAt: integer('created_at').notNull(),
	},
	(table) => [
		index('idx_partners_org').on(table.orgId),
	]
);

// ============================================================
// Partner Integrations
// ============================================================
export const partnerIntegrations = sqliteTable(
	'partner_integrations',
	{
		id: text('id').primaryKey(),
		partnerId: text('partner_id').notNull(),
		name: text('name').notNull(),
		description: text('description'),
		category: text('category').notNull(),
		installCount: integer('install_count').default(0),
		createdAt: integer('created_at').notNull(),
	},
	(table) => [
		index('idx_partner_integrations_partner').on(table.partnerId),
		index('idx_partner_integrations_category').on(table.category),
	]
);

// ============================================================
// Audit Logs
// ============================================================
export const auditLogs = sqliteTable(
	'audit_logs',
	{
		id: text('id').primaryKey(),
		orgId: text('org_id'),
		userId: text('user_id').notNull(),
		action: text('action').notNull(),
		resourceType: text('resource_type'),
		resourceId: text('resource_id'),
		details: text('details'),
		ipAddress: text('ip_address'),
		createdAt: integer('created_at').notNull(),
	},
	(table) => [
		index('idx_audit_logs_org').on(table.orgId),
		index('idx_audit_logs_user').on(table.userId),
		index('idx_audit_logs_action').on(table.action),
		index('idx_audit_logs_created').on(table.createdAt),
	]
);

// ============================================================
// Backup Jobs
// ============================================================
export const backupJobs = sqliteTable(
	'backup_jobs',
	{
		id: text('id').primaryKey(),
		orgId: text('org_id').notNull(),
		tenantId: text('tenant_id').notNull(),
		type: text('type').notNull(), // 'exchange' | 'sharepoint' | 'teams'
		status: text('status').notNull().default('pending'), // 'pending' | 'running' | 'completed' | 'failed'
		itemsCount: integer('items_count').default(0),
		sizeBytes: integer('size_bytes').default(0),
		startedAt: integer('started_at'),
		completedAt: integer('completed_at'),
		error: text('error'),
		createdAt: integer('created_at').notNull(),
	},
	(table) => [
		index('idx_backup_jobs_org').on(table.orgId),
		index('idx_backup_jobs_tenant').on(table.tenantId),
		index('idx_backup_jobs_status').on(table.status),
	]
);

// ============================================================
// AI SEO Audits
// ============================================================
export const seoAudits = sqliteTable(
	'seo_audits',
	{
		id: text('id').primaryKey(),
		orgId: text('org_id').notNull(),
		domain: text('domain').notNull(),
		overallScore: integer('overall_score'),
		aiVisibilityScore: integer('ai_visibility_score'),
		contentScore: integer('content_score'),
		structuredDataScore: integer('structured_data_score'),
		citationScore: integer('citation_score'),
		findings: text('findings'), // JSON array
		competitors: text('competitors'), // JSON array of competitor domains
		status: text('status').notNull().default('pending'), // 'pending' | 'running' | 'completed' | 'failed'
		error: text('error'),
		startedAt: integer('started_at'),
		completedAt: integer('completed_at'),
		createdAt: integer('created_at').notNull(),
	},
	(table) => [
		index('idx_seo_audits_org').on(table.orgId),
		index('idx_seo_audits_domain').on(table.domain),
		index('idx_seo_audits_status').on(table.status),
	]
);

// ============================================================
// AI SEO Published Content
// ============================================================
export const seoContent = sqliteTable(
	'seo_content',
	{
		id: text('id').primaryKey(),
		orgId: text('org_id').notNull(),
		auditId: text('audit_id'),
		domain: text('domain').notNull(),
		contentType: text('content_type').notNull(), // 'fact_sheet' | 'faq_schema' | 'blog_post' | 'knowledge_base' | 'json_ld'
		title: text('title').notNull(),
		content: text('content').notNull(), // Generated content (HTML/JSON/Markdown)
		metadata: text('metadata'), // JSON: keywords, entities, target prompts
		status: text('status').notNull().default('draft'), // 'draft' | 'published' | 'archived'
		publishedAt: integer('published_at'),
		publishedTo: text('published_to'), // JSON array of channels
		createdAt: integer('created_at').notNull(),
		updatedAt: integer('updated_at').notNull(),
	},
	(table) => [
		index('idx_seo_content_org').on(table.orgId),
		index('idx_seo_content_domain').on(table.domain),
		index('idx_seo_content_type').on(table.contentType),
		index('idx_seo_content_status').on(table.status),
	]
);

// ============================================================
// AI SEO Citation Tracking
// ============================================================
export const seoCitations = sqliteTable(
	'seo_citations',
	{
		id: text('id').primaryKey(),
		orgId: text('org_id').notNull(),
		domain: text('domain').notNull(),
		aiAgent: text('ai_agent').notNull(), // 'chatgpt' | 'claude' | 'perplexity' | 'gemini'
		prompt: text('prompt').notNull(),
		mentioned: integer('mentioned').notNull().default(0), // boolean
		context: text('context'), // Snippet of AI response
		sentiment: text('sentiment'), // 'positive' | 'neutral' | 'negative'
		competitorMentions: text('competitor_mentions'), // JSON array
		checkedAt: integer('checked_at').notNull(),
	},
	(table) => [
		index('idx_seo_citations_org').on(table.orgId),
		index('idx_seo_citations_domain').on(table.domain),
		index('idx_seo_citations_agent').on(table.aiAgent),
	]
);

// ============================================================
// Org Branding (White-Label)
// ============================================================
// org_branding gains custom-domain verification fields in 0019. Drizzle schema
// reflects the migrated state; legacy snapshots ignore the new fields.
export const orgBranding = sqliteTable(
	'org_branding',
	{
		id: text('id').primaryKey(),
		orgId: text('org_id').notNull(),
		logoUrl: text('logo_url'),
		faviconUrl: text('favicon_url'),
		primaryColor: text('primary_color').notNull().default('#2563eb'),
		secondaryColor: text('secondary_color').notNull().default('#7c3aed'),
		companyName: text('company_name').notNull().default(''),
		customDomain: text('custom_domain'),
		emailFromName: text('email_from_name'),
		createdAt: integer('created_at').notNull(),
		updatedAt: integer('updated_at').notNull(),
	},
	(table) => [
		index('idx_org_branding_org').on(table.orgId),
	]
);

// ============================================================
// GDAP Relationships
// ============================================================
export const gdapRelationships = sqliteTable(
	'gdap_relationships',
	{
		id: text('id').primaryKey(),
		orgId: text('org_id').notNull(),
		customerId: text('customer_id').notNull(),
		customerName: text('customer_name').notNull(),
		displayName: text('display_name').notNull(),
		status: text('status').notNull().default('pending'),
		roles: text('roles').notNull().default('[]'),
		duration: text('duration').notNull().default('P90D'),
		partnerTenantId: text('partner_tenant_id'),
		createdAt: integer('created_at').notNull(),
		expiresAt: integer('expires_at'),
		terminatedAt: integer('terminated_at'),
	},
	(table) => [
		index('idx_gdap_org').on(table.orgId),
		index('idx_gdap_status').on(table.orgId, table.status),
	]
);

// ============================================================
// GDAP Access Assignments
// ============================================================
export const gdapAccessAssignments = sqliteTable(
	'gdap_access_assignments',
	{
		id: text('id').primaryKey(),
		relationshipId: text('relationship_id').notNull(),
		orgId: text('org_id').notNull(),
		securityGroupId: text('security_group_id'),
		roles: text('roles').notNull().default('[]'),
		status: text('status').notNull().default('active'),
		createdAt: integer('created_at').notNull(),
	},
	(table) => [
		index('idx_gdap_access_rel').on(table.relationshipId),
	]
);

// ============================================================
// Partner Center Config
// ============================================================
export const partnerConfig = sqliteTable(
	'partner_config',
	{
		id: text('id').primaryKey(),
		orgId: text('org_id').notNull().unique(),
		partnerId: text('partner_id').notNull(),
		partnerTenantId: text('partner_tenant_id').notNull(),
		partnerName: text('partner_name'),
		status: text('status').notNull().default('configured'),
		createdAt: integer('created_at').notNull(),
		updatedAt: integer('updated_at').notNull(),
	}
);

// ============================================================
// Prospect Scans
// ============================================================
export const prospectScans = sqliteTable(
	'prospect_scans',
	{
		id: text('id').primaryKey(),
		domain: text('domain').notNull(),
		score: integer('score').notNull(),
		grade: text('grade').notNull(),
		emailSecurity: text('email_security').notNull().default('{}'),
		identitySecurity: text('identity_security').notNull().default('{}'),
		m365Signals: text('m365_signals').notNull().default('{}'),
		findings: text('findings').notNull().default('[]'),
		recommendations: text('recommendations').notNull().default('[]'),
		scanDuration: integer('scan_duration'),
		ipAddress: text('ip_address'),
		createdAt: integer('created_at').notNull(),
	},
	(table) => [
		index('idx_prospect_domain').on(table.domain),
	]
);

// ============================================================
// Restored — queries import these tables.
// ============================================================

export const remediationLog = sqliteTable('remediation_log', {
	id: text('id').primaryKey(),
	tenantId: text('tenant_id').notNull(),
	actor: text('actor').notNull(),
	actionType: text('action_type').notNull(),
	targetResource: text('target_resource'),
	beforeState: text('before_state'),
	afterState: text('after_state'),
	status: text('status').notNull().default('pending'),
	errorMessage: text('error_message'),
	executedAt: integer('executed_at').notNull(),
	completedAt: integer('completed_at'),
}, (table) => [
	index('idx_remediation_tenant').on(table.tenantId),
	index('idx_remediation_status').on(table.status),
	index('idx_remediation_executed').on(table.executedAt),
]);

export const tenantAuditLog = sqliteTable('tenant_audit_log', {
	id: text('id').primaryKey(),
	tenantId: text('tenant_id').notNull(),
	actor: text('actor').notNull(),
	action: text('action').notNull(),
	resourceType: text('resource_type'),
	resourceId: text('resource_id'),
	details: text('details'),
	ipAddress: text('ip_address'),
	createdAt: integer('created_at').notNull(),
}, (table) => [
	index('idx_tenant_audit_tenant').on(table.tenantId),
	index('idx_tenant_audit_action').on(table.action),
	index('idx_tenant_audit_created').on(table.createdAt),
]);

export const workflows = sqliteTable('workflows', {
	id: text('id').primaryKey(),
	tenantId: text('tenant_id').notNull(),
	name: text('name').notNull(),
	type: text('type').notNull(),
	schedule: text('schedule'),
	enabled: integer('enabled').default(1),
	parameters: text('parameters'),
	conditions: text('conditions'),
	createdAt: integer('created_at').notNull(),
	createdBy: text('created_by'),
	updatedAt: integer('updated_at'),
	lastExecutedAt: integer('last_executed_at'),
	nextExecutionAt: integer('next_execution_at'),
}, (table) => [index('idx_workflows_tenant').on(table.tenantId)]);

export const workflowRuns = sqliteTable('workflow_runs', {
	id: text('id').primaryKey(),
	workflowId: text('workflow_id').notNull(),
	tenantId: text('tenant_id').notNull(),
	status: text('status').notNull().default('queued'),
	startedAt: integer('started_at'),
	completedAt: integer('completed_at'),
	result: text('result'),
	error: text('error'),
}, (table) => [index('idx_workflow_runs_workflow').on(table.workflowId)]);

export const alerts = sqliteTable('alerts', {
	id: text('id').primaryKey(),
	tenantId: text('tenant_id').notNull(),
	type: text('type').notNull(),
	severity: text('severity').notNull(),
	title: text('title').notNull(),
	description: text('description'),
	source: text('source'),
	status: text('status').notNull().default('active'),
	createdAt: text('created_at'),
	updatedAt: text('updated_at'),
	resolvedAt: text('resolved_at'),
	resolvedBy: text('resolved_by'),
	resolutionNotes: text('resolution_notes'),
	estimatedCostImpact: real('estimated_cost_impact'),
	estimatedRiskScore: integer('estimated_risk_score'),
	affectedUsers: text('affected_users'),
	resourceId: text('resource_id'),
	resourceType: text('resource_type'),
	metadata: text('metadata'),
	recommendations: text('recommendations'),
	canAutoRemediate: integer('can_auto_remediate').default(0),
	autoRemediationAction: text('auto_remediation_action'),
}, (table) => [
	index('idx_alerts_tenant').on(table.tenantId),
	index('idx_alerts_tenant_status').on(table.tenantId, table.status),
	index('idx_alerts_severity').on(table.severity),
]);

export const aiConversations = sqliteTable('ai_conversations', {
	id: text('id').primaryKey(),
	tenantId: text('tenant_id').notNull(),
	userId: text('user_id'),
	title: text('title'),
	messages: text('messages').notNull().default('[]'),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull(),
}, (table) => [index('idx_ai_conversations_tenant').on(table.tenantId)]);

export const agentActions = sqliteTable('agent_actions', {
	id: text('id').primaryKey(),
	orgId: text('org_id'),
	tenantId: text('tenant_id'),
	agent: text('agent').notNull(),
	action: text('action').notNull(),
	findingId: text('finding_id'),
	severity: text('severity'),
	status: text('status').notNull().default('success'),
	metadata: text('metadata'),
	createdAt: integer('created_at').notNull(),
}, (table) => [
	index('idx_agent_actions_org').on(table.orgId, table.createdAt),
	index('idx_agent_actions_tenant').on(table.tenantId, table.createdAt),
	index('idx_agent_actions_agent').on(table.agent, table.createdAt),
	index('idx_agent_actions_created_at').on(table.createdAt),
]);

export const mcpApiKeys = sqliteTable('mcp_api_keys', {
	id: text('id').primaryKey(),
	orgId: text('org_id').notNull(),
	userId: text('user_id').notNull(),
	label: text('label').notNull(),
	keyHash: text('key_hash').notNull(),
	prefix: text('prefix').notNull(),
	lastUsedAt: integer('last_used_at'),
	revokedAt: integer('revoked_at'),
	createdAt: integer('created_at').notNull(),
}, (table) => [
	uniqueIndex('idx_mcp_keys_hash').on(table.keyHash),
	index('idx_mcp_keys_org').on(table.orgId),
	index('idx_mcp_keys_user').on(table.userId),
]);
