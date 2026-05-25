-- Sprint 25: Attack Graph Schema
-- Assets, relations, and attack path snapshots for blast radius visualization

CREATE TABLE IF NOT EXISTS `assets` (
  `id` text PRIMARY KEY NOT NULL,
  `org_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  `asset_type` text NOT NULL,
  `name` text NOT NULL,
  `identifier` text NOT NULL,
  `sensitivity` text NOT NULL DEFAULT 'medium',
  `is_crown_jewel` integer NOT NULL DEFAULT 0,
  `metadata` text,
  `discovery_source` text NOT NULL,
  `status` text NOT NULL DEFAULT 'active',
  `first_seen_at` text NOT NULL,
  `last_seen_at` text NOT NULL,
  `created_at` text NOT NULL DEFAULT (datetime('now')),
  `updated_at` text NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS `asset_relations` (
  `id` text PRIMARY KEY NOT NULL,
  `org_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  `source_asset_id` text NOT NULL REFERENCES `assets`(`id`) ON DELETE CASCADE,
  `target_asset_id` text NOT NULL REFERENCES `assets`(`id`) ON DELETE CASCADE,
  `relation_type` text NOT NULL,
  `confidence` real NOT NULL DEFAULT 1.0,
  `discovery_source` text NOT NULL,
  `metadata` text,
  `first_seen_at` text NOT NULL,
  `last_seen_at` text NOT NULL,
  `created_at` text NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS `attack_path_snapshots` (
  `id` text PRIMARY KEY NOT NULL,
  `org_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  `entry_asset_id` text NOT NULL REFERENCES `assets`(`id`) ON DELETE CASCADE,
  `blast_radius_score` integer NOT NULL,
  `total_reachable` integer NOT NULL,
  `crown_jewels_reached` integer NOT NULL,
  `paths_json` text NOT NULL,
  `computed_at` text NOT NULL DEFAULT (datetime('now'))
);

-- Performance indexes for graph traversal
CREATE INDEX IF NOT EXISTS `idx_assets_org_id` ON `assets`(`org_id`);
CREATE INDEX IF NOT EXISTS `idx_assets_org_type` ON `assets`(`org_id`, `asset_type`);
CREATE INDEX IF NOT EXISTS `idx_assets_org_sensitivity` ON `assets`(`org_id`, `sensitivity`);
CREATE INDEX IF NOT EXISTS `idx_assets_org_identifier` ON `assets`(`org_id`, `identifier`);
CREATE INDEX IF NOT EXISTS `idx_assets_org_status` ON `assets`(`org_id`, `status`);
CREATE INDEX IF NOT EXISTS `idx_asset_relations_source` ON `asset_relations`(`source_asset_id`);
CREATE INDEX IF NOT EXISTS `idx_asset_relations_target` ON `asset_relations`(`target_asset_id`);
CREATE INDEX IF NOT EXISTS `idx_asset_relations_org` ON `asset_relations`(`org_id`);
CREATE INDEX IF NOT EXISTS `idx_asset_relations_org_source` ON `asset_relations`(`org_id`, `source_asset_id`);
CREATE INDEX IF NOT EXISTS `idx_attack_snapshots_org` ON `attack_path_snapshots`(`org_id`);
CREATE INDEX IF NOT EXISTS `idx_attack_snapshots_entry` ON `attack_path_snapshots`(`entry_asset_id`);
