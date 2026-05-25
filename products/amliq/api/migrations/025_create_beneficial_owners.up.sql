CREATE TABLE beneficial_owners (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    organization_id TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    nationality TEXT,
    ownership_pct DOUBLE PRECISION NOT NULL,
    is_direct_owner BOOLEAN NOT NULL DEFAULT TRUE,
    is_pep BOOLEAN NOT NULL DEFAULT FALSE,
    is_sanctioned BOOLEAN NOT NULL DEFAULT FALSE,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ubo_org ON beneficial_owners(organization_id);
CREATE INDEX idx_ubo_tenant ON beneficial_owners(tenant_id);
