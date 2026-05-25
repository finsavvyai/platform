-- Fine-grained RBAC tables. Permission strings follow the
-- `resource:action[:scope]` convention (e.g. `audit:read:tenant`,
-- `rate_limit:write`).
--
-- Day 21 of the production-ready roadmap.

CREATE TABLE IF NOT EXISTS permissions (
    id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name   TEXT NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE IF NOT EXISTS roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID, -- null = global role (e.g. super_admin)
    name        TEXT NOT NULL,
    description TEXT,
    is_system   BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id       UUID NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions (id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id    UUID NOT NULL,
    role_id    UUID NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
    granted_by UUID,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions (role_id);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS roles_tenant_isolation ON roles;
CREATE POLICY roles_tenant_isolation ON roles
    USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true)::uuid);

INSERT INTO permissions (name, description) VALUES
    ('audit:read', 'Read audit log entries'),
    ('audit:read:tenant', 'Read audit log entries for own tenant'),
    ('rate_limit:read', 'View tenant rate-limit rules'),
    ('rate_limit:write', 'Modify tenant rate-limit rules'),
    ('api_key:read', 'List tenant API keys'),
    ('api_key:write', 'Issue, rotate, revoke API keys'),
    ('user:read', 'List tenant users'),
    ('user:write', 'Create, update, delete tenant users'),
    ('policy:read', 'View tenant policies'),
    ('policy:write', 'Create, update, delete policies'),
    ('connector:install', 'Install connectors for own tenant'),
    ('billing:read', 'View billing + usage data'),
    ('billing:write', 'Modify billing settings')
ON CONFLICT (name) DO NOTHING;
