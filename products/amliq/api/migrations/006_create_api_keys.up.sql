CREATE TABLE api_keys (
    id VARCHAR(20) PRIMARY KEY,
    tenant_id VARCHAR(20) NOT NULL REFERENCES tenants(id),
    key_hash VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    permissions TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX idx_api_keys_enabled ON api_keys(enabled);
