-- Teams table for team management
CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    owner_id TEXT NOT NULL,
    settings TEXT, -- JSON object for team preferences
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Team members table for role-based access
CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    status TEXT DEFAULT 'invited' CHECK (status IN ('invited', 'joined', 'left', 'removed')),
    invited_by TEXT,
    invited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    joined_at DATETIME,
    left_at DATETIME,
    permissions TEXT, -- JSON object for granular permissions
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id)
);

-- Team audit log for activity tracking
CREATE TABLE IF NOT EXISTS team_audit_log (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    user_id TEXT,
    action TEXT NOT NULL, -- 'created', 'updated', 'deleted', 'invited', 'joined', 'left', 'role_changed'
    target_id TEXT, -- ID of affected entity (user_id, team_id, etc.)
    details TEXT, -- JSON object with additional context
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Team settings for shared workspaces
CREATE TABLE IF NOT EXISTS team_settings (
    team_id TEXT PRIMARY KEY,
    rag_sharing BOOLEAN DEFAULT true,
    codebase_sharing BOOLEAN DEFAULT true,
    conversation_sharing BOOLEAN DEFAULT false,
    analytics_sharing BOOLEAN DEFAULT true,
    default_permissions TEXT DEFAULT '{"create":true,"read":true,"update":false,"delete":false}',
    invitation_expiry_hours INTEGER DEFAULT 168, -- 7 days
    max_members INTEGER DEFAULT 50,
    storage_limit_mb INTEGER DEFAULT 1000,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- Team projects for shared codebases
CREATE TABLE IF NOT EXISTS team_projects (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    repository_url TEXT,
    language TEXT,
    settings TEXT, -- JSON object for project-specific settings
    indexed_at DATETIME,
    last_activity DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_teams_owner_id ON teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_teams_name ON teams(name);
CREATE INDEX IF NOT EXISTS idx_teams_created_at ON teams(created_at);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(role);
CREATE INDEX IF NOT EXISTS idx_team_members_status ON team_members(status);

CREATE INDEX IF NOT EXISTS idx_team_audit_log_team_id ON team_audit_log(team_id);
CREATE INDEX IF NOT EXISTS idx_team_audit_log_user_id ON team_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_team_audit_log_action ON team_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_team_audit_log_created_at ON team_audit_log(created_at);

CREATE INDEX IF NOT EXISTS idx_team_projects_team_id ON team_projects(team_id);
CREATE INDEX IF NOT EXISTS idx_team_projects_language ON team_projects(language);

-- Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_unique ON team_members(team_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_settings_unique ON team_settings(team_id);