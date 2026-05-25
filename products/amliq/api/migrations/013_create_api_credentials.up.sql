CREATE TABLE api_credentials (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    product TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    hashed_key TEXT NOT NULL UNIQUE,
    scopes JSONB NOT NULL DEFAULT '[]',
    ip_allowlist JSONB NOT NULL DEFAULT '[]',
    rate_limit INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_credentials_tenant_product ON api_credentials(tenant_id, product);
CREATE INDEX idx_api_credentials_hashed_key ON api_credentials(hashed_key);
