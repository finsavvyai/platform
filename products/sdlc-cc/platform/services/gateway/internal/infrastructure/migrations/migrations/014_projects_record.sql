-- Shared projects (Day 53) + session recording (Day 54). Both are
-- workspace-feature additions that the admin UI surfaces.

CREATE TABLE IF NOT EXISTS projects (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    name          TEXT NOT NULL,
    system_prompt TEXT,
    connector_ids UUID[] NOT NULL DEFAULT '{}',
    created_by    UUID,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_members (
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    user_id    UUID NOT NULL,
    role       TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
    PRIMARY KEY (project_id, user_id)
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS projects_isolation ON projects;
CREATE POLICY projects_isolation ON projects
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE TABLE IF NOT EXISTS session_recordings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    user_id     UUID NOT NULL,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at    TIMESTAMPTZ,
    consent_acknowledged BOOLEAN NOT NULL,
    storage_uri TEXT,                    -- s3://... encrypted blob
    -- Append-only — same enforcement as audit_logs.
    UNIQUE (id)
);

ALTER TABLE session_recordings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS session_recordings_isolation ON session_recordings;
CREATE POLICY session_recordings_isolation ON session_recordings
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sdlc_app') THEN
        REVOKE UPDATE, DELETE ON session_recordings FROM sdlc_app;
        GRANT INSERT, SELECT ON session_recordings TO sdlc_app;
    END IF;
END$$;
