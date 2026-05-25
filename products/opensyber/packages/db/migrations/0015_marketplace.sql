-- Sprint 27: Marketplace + Skill Ecosystem

-- Add marketplace columns to existing skills table
ALTER TABLE skills ADD COLUMN item_type TEXT NOT NULL DEFAULT 'free';
ALTER TABLE skills ADD COLUMN tier TEXT NOT NULL DEFAULT 'free';
ALTER TABLE skills ADD COLUMN price_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE skills ADD COLUMN manifest TEXT;
ALTER TABLE skills ADD COLUMN bundle_r2_key TEXT;
ALTER TABLE skills ADD COLUMN sdk_version TEXT;
ALTER TABLE skills ADD COLUMN publisher_id TEXT REFERENCES users(id);
ALTER TABLE skills ADD COLUMN license TEXT;
ALTER TABLE skills ADD COLUMN homepage TEXT;
ALTER TABLE skills ADD COLUMN repository TEXT;
ALTER TABLE skills ADD COLUMN tags TEXT;
ALTER TABLE skills ADD COLUMN screenshots TEXT;
ALTER TABLE skills ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0;
ALTER TABLE skills ADD COLUMN is_certified INTEGER NOT NULL DEFAULT 0;

-- Skill versions
CREATE TABLE IF NOT EXISTS skill_versions (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  changelog TEXT,
  bundle_r2_key TEXT,
  sdk_version TEXT,
  file_size INTEGER,
  checksum TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_skill_versions_skill ON skill_versions(skill_id);

-- Marketplace submissions
CREATE TABLE IF NOT EXISTS marketplace_submissions (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  version_id TEXT NOT NULL REFERENCES skill_versions(id),
  submitted_by TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  scan_result TEXT,
  review_notes TEXT,
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_submissions_skill ON marketplace_submissions(skill_id);
CREATE INDEX idx_submissions_status ON marketplace_submissions(status);

-- Marketplace ratings
CREATE TABLE IF NOT EXISTS marketplace_ratings (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL,
  review TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_ratings_skill ON marketplace_ratings(skill_id);
CREATE UNIQUE INDEX idx_ratings_user_skill ON marketplace_ratings(skill_id, user_id);

-- Skill executions
CREATE TABLE IF NOT EXISTS skill_executions (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES skills(id),
  org_id TEXT REFERENCES organizations(id),
  user_id TEXT REFERENCES users(id),
  status TEXT NOT NULL,
  duration_ms INTEGER,
  finding_count INTEGER NOT NULL DEFAULT 0,
  metric_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX idx_executions_skill ON skill_executions(skill_id);
CREATE INDEX idx_executions_org ON skill_executions(org_id);

-- Publisher payouts
CREATE TABLE IF NOT EXISTS publisher_payouts (
  id TEXT PRIMARY KEY,
  publisher_id TEXT NOT NULL REFERENCES users(id),
  skill_id TEXT NOT NULL REFERENCES skills(id),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  gross_revenue INTEGER NOT NULL,
  publisher_share INTEGER NOT NULL,
  platform_share INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_payouts_publisher ON publisher_payouts(publisher_id);
