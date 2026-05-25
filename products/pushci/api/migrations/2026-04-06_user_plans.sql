-- User plan and AI usage tracking
CREATE TABLE IF NOT EXISTS users (
  sub TEXT PRIMARY KEY,
  login TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'github',
  plan TEXT NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  ai_usage_count INTEGER NOT NULL DEFAULT 0,
  ai_usage_reset_at TEXT NOT NULL DEFAULT (datetime('now', 'start of month', '+1 month')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_stripe ON users(stripe_customer_id);
