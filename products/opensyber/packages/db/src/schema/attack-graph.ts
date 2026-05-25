import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations.js';

export const assets = sqliteTable('assets', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  assetType: text('asset_type').notNull(),
  name: text('name').notNull(),
  identifier: text('identifier').notNull(),
  sensitivity: text('sensitivity').notNull().default('medium'),
  isCrownJewel: integer('is_crown_jewel', { mode: 'boolean' }).notNull().default(false),
  metadata: text('metadata'),
  discoverySource: text('discovery_source').notNull(),
  status: text('status').notNull().default('active'),
  firstSeenAt: text('first_seen_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const assetRelations = sqliteTable('asset_relations', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  sourceAssetId: text('source_asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  targetAssetId: text('target_asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  relationType: text('relation_type').notNull(),
  confidence: real('confidence').notNull().default(1.0),
  discoverySource: text('discovery_source').notNull(),
  metadata: text('metadata'),
  firstSeenAt: text('first_seen_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const attackPathSnapshots = sqliteTable('attack_path_snapshots', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  entryAssetId: text('entry_asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  blastRadiusScore: integer('blast_radius_score').notNull(),
  totalReachable: integer('total_reachable').notNull(),
  crownJewelsReached: integer('crown_jewels_reached').notNull(),
  pathsJson: text('paths_json').notNull(),
  computedAt: text('computed_at').notNull().default(sql`(datetime('now'))`),
});
