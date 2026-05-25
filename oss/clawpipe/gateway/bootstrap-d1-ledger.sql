-- bootstrap-d1-ledger.sql
-- One-shot bootstrap of wrangler's d1_migrations table on remote D1.
--
-- Context: migrations 0001-022 were applied manually via
-- `wrangler d1 execute clawpipe --remote --file=…` before we enabled
-- wrangler's built-in migration tracker (migrations_dir in wrangler.toml).
-- Without pre-marking these as applied, `wrangler d1 migrations apply`
-- would attempt to re-run every one, and the non-idempotent ALTERs in
-- 0003/007-012/014/015/018/019 would fail.
--
-- This script is NOT placed in migrations/ on purpose — wrangler scans
-- that directory and would try to apply it. Apply once via:
--   CLOUDFLARE_API_TOKEN=… wrangler d1 execute clawpipe --remote \
--     --file=bootstrap-d1-ledger.sql
--
-- After this runs once, `wrangler d1 migrations list --remote` will
-- show 0 pending, and future migrations added under migrations/ are
-- applied with `wrangler d1 migrations apply clawpipe --remote`.

CREATE TABLE IF NOT EXISTS d1_migrations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT UNIQUE,
  applied_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO d1_migrations (name) VALUES
  ('0001_initial_schema.sql'),
  ('0002_billing_usage.sql'),
  ('0003_leverage_quickwins.sql'),
  ('0004_prompt_store.sql'),
  ('0005_budget_hierarchy.sql'),
  ('006_quality_prompts.sql'),
  ('007_slack_digest.sql'),
  ('008_budget_cap.sql'),
  ('009_email_digest.sql'),
  ('010_project_team_link.sql'),
  ('011_invitations.sql'),
  ('012_anomaly_alerts.sql'),
  ('013_webhook_secret.sql'),
  ('014_team_rate_limit.sql'),
  ('015_lemonsqueezy_billing.sql'),
  ('016_webhook_deliveries.sql'),
  ('017_provider_keys.sql'),
  ('018_user_attribution.sql'),
  ('019_teams_webhook.sql'),
  ('020_audit_events.sql'),
  ('021_api_keys_table.sql'),
  ('022_sync_remote_drift.sql');
