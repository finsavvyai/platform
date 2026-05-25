-- 0010_remediations_scheduled_at.sql
-- Add the `scheduled_at` column that the Drizzle schema (and the
-- scheduled-remediation cron) expect. Prod D1 was seeded without it,
-- so the cron was throwing "no such column" every 5 minutes.

ALTER TABLE remediations ADD COLUMN scheduled_at TEXT;

CREATE INDEX IF NOT EXISTS idx_remediations_scheduled
  ON remediations(status, scheduled_at);
