import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── TokenForge: Tenants (Multi-Tenant SaaS) ────────────────────────────────

export const tfTenants = sqliteTable('tf_tenants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  ownerUserId: text('owner_user_id').notNull(),
  plan: text('plan', { enum: ['free', 'pro', 'team', 'enterprise'] })
    .notNull()
    .default('free'),
  lemonSqueezyCustomerId: text('lemonsqueezy_customer_id'),
  lemonSqueezySubscriptionId: text('lemonsqueezy_subscription_id'),
  /**
   * Sprint 39: JSON-encoded per-action step-up policy. Shape +
   * matching contract live in `@opensyber/tokenforge/server` —
   * `parseStepUpActions` / `evaluateStepUpPolicy`. Null = no policy.
   */
  stepUpActions: text('step_up_actions'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── TokenForge: Webhook Subscriptions ──────────────────────────────────────

export const tfWebhookConfig = sqliteTable('tf_webhook_config', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tfTenants.id),
  name: text('name').notNull().default(''),
  endpointUrl: text('endpoint_url').notNull(),
  // Comma-separated list of subscribed event types. Kept as string for portability
  // across D1/SQLite without needing JSON-encoded arrays.
  events: text('events').notNull().default(''),
  secret: text('secret'),
  // Rotation grace: previous secret remains valid until the given timestamp so
  // integrators can redeploy without missing a beat.
  secretPrevious: text('secret_previous'),
  secretPreviousValidUntil: text('secret_previous_valid_until'),
  enabled: integer('enabled').notNull().default(1),
  lastDeliveryAt: text('last_delivery_at'),
  lastDeliveryStatus: integer('last_delivery_status'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── TokenForge: Webhook Delivery Log ───────────────────────────────────────

export const tfWebhookDeliveries = sqliteTable('tf_webhook_deliveries', {
  id: text('id').primaryKey(),
  webhookId: text('webhook_id')
    .notNull()
    .references(() => tfWebhookConfig.id, { onDelete: 'cascade' }),
  tenantId: text('tenant_id').notNull(),
  event: text('event').notNull(),
  payload: text('payload').notNull(),
  attempt: integer('attempt').notNull().default(1),
  status: integer('status'),
  error: text('error'),
  scheduledAt: text('scheduled_at').notNull().default(sql`(datetime('now'))`),
  deliveredAt: text('delivered_at'),
  nextRetryAt: text('next_retry_at'),
});

// ─── TokenForge: API Keys ───────────────────────────────────────────────────

export const tfApiKeys = sqliteTable('tf_api_keys', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tfTenants.id),
  name: text('name').notNull(),
  keyPrefix: text('key_prefix').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  lastUsedAt: text('last_used_at'),
  expiresAt: text('expires_at'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── TokenForge: Device Sessions ──────────────────────────────────────────────

export const deviceSessions = sqliteTable('device_sessions', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id'),
  sessionId: text('session_id').notNull(),
  userId: text('user_id').notNull(),
  publicKey: text('public_key').notNull(),
  deviceFingerprint: text('device_fingerprint'),
  ipAddress: text('ip_address'),
  countryCode: text('country_code'),
  trustScore: integer('trust_score').notNull().default(100),
  boundAt: text('bound_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  lastVerifiedAt: text('last_verified_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  expiresAt: text('expires_at').notNull(),
  revoked: integer('revoked').notNull().default(0),
  revokedReason: text('revoked_reason'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── TokenForge: Security Events ──────────────────────────────────────────────

export const tfSecurityEvents = sqliteTable('tf_security_events', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id'),
  sessionId: text('session_id').notNull(),
  userId: text('user_id').notNull(),
  eventType: text('event_type').notNull(),
  trustScoreBefore: integer('trust_score_before'),
  trustScoreAfter: integer('trust_score_after'),
  ipAddress: text('ip_address'),
  countryCode: text('country_code'),
  userAgent: text('user_agent'),
  metadata: text('metadata'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── TokenForge: Step-Up Challenges ──────────────────────────────────────────

export const stepUpChallenges = sqliteTable('step_up_challenges', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id'),
  sessionId: text('session_id').notNull(),
  userId: text('user_id').notNull(),
  reason: text('reason').notNull(),
  status: text('status', {
    enum: ['pending', 'completed', 'expired', 'failed'],
  })
    .notNull()
    .default('pending'),
  method: text('method', {
    enum: ['totp', 'email_otp', 'passkey'],
  }),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  expiresAt: text('expires_at').notNull(),
  completedAt: text('completed_at'),
});

// ─── TokenForge: Usage Tracking ─────────────────────────────────────────────

export const tfUsage = sqliteTable('tf_usage', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tfTenants.id),
  date: text('date').notNull(),
  verificationCount: integer('verification_count').notNull().default(0),
  bindCount: integer('bind_count').notNull().default(0),
  stepUpCount: integer('step_up_count').notNull().default(0),
});
