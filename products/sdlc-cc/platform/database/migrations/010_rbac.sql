-- migration: 010_rbac.sql
-- Role-Based Access Control tables for the gateway's RBAC evaluator.
-- See services/gateway/internal/domain/rbac/evaluator.go for the
-- canonical permission grammar (`resource:action[:scope]`, with `*`
-- as a wildcard slot).
--
-- Day 22 of the production-ready roadmap.

CREATE TABLE IF NOT EXISTS roles (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID        NOT NULL,
    name        TEXT        NOT NULL,
    description TEXT        NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT roles_tenant_name_uniq UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_roles_tenant_id ON roles (tenant_id);

CREATE TABLE IF NOT EXISTS permissions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL UNIQUE,
    description TEXT        NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id       UUID NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions (id) ON DELETE CASCADE,
    granted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id
    ON role_permissions (permission_id);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id    UUID NOT NULL,
    role_id    UUID NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
    tenant_id  UUID NOT NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_tenant
    ON user_roles (user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id
    ON user_roles (role_id);

-- updated_at trigger for roles
CREATE OR REPLACE FUNCTION roles_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS roles_updated_at ON roles;
CREATE TRIGGER roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION roles_set_updated_at();

-- Seed the canonical permission catalogue. The grammar is
-- `resource:action[:scope]`. `*` is allowed in any slot in granted
-- permissions but never seeded as a permission name.
INSERT INTO permissions (name, description) VALUES
    -- Audit log
    ('audit:read',                       'Read tenant audit logs'),
    ('audit:read:tenant',                'Read audit logs scoped to own tenant'),
    ('audit:export',                     'Export audit logs'),
    -- Users
    ('users:read',                       'List + read users'),
    ('users:write',                      'Create / update users'),
    ('users:delete',                     'Delete users'),
    -- Tenants
    ('tenants:read',                     'Read tenant metadata'),
    ('tenants:write',                    'Update tenant settings'),
    ('tenants:delete',                   'Delete a tenant (super_admin only)'),
    -- Documents
    ('documents:read',                   'Read documents'),
    ('documents:write',                  'Upload / update documents'),
    ('documents:delete',                 'Delete documents'),
    -- Policies
    ('policies:read',                    'Read policy definitions'),
    ('policies:write',                   'Author / update policies'),
    ('policies:deploy',                  'Deploy policies to production'),
    -- DLP
    ('dlp:read',                         'Read DLP rules + violations'),
    ('dlp:write',                        'Author DLP rules'),
    -- API keys
    ('api_keys:read',                    'List API keys'),
    ('api_keys:write',                   'Create / rotate API keys'),
    ('api_keys:delete',                  'Revoke API keys'),
    -- LLM gateway
    ('llm:invoke',                       'Send prompts via the LLM gateway'),
    ('llm:configure',                    'Configure LLM providers'),
    -- Roles + permissions admin
    ('roles:read',                       'Read role + permission catalogue'),
    ('roles:write',                      'Create / update roles + grants')
ON CONFLICT (name) DO NOTHING;
