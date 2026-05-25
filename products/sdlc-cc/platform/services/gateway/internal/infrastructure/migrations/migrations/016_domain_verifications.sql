-- Per-tenant domain verification records.
-- Customers verify domain ownership via DNS TXT or HTTP .well-known file.
-- Verified domains auto-redirect logins to the tenant's configured SSO.
-- Re-verification is required quarterly (expires_at = verified_at + 90 days).

CREATE TABLE IF NOT EXISTS domain_verifications (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    domain      TEXT        NOT NULL,
    token       TEXT        NOT NULL,
    method      VARCHAR(4)  NOT NULL CHECK (method IN ('dns', 'http')),
    status      VARCHAR(8)  NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'verified', 'expired')),

    verified_at TIMESTAMPTZ,
    expires_at  TIMESTAMPTZ,           -- verified_at + 90 days; null while pending
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- One verification record per domain per tenant.
    UNIQUE (tenant_id, domain)
);

CREATE INDEX IF NOT EXISTS domain_verifications_domain_status_idx
    ON domain_verifications (domain, status);

COMMENT ON TABLE domain_verifications IS
    'Tenant-owned domain verification. Day 25 — domain verification + auto SSO redirect.';
