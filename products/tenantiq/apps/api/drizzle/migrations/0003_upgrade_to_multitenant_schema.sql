-- Migration 0003: Multi-tenant schema upgrade
-- On fresh DBs (0000 creates full schema), organizations columns already exist.
-- Only add columns missing from initial schema + create indexes.

-- platform_users: columns not in initial schema
ALTER TABLE platform_users ADD COLUMN azure_ad_id TEXT;
ALTER TABLE platform_users ADD COLUMN phone TEXT;
ALTER TABLE platform_users ADD COLUMN language TEXT DEFAULT 'en';
ALTER TABLE platform_users ADD COLUMN notification_preferences TEXT;
ALTER TABLE platform_users ADD COLUMN preferences TEXT;

-- Organizations indexes (all use IF NOT EXISTS — safe to re-run)
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);
CREATE INDEX IF NOT EXISTS idx_organizations_subscription_tier ON organizations(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_organizations_azure_tenant ON organizations(azure_tenant_id);

-- Platform users indexes
CREATE INDEX IF NOT EXISTS idx_platform_users_organization ON platform_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_platform_users_role ON platform_users(role);
CREATE INDEX IF NOT EXISTS idx_platform_users_status ON platform_users(status);
CREATE INDEX IF NOT EXISTS idx_platform_users_azure_ad ON platform_users(azure_ad_id);
