-- 0007_display_ids.sql
-- Adds human-readable display IDs (e.g. TC-0001, RN-0001, TP-0001) alongside
-- the existing UUID primary keys on test_cases, test_runs, and test_plans.
--
-- Design (per .luna/heal/heal-report-pass2.md section 9 with adjustments):
--   1. Keep existing UUID PKs untouched.
--   2. Add `display_id TEXT UNIQUE` secondary column on the 3 tables.
--   3. New table `id_counters(entity, current, updated_at)` — atomic counter
--      per entity type. Allocation uses a D1 transaction:
--        UPDATE id_counters SET current = current + 1 ... RETURNING current
--   4. Backfill deterministically via ROW_NUMBER() OVER (ORDER BY created_at),
--      guarded by `WHERE display_id IS NULL` so re-runs are idempotent.
--   5. Seed `id_counters.current` with MAX(backfilled sequence) per entity.
--
-- NOTE: SQLite has no LPAD; we use printf('%04d', ...). Prefix is fixed per
-- entity (TC / RN / TP), so substr(display_id, 4) extracts the numeric tail.

-- 1. Counter table (global per-entity counter — not per-project).
CREATE TABLE IF NOT EXISTS id_counters (
    entity TEXT PRIMARY KEY NOT NULL,
    current INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
);

-- 2. Add display_id columns (nullable — cannot be NOT NULL while we backfill).
--    SQLite's ALTER TABLE ADD COLUMN cannot add UNIQUE inline; we add the
--    unique index after backfill in step 5.
ALTER TABLE test_cases ADD COLUMN display_id TEXT;
ALTER TABLE test_runs  ADD COLUMN display_id TEXT;
ALTER TABLE test_plans ADD COLUMN display_id TEXT;

-- 3. Backfill test_cases → TC-NNNN (deterministic by created_at, id).
UPDATE test_cases
SET display_id = (
    SELECT 'TC-' || printf('%04d', rn)
    FROM (
        SELECT id AS inner_id,
               ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
        FROM test_cases
    ) numbered
    WHERE numbered.inner_id = test_cases.id
)
WHERE display_id IS NULL;

-- 4a. Backfill test_runs → RN-NNNN.
UPDATE test_runs
SET display_id = (
    SELECT 'RN-' || printf('%04d', rn)
    FROM (
        SELECT id AS inner_id,
               ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
        FROM test_runs
    ) numbered
    WHERE numbered.inner_id = test_runs.id
)
WHERE display_id IS NULL;

-- 4b. Backfill test_plans → TP-NNNN.
UPDATE test_plans
SET display_id = (
    SELECT 'TP-' || printf('%04d', rn)
    FROM (
        SELECT id AS inner_id,
               ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
        FROM test_plans
    ) numbered
    WHERE numbered.inner_id = test_plans.id
)
WHERE display_id IS NULL;

-- 5. Create UNIQUE indexes (enforces uniqueness + enables fast search by display_id).
CREATE UNIQUE INDEX IF NOT EXISTS test_cases_display_id_uq
    ON test_cases(display_id);
CREATE UNIQUE INDEX IF NOT EXISTS test_runs_display_id_uq
    ON test_runs(display_id);
CREATE UNIQUE INDEX IF NOT EXISTS test_plans_display_id_uq
    ON test_plans(display_id);

-- 6. Seed id_counters from the max backfilled sequence per entity.
--    Extract numeric suffix via substr(display_id, 4) — works because the
--    prefixes are all exactly 3 chars (TC-, RN-, TP-).
INSERT OR IGNORE INTO id_counters (entity, current, updated_at)
VALUES
    ('test_case', COALESCE(
        (SELECT MAX(CAST(substr(display_id, 4) AS INTEGER))
         FROM test_cases WHERE display_id LIKE 'TC-%'),
        0
    ), strftime('%s', 'now') * 1000),
    ('test_run', COALESCE(
        (SELECT MAX(CAST(substr(display_id, 4) AS INTEGER))
         FROM test_runs WHERE display_id LIKE 'RN-%'),
        0
    ), strftime('%s', 'now') * 1000),
    ('test_plan', COALESCE(
        (SELECT MAX(CAST(substr(display_id, 4) AS INTEGER))
         FROM test_plans WHERE display_id LIKE 'TP-%'),
        0
    ), strftime('%s', 'now') * 1000);
