-- Migration: 004_create_api_keys
-- Description: Create API keys table for programmatic access

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    key_prefix VARCHAR(12) NOT NULL,
    scopes TEXT[] NOT NULL DEFAULT '{}',
    rate_limit_rpm INTEGER,
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    last_used_ip INET,
    usage_count BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_keys_key_prefix ON api_keys(key_prefix) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_keys_tenant_id ON api_keys(tenant_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at) WHERE revoked_at IS NULL AND expires_at IS NOT NULL;

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_api_keys ON api_keys
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
