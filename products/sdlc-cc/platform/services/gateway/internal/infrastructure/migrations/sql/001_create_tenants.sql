-- Migration: 001_create_tenants
-- Description: Create tenants table with multi-tenancy support

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    plan VARCHAR(50) NOT NULL DEFAULT 'free',
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    settings JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    max_users INTEGER NOT NULL DEFAULT 5,
    max_documents INTEGER NOT NULL DEFAULT 100,
    max_storage_bytes BIGINT NOT NULL DEFAULT 1073741824,
    rate_limit_rpm INTEGER NOT NULL DEFAULT 60,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_tenants_slug ON tenants(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_tenants_status ON tenants(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tenants_plan ON tenants(plan) WHERE deleted_at IS NULL;
CREATE INDEX idx_tenants_created_at ON tenants(created_at);

-- Row-level security
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
