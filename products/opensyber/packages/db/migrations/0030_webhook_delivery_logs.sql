-- Webhook delivery logs for tracking outbound webhook attempts
CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
  id TEXT PRIMARY KEY,
  org_id TEXT,
  webhook_url TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  status_code INTEGER,
  response_body TEXT,
  error_message TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_retry_at TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_wdl_org_id ON webhook_delivery_logs(org_id);
CREATE INDEX idx_wdl_status ON webhook_delivery_logs(status);
CREATE INDEX idx_wdl_created_at ON webhook_delivery_logs(created_at);
