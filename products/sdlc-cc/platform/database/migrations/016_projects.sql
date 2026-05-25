-- migration: 016_projects.sql
-- Day 53 — Shared Projects.
--
-- A project is a tenant-scoped collaboration unit: shared system
-- prompt, member roster (owner/editor/viewer), and a list of
-- attached connectors. RLS ensures tenants only ever see their own.

CREATE TABLE IF NOT EXISTS projects (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID        NOT NULL,
    name            TEXT        NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
    description     TEXT        NOT NULL DEFAULT '',
    system_prompt   TEXT        NOT NULL DEFAULT '',
    created_by      UUID        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT projects_tenant_name_uniq UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_projects_tenant_id ON projects (tenant_id);

CREATE TABLE IF NOT EXISTS project_members (
    project_id      UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL,
    role            TEXT        NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
    added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members (user_id);

CREATE TABLE IF NOT EXISTS project_connectors (
    project_id      UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    connector_id    UUID        NOT NULL,
    PRIMARY KEY (project_id, connector_id)
);

-- updated_at trigger.
CREATE OR REPLACE FUNCTION projects_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_updated_at ON projects;
CREATE TRIGGER projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION projects_set_updated_at();

-- RLS: enforce tenant isolation. The session sets app.current_tenant
-- via SET LOCAL on every connection (see middleware/tenant.go).
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_connectors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projects_tenant_isolation ON projects;
CREATE POLICY projects_tenant_isolation ON projects
    USING (tenant_id::text = current_setting('app.current_tenant', true));

DROP POLICY IF EXISTS project_members_tenant_isolation ON project_members;
CREATE POLICY project_members_tenant_isolation ON project_members
    USING (project_id IN (
        SELECT id FROM projects
        WHERE tenant_id::text = current_setting('app.current_tenant', true)
    ));

DROP POLICY IF EXISTS project_connectors_tenant_isolation ON project_connectors;
CREATE POLICY project_connectors_tenant_isolation ON project_connectors
    USING (project_id IN (
        SELECT id FROM projects
        WHERE tenant_id::text = current_setting('app.current_tenant', true)
    ));
