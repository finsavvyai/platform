/**
 * Series A Exit Milestone Schema
 *
 * Tables for multi-cloud config and SOC2 evidence collection.
 */
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations.js';

export const multiCloudConfigs = sqliteTable('multi_cloud_configs', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // aws, gcp, azure
  displayName: text('display_name').notNull(),
  config: text('config').notNull(), // encrypted JSON (role ARN, service account, etc.)
  region: text('region'),
  status: text('status').notNull().default('active'),
  lastSyncAt: text('last_sync_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const soc2Evidence = sqliteTable('soc2_evidence', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  controlId: text('control_id').notNull(),
  tsc: text('tsc').notNull(), // CC1.1, CC6.1, etc.
  evidenceType: text('evidence_type').notNull(), // screenshot, log, config, report
  title: text('title').notNull(),
  description: text('description'),
  artifactUrl: text('artifact_url'),
  collectedAt: text('collected_at').notNull().default(sql`(datetime('now'))`),
  validUntil: text('valid_until'),
  status: text('status').notNull().default('current'), // current, expired, superseded
});
