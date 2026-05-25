-- Team search history table for analytics
CREATE TABLE IF NOT EXISTS team_search_history (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    query TEXT NOT NULL,
    search_type TEXT DEFAULT 'knowledge' CHECK (search_type IN ('knowledge', 'code', 'conversation', 'cross_team', 'project')),
    results_count INTEGER DEFAULT 0,
    response_time_ms INTEGER,
    sources TEXT, -- JSON array of source references with scores
    context_used TEXT, -- JSON object with context information
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Team search history indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_search_history_team_id ON team_search_history(team_id);
CREATE INDEX IF NOT EXISTS idx_team_search_history_user_id ON team_search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_team_search_history_search_type ON team_search_history(search_type);
CREATE INDEX IF NOT EXISTS idx_team_search_history_created_at ON team_search_history(created_at);
CREATE INDEX IF NOT EXISTS idx_team_search_history_response_time ON team_search_history(response_time_ms);

-- Team collaboration sessions table
CREATE TABLE IF NOT EXISTS team_collaboration_sessions (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    session_name TEXT,
    host_user_id TEXT NOT NULL,
    participants TEXT, -- JSON array of participant user IDs
    session_type TEXT DEFAULT 'rag_query' CHECK (session_type IN ('rag_query', 'code_review', 'brainstorm', 'planning', 'debugging')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ended', 'paused', 'cancelled')),
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    metadata TEXT, -- JSON object with session settings and outcomes
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (host_user_id) REFERENCES users(id)
);

-- Team collaboration sessions indexes
CREATE INDEX IF NOT EXISTS idx_team_collaboration_sessions_team_id ON team_collaboration_sessions(team_id);
CREATE INDEX IF NOT EXISTS idx_team_collaboration_sessions_host_user_id ON team_collaboration_sessions(host_user_id);
CREATE INDEX IF NOT EXISTS idx_team_collaboration_sessions_status ON team_collaboration_sessions(status);
CREATE INDEX IF NOT EXISTS idx_team_collaboration_sessions_session_type ON team_collaboration_sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_team_collaboraboration_sessions_started_at ON team_collaboration_sessions(started_at);

-- Team shared documents table
CREATE TABLE IF NOT EXISTS team_shared_documents (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    name TEXT NOT NULL,
    file_path TEXT,
    file_url TEXT,
    file_type TEXT,
    file_size INTEGER,
    content_preview TEXT,
    vector_id TEXT, -- Reference to vector database entry
    uploaded_by TEXT NOT NULL,
    tags TEXT, -- JSON array of tags
    metadata TEXT, -- JSON object with additional file metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- Team shared documents indexes
CREATE INDEX IF NOT EXISTS idx_team_shared_documents_team_id ON team_shared_documents(team_id);
CREATE INDEX IF NOT EXISTS idx_team_shared_documents_uploaded_by ON team_shared_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_team_shared_documents_file_type ON team_shared_documents(file_type);
CREATE INDEX IF NOT EXISTS idx_team_shared_documents_vector_id ON team_shared_documents(vector_id);

-- Team performance metrics table
CREATE TABLE IF NOT EXISTS team_performance_metrics (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    metric_type TEXT NOT NULL, -- 'query', 'indexing', 'search', 'export', etc.
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    metric_unit TEXT, -- 'ms', 'bytes', 'count', 'percentage', etc.
    metadata TEXT, -- JSON object with additional context
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- Team performance metrics indexes
CREATE INDEX IF NOT EXISTS idx_team_performance_metrics_team_id ON team_performance_metrics(team_id);
CREATE INDEX IF NOT EXISTS idx_team_performance_metrics_type ON team_performance_metrics(metric_type);
CREATE IF NOT EXISTS idx_team_performance_metrics_created_at ON team_performance_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_team_performance_metrics_name ON team_performance_metrics(metric_name);

-- Team error tracking table
CREATE TABLE IF NOT EXISTS team_error_tracking (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    user_id TEXT,
    error_type TEXT NOT NULL, -- 'query', 'indexing', 'authentication', etc.
    error_code TEXT,
    error_message TEXT,
    error_details TEXT, -- JSON object with stack trace, context, etc.
    request_data TEXT, -- JSON object with request details
    user_agent TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    resolution_details TEXT,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Team error tracking indexes
CREATE INDEX IF NOT EXISTS idx_team_error_tracking_team_id ON team_error_tracking(team_id);
CREATE INDEX IF NOT EXISTS idx_team_error_tracking_user_id ON team_error_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_team_error_tracking_error_type ON team_error_tracking(error_type);
CREATE IF NOT EXISTS idx_team_error_tracking_created_at ON team_error_tracking(created_at);
CREATE INDEX IF NOT EXISTS idx_team_error_tracking_resolved_at ON team_error_tracking(resolved_at);

-- Team usage snapshots for historical comparisons
CREATE TABLE IF NOT EXISTS team_usage_snapshots (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    snapshot_date DATE NOT NULL,
    total_members INTEGER DEFAULT 0,
    active_members INTEGER DEFAULT 0,
    total_projects INTEGER DEFAULT 0,
    indexed_projects INTEGER DEFAULT 0,
    total_queries INTEGER DEFAULT 0,
    total_knowledge_entries INTEGER DEFAULT 0,
    storage_used_kb INTEGER DEFAULT 0,
    avg_response_time_ms INTEGER DEFAULT 0,
    features_enabled TEXT, -- JSON array of enabled features
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- Team usage snapshots indexes
CREATE INDEX IF NOT EXISTS idx_team_usage_snapshots_team_id ON team_usage_snapshots(team_id);
CREATE IF NOT EXISTS idx_team_usage_snapshots_snapshot_date ON team_usage_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_team_usage_snapshots_created_at ON team_usage_snapshots(created_at);

-- Create views for common analytics queries
CREATE VIEW IF NOT EXISTS team_analytics_summary AS
SELECT
    t.id as team_id,
    t.name as team_name,
    t.created_at as team_created_at,
    COUNT(DISTINCT tm.user_id) as total_members,
    COUNT(DISTINCT CASE WHEN tm.status = 'joined' THEN tm.user_id END) as active_members,
    COUNT(DISTINCT tp.id) as total_projects,
    COUNT(DISTINCT CASE WHEN tp.indexed_at IS NOT NULL THEN tp.id END) as indexed_projects,
    COALESCE(us.total_queries, 0) as total_queries,
    COALESCE(uk.total_entries, 0) as total_knowledge_entries
FROM
    teams t
    LEFT JOIN team_members tm ON t.id = tm.team_id
    LEFT JOIN team_projects tp ON t.id = tp.team_id
    LEFT JOIN (
        SELECT team_id, COUNT(*) as total_entries
        FROM team_knowledge
        GROUP BY team_id
    ) uk ON t.id = uk.team_id
    LEFT JOIN (
        SELECT team_id, COUNT(*) as total_queries
        FROM team_audit_log
        WHERE action = 'rag_query'
        GROUP BY team_id
    ) us ON t.id = us.team_id
GROUP BY t.id, t.name, t.created_at;

-- Create view for member performance ranking
CREATE VIEW IF NOT EXISTS member_performance_ranking AS
SELECT
    tm.team_id,
    tm.user_id,
    u.email,
    tm.role,
    COALESCE(qs.total_queries, 0) as query_count,
    COALESCE(kc.contribution_count, 0) as knowledge_contributions,
    COALESCE(ps.indexed_projects, 0) as projects_indexed,
    COALESCE(cs.session_count, 0) as collaboration_sessions,
    COALESCE(qs.last_active, tm.joined_at) as last_active,
    (
        (COALESCE(qs.total_queries, 0) * 2) +
        (COALESCE(kc.contribution_count, 0) * 5) +
        (COALESCE(ps.indexed_projects, 0) * 10) +
        (COALESCE(cs.session_count, 0) * 3)
    ) as activity_score
FROM
    team_members tm
    JOIN users u ON tm.user_id = u.id
    LEFT JOIN (
        SELECT user_id, COUNT(*) as total_queries, MAX(created_at) as last_active
        FROM team_audit_log
        WHERE action = 'rag_query'
        GROUP BY user_id
    ) qs ON tm.user_id = qs.user_id
    LEFT JOIN (
        SELECT created_by, COUNT(*) as contribution_count
        FROM team_knowledge
        GROUP BY created_by
    ) kc ON tm.user_id = kc.created_by
    LEFT JOIN (
        SELECT created_by, COUNT(*) as indexed_projects
        FROM team_projects
        WHERE indexed_at IS NOT NULL
        GROUP BY created_by
    ) ps ON tm.user_id = ps.created_by
    LEFT JOIN (
        SELECT host_user_id, COUNT(*) as session_count
        FROM team_collaboration_sessions
        WHERE status = 'ended'
        GROUP BY host_user_id
    ) cs ON tm.user_id = cs.host_user_id
WHERE tm.status = 'joined'
ORDER BY activity_score DESC;

-- Add indexes for the views if needed (for performance)
CREATE INDEX IF NOT EXISTS idx_member_performance_ranking_team_id ON member_performance_ranking(team_id);
CREATE INDEX IF NOT EXISTS idx_member_performance_ranking_activity_score ON member_performance_ranking(activity_score);

-- Triggers to maintain data consistency
CREATE TRIGGER IF NOT EXISTS update_usage_snapshot AFTER INSERT ON team_projects BEGIN
    INSERT OR REPLACE INTO team_usage_snapshots (
        team_id,
        snapshot_date,
        total_members,
        active_members,
        total_projects,
        indexed_projects,
        total_queries,
        total_knowledge_entries,
        storage_used_kb,
        avg_response_time_ms,
        features_enabled
    )
    SELECT
        NEW.team_id,
        DATE('now'),
        (SELECT COUNT(*) FROM team_members WHERE team_id = NEW.team_id AND status = 'joined'),
        (SELECT COUNT(*) FROM team_members WHERE team_id = NEW.team_id AND status = 'joined' AND last_activity >= DATE('now', '-7 days')),
        (SELECT COUNT(*) FROM team_projects WHERE team_id = NEW.team_id),
        (SELECT COUNT(*) FROM team_projects WHERE team_id = NEW.team_id AND indexed_at IS NOT NULL),
        (SELECT COALESCE(SUM(total_queries), 0) FROM team_usage_snapshots WHERE team_id = NEW.team_id AND snapshot_date = DATE('now', '-1 day')),
        (SELECT COALESCE(SUM(total_knowledge_entries), 0) FROM team_usage_snapshots WHERE team_id = NEW.team_id AND snapshot_date = DATE('now', '-1 day')),
        (SELECT COALESCE(SUM(storage_used_kb), 0) FROM team_usage_snapshots WHERE team_id = NEW.team_id AND snapshot_date = DATE('now', '-1 day')),
        (SELECT COALESCE(AVG(avg_response_time_ms), 0) FROM team_performance_metrics WHERE team_id = NEW.team_id AND metric_type = 'query' AND created_at >= DATE('now', '-7 days')),
        '["team_projects"]'::json
    FROM team_projects tp
    WHERE tp.id = NEW.team_id
    ON CONFLICT(team_id, snapshot_date) DO UPDATE SET
        total_projects = excluded.total_projects + 1,
        indexed_projects = excluded.indexed_projects + (CASE WHEN NEW.indexed_at IS NOT NULL THEN 1 ELSE 0 END);
END;

CREATE TRIGGER IF NOT EXISTS update_usage_snapshot_after_knowledge AFTER INSERT ON team_knowledge BEGIN
    INSERT OR REPLACE INTO team_usage_snapshots (
        team_id,
        snapshot_date,
        total_members,
        active_members,
        total_projects,
        indexed_projects,
        total_queries,
        total_knowledge_entries,
        storage_used_kb,
        avg_response_time_ms,
        features_enabled
    )
    SELECT
        NEW.team_id,
        DATE('now'),
        (SELECT COUNT(*) FROM team_members WHERE team_id = NEW.team_id AND status = 'joined'),
        (SELECT COUNT(*) FROM team_members WHERE team_id = NEW.team_id AND status = 'joined' AND last_activity >= DATE('now', '-7 days')),
        (SELECT COUNT(*) FROM team_projects WHERE team_id = NEW.team_id),
        (SELECT COUNT(*) FROM team_projects WHERE team_id = NEW.team_id AND indexed_at IS NOT NULL),
        (SELECT COALESCE(SUM(total_queries), 0) FROM team_usage_snapshots WHERE team_id = NEW.team_id AND snapshot_date = DATE('now', '-1 day')),
        (SELECT COALESCE(SUM(total_knowledge_entries), 0) FROM team_usage_snapshots WHERE team_id = NEW.team_id AND snapshot_date = DATE('now', '-1 day')) + 1,
        (SELECT COALESCE(SUM(storage_used_kb), 0) FROM team_usage_snapshots WHERE team_id = NEW.team_id AND snapshot_date = DATE('now', '-1 day')) + FLOOR(LENGTH(NEW.content) / 1024),
        (SELECT COALESCE(AVG(avg_response_time_ms), 0) FROM team_performance_metrics WHERE team_id = NEW.team_id AND metric_type = 'query' AND created_at >= DATE('now', '-7 days')),
        '["team_knowledge"]'::json
    FROM team_knowledge tk
    WHERE tk.id = NEW.team_id
    ON CONFLICT(team_id, snapshot_date) DO UPDATE SET
        total_knowledge_entries = excluded.total_knowledge_entries + 1,
        storage_used_kb = excluded.storage_used_kb + FLOOR(LENGTH(NEW.content) / 1024);
END;