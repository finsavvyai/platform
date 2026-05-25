import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

/**
 * Multi-Tenant SaaS Platform Schema
 *
 * This schema supports a multi-tenant SaaS model where:
 * - Platform Owner (you) manages multiple customer organizations
 * - Each customer organization is a separate tenant
 * - Each tenant has its own admin(s) and users
 * - Billing, subscriptions, and limits are tracked per tenant
 */

/**
 * Organizations (Customer Companies)
 *
 * Each organization represents a customer company that subscribes to your platform.
 * You (the platform owner) can manage multiple organizations.
 */
export const organizations = sqliteTable('organizations', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	slug: text('slug').notNull().unique(), // URL-friendly identifier (e.g., 'acme-corp')
	domain: text('domain'), // Optional custom domain (e.g., 'acme.tenantiq.com')

	// Contact information
	primaryContactEmail: text('primary_contact_email').notNull(),
	primaryContactName: text('primary_contact_name'),
	phone: text('phone'),

	// Address
	addressLine1: text('address_line_1'),
	addressLine2: text('address_line_2'),
	city: text('city'),
	state: text('state'),
	zipCode: text('zip_code'),
	country: text('country'),

	// Subscription & Billing
	subscriptionTier: text('subscription_tier').notNull().default('core'), // 'core', 'professional', 'security_suite', 'enterprise'
	subscriptionStatus: text('subscription_status').notNull().default('trial'), // 'trial', 'active', 'past_due', 'cancelled', 'suspended'
	billingEmail: text('billing_email'),

	// Microsoft 365 Integration
	azureTenantId: text('azure_tenant_id'), // Customer's M365 tenant ID
	azureClientId: text('azure_client_id'), // Customer's app registration client ID
	azureClientSecretEncrypted: text('azure_client_secret_encrypted'), // Encrypted client secret
	graphApiEnabled: integer('graph_api_enabled').default(0), // boolean
	lastSyncedAt: text('last_synced_at'),

	// Metadata
	logoUrl: text('logo_url'),
	websiteUrl: text('website_url'),
	industry: text('industry'),
	companySize: text('company_size'), // '1-10', '11-50', '51-200', '201-1000', '1000+'

	// Limits (based on subscription tier)
	maxUsers: integer('max_users').default(25), // Max Microsoft 365 users to monitor
	maxScansPerMonth: integer('max_scans_per_month').default(100),
	maxAlerts: integer('max_alerts').default(1000),
	maxStorageGB: integer('max_storage_gb').default(10),

	// Status & Tracking
	status: text('status').notNull().default('active'), // 'active', 'suspended', 'deleted'
	createdAt: text('created_at').notNull(),
	createdBy: text('created_by').notNull(), // Platform admin who created the org
	updatedAt: text('updated_at').notNull(),
	deletedAt: text('deleted_at'),

	// Trial information
	trialStartedAt: text('trial_started_at'),
	trialEndsAt: text('trial_ends_at'),

	// Settings (JSON)
	settings: text('settings'), // Custom org-level settings
	metadata: text('metadata'), // Additional metadata
}, (table) => ({
	slugIdx: index('idx_organizations_slug').on(table.slug),
	statusIdx: index('idx_organizations_status').on(table.status),
	subscriptionStatusIdx: index('idx_organizations_subscription_status').on(table.subscriptionStatus),
}));

/**
 * Platform Users
 *
 * Users of the platform can be:
 * - Platform Admins (you and your team) - manage all organizations
 * - Tenant Admins - manage their own organization
 * - Tenant Operators - limited access within their organization
 * - Tenant Viewers - read-only access within their organization
 */
export const platformUsers = sqliteTable('platform_users', {
	id: text('id').primaryKey(),
	organizationId: text('organization_id'), // NULL for platform admins

	// Identity
	email: text('email').notNull().unique(),
	name: text('name').notNull(),
	avatarUrl: text('avatar_url'),

	// Authentication
	passwordHash: text('password_hash'), // Hashed password (bcrypt)
	emailVerified: integer('email_verified').default(0), // boolean
	emailVerifiedAt: text('email_verified_at'),

	// OAuth/SSO
	authProvider: text('auth_provider').default('email'), // 'email', 'google', 'microsoft', 'azure_ad'
	authProviderId: text('auth_provider_id'), // External ID from OAuth provider

	// Role within the platform
	role: text('role').notNull(), // 'platform_admin', 'tenant_admin', 'tenant_operator', 'tenant_viewer'

	// Status
	status: text('status').notNull().default('active'), // 'active', 'invited', 'suspended', 'deleted'
	lastLoginAt: text('last_login_at'),
	lastActiveAt: text('last_active_at'),

	// Preferences
	timezone: text('timezone').default('UTC'),
	locale: text('locale').default('en'),

	// Security
	twoFactorEnabled: integer('two_factor_enabled').default(0), // boolean
	twoFactorSecret: text('two_factor_secret'),

	// Metadata
	createdAt: text('created_at').notNull(),
	createdBy: text('created_by'),
	updatedAt: text('updated_at').notNull(),
	deletedAt: text('deleted_at'),
	invitedAt: text('invited_at'),
	invitedBy: text('invited_by'),
}, (table) => ({
	emailIdx: index('idx_platform_users_email').on(table.email),
	orgIdx: index('idx_platform_users_organization').on(table.organizationId),
	roleIdx: index('idx_platform_users_role').on(table.role),
	statusIdx: index('idx_platform_users_status').on(table.status),
}));

/**
 * Subscriptions
 *
 * Tracks subscription history and changes for each organization
 */
export const subscriptions = sqliteTable('subscriptions', {
	id: text('id').primaryKey(),
	organizationId: text('organization_id').notNull(),

	// Subscription details
	tier: text('tier').notNull(), // 'core', 'professional', 'security_suite', 'enterprise'
	status: text('status').notNull(), // 'trial', 'active', 'past_due', 'cancelled', 'expired'

	// Pricing
	monthlyPrice: integer('monthly_price').notNull(), // Price in cents (e.g., 9900 = $99.00)
	currency: text('currency').notNull().default('USD'),
	billingInterval: text('billing_interval').notNull().default('monthly'), // 'monthly', 'annual'

	// Billing dates
	currentPeriodStart: text('current_period_start').notNull(),
	currentPeriodEnd: text('current_period_end').notNull(),
	cancelAtPeriodEnd: integer('cancel_at_period_end').default(0), // boolean
	cancelledAt: text('cancelled_at'),

	// Payment
	paymentMethod: text('payment_method'), // 'card', 'invoice', 'stripe', 'paypal'
	lastPaymentStatus: text('last_payment_status'), // 'succeeded', 'failed', 'pending'
	lastPaymentDate: text('last_payment_date'),

	// External billing system
	stripeSubscriptionId: text('stripe_subscription_id'),
	stripeCustomerId: text('stripe_customer_id'),

	// Limits for this subscription
	maxUsers: integer('max_users').notNull(),
	maxScansPerMonth: integer('max_scans_per_month').notNull(),
	maxAlerts: integer('max_alerts').notNull(),
	maxStorageGB: integer('max_storage_gb').notNull(),

	// Features
	features: text('features'), // JSON array of enabled features

	// Metadata
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull(),
	metadata: text('metadata'),
}, (table) => ({
	orgIdx: index('idx_subscriptions_organization').on(table.organizationId),
	statusIdx: index('idx_subscriptions_status').on(table.status),
	periodEndIdx: index('idx_subscriptions_period_end').on(table.currentPeriodEnd),
}));

/**
 * Usage Tracking
 *
 * Tracks usage metrics per organization for billing and limit enforcement
 */
export const usageMetrics = sqliteTable('usage_metrics', {
	id: text('id').primaryKey(),
	organizationId: text('organization_id').notNull(),

	// Time period
	periodStart: text('period_start').notNull(),
	periodEnd: text('period_end').notNull(),

	// Usage counts
	scansExecuted: integer('scans_executed').default(0),
	alertsGenerated: integer('alerts_generated').default(0),
	remediationsExecuted: integer('remediations_executed').default(0),
	apiCallsCount: integer('api_calls_count').default(0),
	storageUsedMB: integer('storage_used_mb').default(0),

	// Microsoft 365 metrics
	m365UsersMonitored: integer('m365_users_monitored').default(0),
	m365LicensesTracked: integer('m365_licenses_tracked').default(0),

	// Metadata
	createdAt: text('created_at').notNull(),
	metadata: text('metadata'),
}, (table) => ({
	orgPeriodIdx: index('idx_usage_metrics_org_period').on(table.organizationId, table.periodStart),
}));

/**
 * Invoices
 *
 * Invoice records for each organization
 */
export const invoices = sqliteTable('invoices', {
	id: text('id').primaryKey(),
	organizationId: text('organization_id').notNull(),
	subscriptionId: text('subscription_id').notNull(),

	// Invoice details
	invoiceNumber: text('invoice_number').notNull().unique(),
	status: text('status').notNull(), // 'draft', 'open', 'paid', 'void', 'uncollectible'

	// Amounts (in cents)
	subtotal: integer('subtotal').notNull(),
	tax: integer('tax').default(0),
	total: integer('total').notNull(),
	amountPaid: integer('amount_paid').default(0),
	amountDue: integer('amount_due').notNull(),
	currency: text('currency').notNull().default('USD'),

	// Dates
	issueDate: text('issue_date').notNull(),
	dueDate: text('due_date').notNull(),
	paidAt: text('paid_at'),

	// Line items (JSON)
	lineItems: text('line_items').notNull(), // JSON array of invoice items

	// Payment
	paymentMethod: text('payment_method'),

	// External billing
	stripeInvoiceId: text('stripe_invoice_id'),

	// PDF/Download
	pdfUrl: text('pdf_url'),

	// Metadata
	createdAt: text('created_at').notNull(),
	metadata: text('metadata'),
}, (table) => ({
	orgIdx: index('idx_invoices_organization').on(table.organizationId),
	statusIdx: index('idx_invoices_status').on(table.status),
	dueDateIdx: index('idx_invoices_due_date').on(table.dueDate),
}));

/**
 * Tenant Invitation Tokens
 *
 * Secure tokens for inviting new tenant admins
 */
export const invitations = sqliteTable('invitations', {
	id: text('id').primaryKey(),
	organizationId: text('organization_id').notNull(),

	// Invitation details
	email: text('email').notNull(),
	role: text('role').notNull(), // Role to assign when accepted
	token: text('token').notNull().unique(), // Secure random token

	// Status
	status: text('status').notNull().default('pending'), // 'pending', 'accepted', 'expired', 'revoked'

	// Metadata
	invitedBy: text('invited_by').notNull(),
	invitedAt: text('invited_at').notNull(),
	expiresAt: text('expires_at').notNull(),
	acceptedAt: text('accepted_at'),
	acceptedBy: text('accepted_by'),
	revokedAt: text('revoked_at'),
	revokedBy: text('revoked_by'),
}, (table) => ({
	tokenIdx: index('idx_invitations_token').on(table.token),
	orgEmailIdx: index('idx_invitations_org_email').on(table.organizationId, table.email),
	statusIdx: index('idx_invitations_status').on(table.status),
}));

/**
 * API Keys (for programmatic access)
 *
 * Organizations can generate API keys for integrations
 */
export const apiKeys = sqliteTable('api_keys', {
	id: text('id').primaryKey(),
	organizationId: text('organization_id').notNull(),

	// Key details
	name: text('name').notNull(), // User-friendly name
	keyHash: text('key_hash').notNull(), // Hashed API key
	keyPrefix: text('key_prefix').notNull(), // First 8 chars for identification

	// Permissions
	scopes: text('scopes').notNull(), // JSON array of allowed scopes

	// Usage
	lastUsedAt: text('last_used_at'),
	usageCount: integer('usage_count').default(0),

	// Status
	status: text('status').notNull().default('active'), // 'active', 'revoked'

	// Expiration
	expiresAt: text('expires_at'),

	// Metadata
	createdAt: text('created_at').notNull(),
	createdBy: text('created_by').notNull(),
	revokedAt: text('revoked_at'),
	revokedBy: text('revoked_by'),
}, (table) => ({
	orgIdx: index('idx_api_keys_organization').on(table.organizationId),
	prefixIdx: index('idx_api_keys_prefix').on(table.keyPrefix),
}));

/**
 * Backup Jobs
 *
 * Tracks Exchange, SharePoint, and Teams data backup operations.
 */
export const backupJobs = sqliteTable('backup_jobs', {
	id: text('id').primaryKey(),
	orgId: text('org_id').notNull(),
	tenantId: text('tenant_id').notNull(),
	type: text('type').notNull(), // 'exchange' | 'sharepoint' | 'teams'
	status: text('status').notNull().default('pending'),
	itemsCount: integer('items_count').default(0),
	sizeBytes: integer('size_bytes').default(0),
	startedAt: integer('started_at'),
	completedAt: integer('completed_at'),
	error: text('error'),
	createdAt: integer('created_at').notNull(),
}, (table) => ({
	orgIdx: index('idx_backup_jobs_org').on(table.orgId),
	tenantIdx: index('idx_backup_jobs_tenant').on(table.tenantId),
	statusIdx: index('idx_backup_jobs_status').on(table.status),
}));
