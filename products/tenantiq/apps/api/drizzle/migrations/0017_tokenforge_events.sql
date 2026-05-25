-- TokenForge webhook event log — mirrors cloud dashboard events into D1
-- so tenantiq can render the Sessions page without calling cloud per view.

CREATE TABLE IF NOT EXISTS tf_webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id TEXT,
  session_id TEXT,
  device_id TEXT,
  trust_score INTEGER,
  ip_address TEXT,
  country_code TEXT,
  user_agent TEXT,
  reason TEXT,
  payload TEXT,
  received_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tfwh_type ON tf_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_tfwh_user ON tf_webhook_events(user_id);
CREATE INDEX IF NOT EXISTS idx_tfwh_received ON tf_webhook_events(received_at);
