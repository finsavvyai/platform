-- No-op: columns already present on production D1.
-- Original migration was ADD COLUMN statements that partially applied
-- then blocked future migrations on retry (ALTER TABLE ADD COLUMN is
-- not idempotent in SQLite). PRAGMA confirms all target columns
-- (test_plan_id, name, passed, failed, skipped, total, started_at,
-- completed_at) exist on the live table as of 2026-04-19.
SELECT 1;
