-- 019_tenant_dlp_policy.sql
-- BEAT-PLAN S2.1 — per-tenant DLP policy.
--
-- One row per tenant. action ∈ {allow, mask, redact, block}. Missing
-- row = allow (the middleware fails open).
--
-- The middleware (services/gateway/internal/infrastructure/middleware/
-- dlp_policy_lookup.go) reads this table on every request through a
-- short-lived pgx pool query; tune the cache layer in PgxPolicyLookup
-- if read-volume becomes an issue.

CREATE TABLE IF NOT EXISTS tenant_dlp_policy (
    tenant_id   UUID        PRIMARY KEY,
    action      TEXT        NOT NULL CHECK (action IN ('allow','mask','redact','block')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_dlp_policy_action
    ON tenant_dlp_policy (action);

-- Re-runnable updated_at trigger.
DROP TRIGGER IF EXISTS tenant_dlp_policy_updated_at ON tenant_dlp_policy;
CREATE TRIGGER tenant_dlp_policy_updated_at
    BEFORE UPDATE ON tenant_dlp_policy
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Tenant isolation. The middleware queries with current_setting()
-- already, but RLS belt-and-braces protects against direct DB clients.
ALTER TABLE tenant_dlp_policy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_dlp_policy ON tenant_dlp_policy;
CREATE POLICY tenant_isolation_dlp_policy ON tenant_dlp_policy
    FOR ALL TO app_user
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID
           OR current_setting('app.current_tenant_id', true) = 'system');
