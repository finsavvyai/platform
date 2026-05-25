-- 016_webhook_deliveries.sql
-- Persistent delivery log + retry queue for outbound webhooks.
-- Status:
--   pending  — scheduled for next retry (or initial dispatch)
--   success  — delivered, terminal
--   dead     — exhausted retries, terminal until manually replayed

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
