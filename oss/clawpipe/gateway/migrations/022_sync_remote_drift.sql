-- 022_sync_remote_drift.sql
-- Bring remote D1 in sync with migrations 0002, 006 (quality_scores only),
-- 015, 016, 017, 018 (requests.user_id only), 019, 020.
--
-- Discovered via /lam audit on 2026-05-22 after the api_keys fix (021).
-- Remote was running on migrations 0001 + 0003-0005 + 0004 + 007-013 + 014 + 011 + 021;
-- migrations 0002, 006, 015, 016, 017, 018 (partial), 019, 020 had never been
-- applied. Code in src/{quality,audit-events,webhook-dlq,billing,auth/provider-keys,...}
-- was querying tables that did not exist, returning 500.
--
-- 014 was already applied (teams.rate_limit_per_day exists on remote) — skip.
-- 018's `ALTER api_keys ADD member_user_id` is already covered by 021's
-- CREATE which included that column directly — skip.
-- 006's prompts/prompt_versions CREATEs are no-ops on remote (0004 versions
-- exist), so only quality_scores + its index are included here.

-- ─── 0002: usage_daily ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usage_daily (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  date TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE (project_id, date)
);
CREATE INDEX IF NOT EXISTS idx_usage_daily_project ON usage_daily(project_id, date);

-- ─── 006: quality_scores ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_scores (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  request_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  score REAL NOT NULL CHECK(score >= 0 AND score <= 1),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_quality_project ON quality_scores(project_id, created_at);

-- ─── 015: lemonsqueezy billing (projects columns + billing_events) ───────
ALTER TABLE projects ADD COLUMN ls_subscription_id TEXT;
ALTER TABLE projects ADD COLUMN ls_customer_id TEXT;
ALTER TABLE projects ADD COLUMN tier_status TEXT DEFAULT 'active';
ALTER TABLE projects ADD COLUMN renewal_at INTEGER;
CREATE TABLE IF NOT EXISTS billing_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  ls_event_id TEXT NOT NULL UNIQUE,
  payload_json TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_billing_events_project
  ON billing_events(project_id, created_at DESC);
UPDATE projects SET tier = 'growth' WHERE tier = 'pro';
UPDATE projects SET tier = 'scale'  WHERE tier = 'team';

-- ─── 016: webhook_deliveries ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              TEXT PRIMARY KEY,
  webhook_id      TEXT NOT NULL,
  project_id      TEXT NOT NULL,
  event           TEXT NOT NULL,
  payload         TEXT NOT NULL,
  attempts        INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 5,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'success', 'dead')),
  last_error      TEXT,
  next_retry_at   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_pending
  ON webhook_deliveries (status, next_retry_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_project
  ON webhook_deliveries (project_id, created_at DESC);

-- ─── 017: provider_keys ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS provider_keys (
  project_id   TEXT NOT NULL,
  provider     TEXT NOT NULL,
  ciphertext_b64 TEXT NOT NULL,
  nonce_b64    TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id, provider),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- ─── 018: requests.user_id (api_keys.member_user_id already in 021) ──────
ALTER TABLE requests ADD COLUMN user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_requests_user ON requests (user_id, created_at);

-- ─── 019: projects.teams_webhook_url ─────────────────────────────────────
ALTER TABLE projects ADD COLUMN teams_webhook_url TEXT;

-- ─── 020: audit_events ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_events (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL,
  actor_user_id   TEXT,
  action          TEXT NOT NULL,
  target          TEXT,
  metadata        TEXT,
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_audit_project ON audit_events(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action  ON audit_events(action);
