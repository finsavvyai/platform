import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { skills } from './instances.js';
import { users } from './users.js';
import { organizations } from './organizations.js';

export const skillVersions = sqliteTable('skill_versions', {
  id: text('id').primaryKey(),
  skillId: text('skill_id').notNull().references(() => skills.id, { onDelete: 'cascade' }),
  version: text('version').notNull(),
  changelog: text('changelog'),
  bundleR2Key: text('bundle_r2_key'),
  sdkVersion: text('sdk_version'),
  fileSize: integer('file_size'),
  checksum: text('checksum'),
  status: text('status', { enum: ['draft', 'published', 'deprecated'] }).notNull().default('draft'),
  publishedAt: text('published_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const marketplaceSubmissions = sqliteTable('marketplace_submissions', {
  id: text('id').primaryKey(),
  skillId: text('skill_id').notNull().references(() => skills.id, { onDelete: 'cascade' }),
  versionId: text('version_id').notNull().references(() => skillVersions.id),
  submittedBy: text('submitted_by').notNull().references(() => users.id),
  status: text('status', { enum: ['pending', 'scanning', 'reviewing', 'approved', 'rejected'] }).notNull().default('pending'),
  scanResult: text('scan_result'),
  reviewNotes: text('review_notes'),
  reviewedBy: text('reviewed_by').references(() => users.id),
  reviewedAt: text('reviewed_at'),
  submittedAt: text('submitted_at').notNull().default(sql`(datetime('now'))`),
});

export const marketplaceRatings = sqliteTable('marketplace_ratings', {
  id: text('id').primaryKey(),
  skillId: text('skill_id').notNull().references(() => skills.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id),
  rating: integer('rating').notNull(),
  review: text('review'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const skillExecutions = sqliteTable('skill_executions', {
  id: text('id').primaryKey(),
  skillId: text('skill_id').notNull().references(() => skills.id),
  orgId: text('org_id').references(() => organizations.id),
  userId: text('user_id').references(() => users.id),
  status: text('status', { enum: ['running', 'completed', 'failed', 'timeout'] }).notNull(),
  durationMs: integer('duration_ms'),
  findingCount: integer('finding_count').notNull().default(0),
  metricCount: integer('metric_count').notNull().default(0),
  error: text('error'),
  startedAt: text('started_at').notNull().default(sql`(datetime('now'))`),
  completedAt: text('completed_at'),
});

export const publisherPayouts = sqliteTable('publisher_payouts', {
  id: text('id').primaryKey(),
  publisherId: text('publisher_id').notNull().references(() => users.id),
  skillId: text('skill_id').notNull().references(() => skills.id),
  periodStart: text('period_start').notNull(),
  periodEnd: text('period_end').notNull(),
  grossRevenue: integer('gross_revenue').notNull(),
  publisherShare: integer('publisher_share').notNull(),
  platformShare: integer('platform_share').notNull(),
  status: text('status', { enum: ['pending', 'paid', 'cancelled'] }).notNull().default('pending'),
  paidAt: text('paid_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});
