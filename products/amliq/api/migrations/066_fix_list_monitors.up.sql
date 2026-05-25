-- Fix list_monitors deploy-blocking issues found in verification
-- (docs/deploy-verification-2026-04-17.md).
--
-- 1. id column is VARCHAR(20) but the constructor produces ids like
--    `lm_tnt_abc123def456_israeli_nbctf` (~30 chars). Every upsert
--    was failing with "value too long for type character varying(20)"
--    and the table stayed empty. Widen to TEXT.
-- 2. tenant_id has FK to tenants(id), but the `__global__` sentinel
--    tenant that reingest-global + reingest-peps use is never seeded.
--    Insert it here so hook upserts don't fail on FK violation.

ALTER TABLE list_monitors ALTER COLUMN id TYPE TEXT;
ALTER TABLE list_monitors ALTER COLUMN tenant_id TYPE TEXT;
ALTER TABLE list_monitors ALTER COLUMN list_source TYPE TEXT;

INSERT INTO tenants (id, name, display_name)
VALUES ('__global__', '__global__', 'System (Global)')
ON CONFLICT (id) DO NOTHING;
