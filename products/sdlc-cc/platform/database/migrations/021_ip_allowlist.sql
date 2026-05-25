-- 021_ip_allowlist.sql
-- BEAT-PLAN Day 26 — per-tenant per-API-key IP allowlist.
--
-- Lookup precedence: api-key-specific rule > tenant-wide rule > deny
-- when network_mode='private_only', allow when 'public'.
--
-- Mirrors services/gateway/internal/infrastructure/migrations/migrations/
-- 011_ip_allowlist.sql into the canonical database/migrations/ dir
-- that make-it-run.sh and CI consume.

CREATE TABLE IF NOT EXISTS ip_allowlists (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    api_key_id  UUID,                 -- NULL = tenant-wide rule
    cidr        CIDR NOT NULL,
    label       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, api_key_id, cidr)
);

CREATE INDEX IF NOT EXISTS idx_ip_allowlist_tenant
    ON ip_allowlists USING gist (tenant_id, cidr inet_ops);

ALTER TABLE ip_allowlists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ip_allowlists_isolation ON ip_allowlists;
CREATE POLICY ip_allowlists_isolation ON ip_allowlists
    FOR ALL TO app_user
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID
           OR current_setting('app.current_tenant_id', true) = 'system');

ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS network_mode TEXT NOT NULL DEFAULT 'public'
        CHECK (network_mode IN ('public', 'private_only'));

COMMENT ON COLUMN tenants.network_mode IS
    'Per-tenant network policy. ''public'' = allow any source IP; ''private_only'' = require a matching CIDR in ip_allowlists.';
