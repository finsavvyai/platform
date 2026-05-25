import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── Agent Identities (Non-Human Identity Registry) ─────────────────────────────

export const agentIdentities = sqliteTable('agent_identities', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  displayName: text('display_name').notNull(),
  identityType: text('identity_type', {
    enum: ['service_account', 'api_key', 'bot', 'ci_runner', 'agent', 'webhook'],
  }).notNull(),
  provider: text('provider'),
  providerId: text('provider_id'),
  permissions: text('permissions'), // JSON
  riskScore: integer('risk_score').notNull().default(0),
  lastActiveAt: text('last_active_at'),
  status: text('status', {
    enum: ['active', 'inactive', 'revoked', 'suspicious'],
  }).notNull().default('active'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// ─── Agent Identity Events ──────────────────────────────────────────────────────

export const agentIdentityEvents = sqliteTable('agent_identity_events', {
  id: text('id').primaryKey(),
  identityId: text('identity_id')
    .notNull()
    .references(() => agentIdentities.id, { onDelete: 'cascade' }),
  eventType: text('event_type', {
    enum: ['auth', 'permission_change', 'key_rotation', 'anomaly', 'access', 'revocation'],
  }).notNull(),
  severity: text('severity', {
    enum: ['info', 'low', 'medium', 'high', 'critical'],
  }).notNull().default('info'),
  details: text('details'), // JSON
  sourceIp: text('source_ip'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});
