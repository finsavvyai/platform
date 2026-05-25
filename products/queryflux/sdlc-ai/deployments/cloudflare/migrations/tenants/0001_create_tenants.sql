-- Tenants Table
-- Core tenant information for multi-tenancy support
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    config TEXT NOT NULL DEFAULT '{}',
    settings TEXT NOT NULL DEFAULT '{}',
    subscription_tier TEXT NOT NULL DEFAULT 'basic',
    data_region TEXT NOT NULL DEFAULT 'us-east-1',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    metadata TEXT NOT NULL DEFAULT '{}'
);

-- Create indexes for tenant lookups
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON tenants(domain);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_subscription_tier ON tenants(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_tenants_data_region ON tenants(data_region);
CREATE INDEX IF NOT EXISTS idx_tenants_created_at ON tenants(created_at);

-- Insert default system tenant
INSERT OR IGNORE INTO tenants (
    id,
    name,
    domain,
    status,
    subscription_tier,
    data_region,
    config,
    settings
) VALUES (
    'system-tenant',
    'System Tenant',
    'system.sdlc.ai',
    'active',
    'enterprise',
    'us-east-1',
    '{"max_users": 1000, "max_documents": 1000000, "max_storage_gb": 1000}',
    '{"auto_approve_policies": false, "require_mfa": true, "audit_retention_days": 365}'
);
