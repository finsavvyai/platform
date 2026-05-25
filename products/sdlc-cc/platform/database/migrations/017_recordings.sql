-- migration: 017_recordings.sql
-- Day 54 — Session recordings (append-only).
--
-- Append-only is enforced two ways:
--   1. REVOKE UPDATE/DELETE from the application role.
--   2. A trigger that raises on UPDATE/DELETE.
--
-- The encrypted_payload column is reserved for KMS-envelope-encrypted
-- bodies; for now it is NULL and the cleartext lives in payload.
-- SCAFFOLD(P2-Day54): At-rest encryption requires the KMS work in Day 36.

CREATE TABLE IF NOT EXISTS session_recordings (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID        NOT NULL,
    tenant_id           UUID        NOT NULL,
    user_id             UUID        NOT NULL,
    consent_token       TEXT        NOT NULL,
    recorded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payload             JSONB       NULL,
    encrypted_payload   BYTEA       NULL,
    CONSTRAINT session_recordings_payload_xor CHECK (
        (payload IS NOT NULL) OR (encrypted_payload IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_session_recordings_session
    ON session_recordings (session_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_session_recordings_tenant
    ON session_recordings (tenant_id);

-- Append-only enforcement.
CREATE OR REPLACE FUNCTION session_recordings_block_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'session_recordings is append-only';
END;
$$;

DROP TRIGGER IF EXISTS session_recordings_no_update ON session_recordings;
CREATE TRIGGER session_recordings_no_update
    BEFORE UPDATE ON session_recordings
    FOR EACH ROW EXECUTE FUNCTION session_recordings_block_mutation();

DROP TRIGGER IF EXISTS session_recordings_no_delete ON session_recordings;
CREATE TRIGGER session_recordings_no_delete
    BEFORE DELETE ON session_recordings
    FOR EACH ROW EXECUTE FUNCTION session_recordings_block_mutation();

-- RLS.
ALTER TABLE session_recordings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS session_recordings_tenant_isolation ON session_recordings;
CREATE POLICY session_recordings_tenant_isolation ON session_recordings
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- The migration runner role bypasses RLS; the application role does not.
-- We REVOKE here so an attacker who steals the app's connection cannot
-- update or delete recordings even if a future trigger is dropped.
-- (Replace 'gateway_app' with your actual application role name.)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gateway_app') THEN
        REVOKE UPDATE, DELETE ON session_recordings FROM gateway_app;
    END IF;
END
$$;
