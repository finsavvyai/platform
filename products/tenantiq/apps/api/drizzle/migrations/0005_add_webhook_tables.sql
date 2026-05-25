-- Add webhook configuration and delivery tables for D1-backed API routes.

CREATE TABLE IF NOT EXISTS webhook_configs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  webhook_url TEXT NOT NULL,
  webhook_secret TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  notification_mode TEXT DEFAULT 'realtime',
  min_severity TEXT,
  categories TEXT DEFAULT '[]',
  quiet_hours_start TEXT,
  quiet_hours_end TEXT,
  quiet_hours_timezone TEXT DEFAULT 'UTC',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webhook_configs_tenant ON webhook_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_configs_user ON webhook_configs(user_id);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY,
  webhook_config_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  last_attempt_at TEXT,
  next_retry_at TEXT,
  response_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  delivered_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_config ON webhook_deliveries(webhook_config_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_next_retry ON webhook_deliveries(next_retry_at);
