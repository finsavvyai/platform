-- Migration 015: LemonSqueezy billing.
-- Replaces the unfinished Stripe integration; no stripe_* columns existed,
-- so this is purely additive aside from the legacy tier rename below.
-- Applied: 2026-04-25

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

-- Map any legacy 'pro' rows to 'growth', 'team' to 'scale' (one-shot best-effort).
UPDATE projects SET tier = 'growth' WHERE tier = 'pro';
UPDATE projects SET tier = 'scale'  WHERE tier = 'team';
