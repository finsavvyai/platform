-- Tamper-evident audit log: HMAC-SHA256 signature per row, REVOKE
-- UPDATE/DELETE on the table for the application role so writes are
-- append-only at the database level even if app code tries otherwise.
--
-- Day 12 of the production-ready roadmap.

CREATE TABLE IF NOT EXISTS audit_logs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    actor_id     UUID,
    actor_type   TEXT NOT NULL CHECK (actor_type IN ('user', 'api_key', 'system', 'service')),
    action       TEXT NOT NULL,
    target_type  TEXT,
    target_id    TEXT,
    before_data  JSONB,
    after_data   JSONB,
    ip_address   INET,
    user_agent   TEXT,
    request_id   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- HMAC-SHA256 over (tenant_id || actor_id || action || target_type ||
    -- target_id || created_at || before_data || after_data) keyed by an
    -- environment secret so a row tamper is detectable without trusting
    -- the surrounding row's columns alone.
    signature    BYTEA NOT NULL,
    -- Tracks the legal-hold window for retention (Day 33). Null means
    -- the row is not on hold and may be purged per tenant policy.
    hold_until   TIMESTAMPTZ
);

-- Hot-path index for the audit query API (Day 13).
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created
    ON audit_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
    ON audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
    ON audit_logs (tenant_id, action, created_at DESC);

-- Row-Level Security: tenants only see their own rows.
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_tenant_isolation ON audit_logs;
CREATE POLICY audit_logs_tenant_isolation ON audit_logs
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Append-only enforcement. The application role can INSERT + SELECT
-- but NOT UPDATE / DELETE. A super-admin migration role retains full
-- access for explicit retention purges (Day 33's purge orchestrator).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sdlc_app') THEN
        REVOKE UPDATE, DELETE ON audit_logs FROM sdlc_app;
        GRANT INSERT, SELECT ON audit_logs TO sdlc_app;
    END IF;
END$$;

COMMENT ON TABLE audit_logs IS
    'Append-only audit log. Every row carries an HMAC signature. '
    'Tampering detection: rehash and compare; mismatch = compromise. '
    'UPDATE/DELETE revoked for the app role (Day 12).';

COMMENT ON COLUMN audit_logs.signature IS
    'HMAC-SHA256 over the row''s identifying fields. Key supplied via '
    'AUDIT_SIGNING_KEY env var; rotate via dual-write + reverify.';
