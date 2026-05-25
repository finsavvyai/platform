/**
 * @finsavvyai/db — Shared Drizzle schema templates
 * Common tables used across all FinsavvyAI products
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/** Base user table — every product needs users */
export const baseUsers = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  passwordHash: text('password_hash'),
  role: text('role').default('user'),
  avatarUrl: text('avatar_url'),
  status: text('status').default('active'),
  emailVerified: integer('email_verified', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

/** Subscription tracking */
export const baseSubscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => baseUsers.id),
  planId: text('plan_id').notNull(),
  status: text('status').default('active'),
  provider: text('provider').default('stripe'),
  externalId: text('external_id'),
  currentPeriodEnd: text('current_period_end'),
  cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

/** API keys for service access */
export const baseApiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => baseUsers.id),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull(),
  prefix: text('prefix').notNull(),
  scopes: text('scopes'),
  lastUsedAt: text('last_used_at'),
  expiresAt: text('expires_at'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

/** Audit log for security events */
export const baseAuditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  action: text('action').notNull(),
  resource: text('resource'),
  resourceId: text('resource_id'),
  details: text('details'),
  ip: text('ip'),
  userAgent: text('user_agent'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});
