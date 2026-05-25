-- Per-tenant per-API-key IP allowlist. Day 26 of the production-ready
-- roadmap.
--
-- Lookup precedence: api-key-specific rule > tenant-wide rule > deny
-- when network_mode='private_only', allow when 'public'.

CREATE TABLE IF NOT EXISTS ip_allowlists (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    api_key_id  UUID,                 -- null = tenant-wide rule
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
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS network_mode TEXT NOT NULL DEFAULT 'public'
        CHECK (network_mode IN ('public', 'private_only'));
