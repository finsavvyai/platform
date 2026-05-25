-- Migration 029 — tenant-defined custom DLP patterns.
-- Claude Team B4 closeout: every Claude Team org has internal-only
-- identifiers (employee IDs, project codenames, customer numbers)
-- that the built-in 15-class detector does not recognize. This
-- column lets the tenant register their own regex pack alongside.
--
-- Storage shape: an array of {name, regex} objects.
--   [
--     {"name": "employee_id", "regex": "EMP-\\d{6}"},
--     {"name": "project_code", "regex": "PRJ-[A-Z]{3}-\\d{4}"}
--   ]
--
-- The middleware compiles each entry on first use per (tenant_id,
-- updated_at) pair; invalid regexes are silently skipped so a
-- typo in one rule cannot wedge the whole DLP pipeline.

BEGIN;

ALTER TABLE tenant_dlp_policy
    ADD COLUMN IF NOT EXISTS custom_patterns JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMIT;
