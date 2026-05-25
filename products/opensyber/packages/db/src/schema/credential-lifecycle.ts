/**
 * Credential Lifecycle Schema
 *
 * Tables for secret rotation policies and just-in-time (JIT) access requests.
 */
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations.js';

export const vaultRotationPolicies = sqliteTable('vault_rotation_policies', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  secretPattern: text('secret_pattern').notNull(),
  rotationIntervalDays: integer('rotation_interval_days').notNull(),
  lastRotatedAt: text('last_rotated_at'),
  nextRotationAt: text('next_rotation_at'),
  status: text('status').notNull().default('active'),
  notifyChannelId: text('notify_channel_id'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const jitAccessRequests = sqliteTable('jit_access_requests', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  requesterId: text('requester_id').notNull(),
  secretId: text('secret_id').notNull(),
  reason: text('reason').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  status: text('status').notNull().default('pending'),
  approvedBy: text('approved_by'),
  expiresAt: text('expires_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const agentSecretAccess = sqliteTable('agent_secret_access', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  agentId: text('agent_id').notNull(),
  secretName: text('secret_name').notNull(),
  accessType: text('access_type').notNull(),
  accessedAt: text('accessed_at').notNull().default(sql`(datetime('now'))`),
});
