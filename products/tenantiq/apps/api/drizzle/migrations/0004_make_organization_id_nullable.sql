-- Migration 0004: Make organization_id nullable for platform admins
-- On fresh DBs (0000 schema), organization_id is already nullable — skip table recreation.
-- Recreate indexes only.

CREATE INDEX IF NOT EXISTS idx_platform_users_organization ON platform_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_platform_users_role ON platform_users(role);
CREATE INDEX IF NOT EXISTS idx_platform_users_status ON platform_users(status);
CREATE INDEX IF NOT EXISTS idx_platform_users_azure_ad ON platform_users(azure_ad_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_users_email ON platform_users(email);
