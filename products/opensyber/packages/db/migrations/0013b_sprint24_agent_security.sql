-- Sprint 24: Agent Security Platform + Thin CSPM - Part 2
-- Creates tables for alert channels and risk snapshots. Adds scheduling to cloud_accounts.

-- ─── Alert Channels ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_channels (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL CHECK(channel_type IN ('email', 'slack', 'pagerduty', 'opsgenie', 'teams', 'discord')),
  name TEXT NOT NULL,
  config TEXT NOT NULL,
  min_severity TEXT NOT NULL DEFAULT 'medium' CHECK(min_severity IN ('critical', 'high', 'medium', 'low')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_alert_channels_org ON alert_channels(org_id);
CREATE INDEX IF NOT EXISTS idx_alert_channels_org_active ON alert_channels(org_id, is_active);

-- ─── Agent Risk Snapshots ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_risk_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  agent_score INTEGER NOT NULL DEFAULT 100,
  cspm_score INTEGER NOT NULL DEFAULT 100,
  combined_score INTEGER NOT NULL DEFAULT 100,
  grade TEXT NOT NULL DEFAULT 'A',
  agent_event_count INTEGER NOT NULL DEFAULT 0,
  cspm_finding_count INTEGER NOT NULL DEFAULT 0,
  snapshot_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_risk_snapshots_user_date ON agent_risk_snapshots(user_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_risk_snapshots_org_date ON agent_risk_snapshots(org_id, snapshot_date);

-- Unique partial index to prevent duplicate snapshots per user/org per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_risk_snapshots_user_unique
  ON agent_risk_snapshots(COALESCE(user_id, ''), snapshot_date)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_risk_snapshots_org_unique
  ON agent_risk_snapshots(COALESCE(org_id, ''), snapshot_date)
  WHERE org_id IS NOT NULL AND user_id IS NULL;

-- ─── Add Scheduling to Cloud Accounts ─────────────────────────────────────
-- Add scan_schedule column (default 'manual')
ALTER TABLE cloud_accounts ADD COLUMN scan_schedule TEXT DEFAULT 'manual' CHECK(scan_schedule IN ('manual', 'daily', 'weekly'));

-- Add next_scan_at column (nullable, set when schedule is active)
ALTER TABLE cloud_accounts ADD COLUMN next_scan_at TEXT;

-- Index for scheduled scan queries
CREATE INDEX IF NOT EXISTS idx_cloud_accounts_next_scan ON cloud_accounts(next_scan_at)
  WHERE scan_schedule != 'manual';
