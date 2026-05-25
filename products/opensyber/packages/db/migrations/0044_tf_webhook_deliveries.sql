-- Per-delivery log + secret rotation grace window.

-- Rotation grace: keep previous secret valid until a timestamp so integrators
-- can switch env vars without missing a beat. NULL = no active previous secret.
ALTER TABLE tf_webhook_config ADD COLUMN secret_previous TEXT;
ALTER TABLE tf_webhook_config ADD COLUMN secret_previous_valid_until TEXT;

-- Delivery log: one row per attempt (not per event). Replays create new rows.
CREATE TABLE IF NOT EXISTS tf_webhook_deliveries (
  id TEXT PRIMARY KEY,
  webhook_id TEXT NOT NULL REFERENCES tf_webhook_config(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  event TEXT NOT NULL,
  payload TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 1,
  status INTEGER,
  error TEXT,
  scheduled_at TEXT NOT NULL DEFAULT (datetime('now')),
  delivered_at TEXT,
  next_retry_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tf_webhook_deliveries_webhook_id
  ON tf_webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_tf_webhook_deliveries_tenant_id
  ON tf_webhook_deliveries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tf_webhook_deliveries_next_retry
  ON tf_webhook_deliveries(next_retry_at) WHERE next_retry_at IS NOT NULL;
