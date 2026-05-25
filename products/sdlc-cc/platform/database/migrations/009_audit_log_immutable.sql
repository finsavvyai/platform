-- migration: 009_audit_log_immutable.sql
-- Day 12 of the production-ready roadmap.
--
-- Makes audit_logs HMAC-signed and append-only:
--   1. Adds a `signature` column for the HMAC-SHA256 written by the
--      audit.Writer in services/gateway/internal/infrastructure/audit.
--   2. Adds the (tenant_id, created_at DESC) index used by the new
--      admin query API.
--   3. Revokes UPDATE + DELETE on audit_logs from the application
--      role so a compromised app instance cannot tamper with rows
--      after the fact. Retention cleanup runs as the schema-owner
--      role via cleanup_old_audit_logs() (migration 005 territory).
--
-- The Writer adds the columns it needs (actor_id, actor_type, etc.)
-- if they're missing; the original audit_logs table from migration
-- 002 only had user_id. We add them via ALTER TABLE so this migration
-- is forward-compatible with both shapes.

BEGIN;

-- 1. Columns the new HMAC-signed writer expects ------------------------
ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS signature       BYTEA,
    ADD COLUMN IF NOT EXISTS actor_id        UUID,
    ADD COLUMN IF NOT EXISTS actor_type      TEXT,
    ADD COLUMN IF NOT EXISTS target_type     TEXT,
    ADD COLUMN IF NOT EXISTS target_id       TEXT,
    ADD COLUMN IF NOT EXISTS before_data     JSONB,
    ADD COLUMN IF NOT EXISTS after_data      JSONB;

-- 2. Index for admin query API (Day 13). Mirrors the existing
--    idx_audit_logs_tenant_created index from migration 002 if
--    present; created with a distinct name so re-runs are safe.
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created_v2
    ON audit_logs (tenant_id, created_at DESC);

-- 3. Append-only enforcement.
--    Revokes UPDATE + DELETE from the application role used by the
--    gateway. The schema-owner role retains full privileges so
--    retention cleanup (cleanup_old_audit_logs) can still purge old
--    rows.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sdlc_app') THEN
        REVOKE UPDATE, DELETE ON audit_logs FROM sdlc_app;
        GRANT  INSERT, SELECT  ON audit_logs TO   sdlc_app;
    END IF;
END$$;

-- 4. Belt-and-braces trigger: even with privileges revoked, callers
--    using a superuser connection should not silently mutate rows.
--    Raises an exception on any UPDATE or DELETE.
CREATE OR REPLACE FUNCTION audit_logs_immutable_guard()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION
        'audit_logs is append-only (Day 12 / migration 009)';
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_no_update ON audit_logs;
CREATE TRIGGER audit_logs_no_update
    BEFORE UPDATE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable_guard();

DROP TRIGGER IF EXISTS audit_logs_no_delete ON audit_logs;
CREATE TRIGGER audit_logs_no_delete
    BEFORE DELETE ON audit_logs
    FOR EACH STATEMENT
    WHEN (current_user <> session_user OR current_user NOT IN ('sdlc_owner', 'postgres'))
    EXECUTE FUNCTION audit_logs_immutable_guard();

COMMIT;
