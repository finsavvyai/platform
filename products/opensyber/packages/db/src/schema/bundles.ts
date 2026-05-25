import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { skills } from './instances.js';
import { users } from './users.js';

// ─── Skill Bundles ──────────────────────────────────────────────────────────────

export const skillBundles = sqliteTable('skill_bundles', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  tagline: text('tagline'),
  description: text('description'),
  tier: text('tier', { enum: ['free', 'pro', 'team', 'enterprise'] }).notNull().default('free'),
  priceCents: integer('price_cents').notNull().default(0),
  skillCount: integer('skill_count').notNull().default(0),
  icon: text('icon'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// ─── Bundle ↔ Skills (Junction) ────────────────────────────────────────────────

export const bundleSkills = sqliteTable('bundle_skills', {
  id: text('id').primaryKey(),
  bundleId: text('bundle_id').notNull().references(() => skillBundles.id, { onDelete: 'cascade' }),
  skillId: text('skill_id').notNull().references(() => skills.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
  addedAt: text('added_at').notNull().default(sql`(datetime('now'))`),
});

// ─── Bundle Test Steps ──────────────────────────────────────────────────────────

export const bundleTestSteps = sqliteTable('bundle_test_steps', {
  id: text('id').primaryKey(),
  bundleId: text('bundle_id').notNull().references(() => skillBundles.id, { onDelete: 'cascade' }),
  stepOrder: integer('step_order').notNull().default(0),
  title: text('title').notNull(),
  description: text('description'),
  expectedResult: text('expected_result'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// ─── User Bundle Subscriptions ──────────────────────────────────────────────────

export const userBundleSubscriptions = sqliteTable('user_bundle_subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  bundleId: text('bundle_id').notNull().references(() => skillBundles.id),
  status: text('status', { enum: ['active', 'paused', 'cancelled', 'expired'] }).notNull().default('active'),
  startedAt: text('started_at').notNull().default(sql`(datetime('now'))`),
  expiresAt: text('expires_at'),
  cancelledAt: text('cancelled_at'),
});

// ─── Bundle Sources ─────────────────────────────────────────────────────────────

export const bundleSources = sqliteTable('bundle_sources', {
  id: text('id').primaryKey(),
  subscriptionId: text('subscription_id').notNull().references(() => userBundleSubscriptions.id, { onDelete: 'cascade' }),
  sourceType: text('source_type', { enum: ['github', 'gitlab', 'bitbucket', 'aws', 'gcp', 'azure', 'custom'] }).notNull(),
  sourceRef: text('source_ref').notNull(),
  config: text('config'),
  status: text('status', { enum: ['connected', 'disconnected', 'error'] }).notNull().default('connected'),
  lastScanAt: text('last_scan_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// ─── Bundle Alert Configs ───────────────────────────────────────────────────────

export const bundleAlertConfigs = sqliteTable('bundle_alert_configs', {
  id: text('id').primaryKey(),
  subscriptionId: text('subscription_id').notNull().references(() => userBundleSubscriptions.id, { onDelete: 'cascade' }),
  channel: text('channel', { enum: ['email', 'slack', 'discord', 'pagerduty', 'teams', 'opsgenie', 'webhook'] }).notNull(),
  target: text('target').notNull(),
  minSeverity: text('min_severity', { enum: ['info', 'low', 'medium', 'high', 'critical'] }).notNull().default('medium'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});
