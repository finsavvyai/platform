-- Team projects table for shared codebases
CREATE TABLE IF NOT EXISTS team_projects (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    repository_url TEXT NOT NULL,
    language TEXT,
    settings TEXT, -- JSON object for project-specific settings
    indexed_at DATETIME,
    last_activity DATETIME,
    indexing_status TEXT DEFAULT 'pending' CHECK (indexing_status IN ('pending', 'indexing', 'indexed', 'failed')),
    files_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- Team knowledge base table
CREATE TABLE IF NOT EXISTS team_knowledge (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'document' CHECK (type IN ('document', 'code_snippet', 'api_doc', 'tutorial', 'faq', 'note')),
    tags TEXT, -- JSON array of tags
    category TEXT,
    vector_id TEXT, -- Reference to vector database entry
    created_by TEXT NOT NULL,
    updated_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- Team conversations for shared history
CREATE TABLE IF NOT EXISTS team_conversations (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    message TEXT NOT NULL,
    response TEXT NOT NULL,
    metadata TEXT, -- JSON object with query context, sources, etc.
    session_id TEXT,
    query_id TEXT, -- Reference to RAG query
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Team search history and analytics
CREATE TABLE IF NOT EXISTS team_search_history (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    query TEXT NOT NULL,
    search_type TEXT DEFAULT 'knowledge' CHECK (search_type IN ('knowledge', 'code', 'conversation', 'cross_team')),
    results_count INTEGER DEFAULT 0,
    response_time_ms INTEGER,
    sources TEXT, -- JSON array of source references
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Team shared documents and files
CREATE TABLE IF NOT EXISTS team_shared_documents (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    name TEXT NOT NULL,
    file_path TEXT,
    file_url TEXT,
    file_type TEXT,
    file_size INTEGER,
    content_preview TEXT,
    vector_id TEXT,
    uploaded_by TEXT NOT NULL,
    tags TEXT, -- JSON array of tags
    metadata TEXT, -- JSON object with additional file metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- Team collaboration sessions
CREATE TABLE IF NOT EXISTS team_collaboration_sessions (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    session_name TEXT,
    host_user_id TEXT NOT NULL,
    participants TEXT, -- JSON array of participant user IDs
    session_type TEXT DEFAULT 'rag_query' CHECK (session_type IN ('rag_query', 'code_review', 'brainstorm', 'planning')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ended', 'paused')),
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    metadata TEXT, -- JSON object with session settings
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (host_user_id) REFERENCES users(id)
);

-- Update team settings to include project limits
ALTER TABLE team_settings ADD COLUMN max_projects INTEGER DEFAULT 10;
ALTER TABLE team_settings ADD COLUMN knowledge_sharing BOOLEAN DEFAULT true;
ALTER TABLE team_settings ADD COLUMN conversation_sharing BOOLEAN DEFAULT false;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_projects_team_id ON team_projects(team_id);
CREATE INDEX IF NOT EXISTS idx_team_projects_language ON team_projects(language);
CREATE INDEX IF NOT EXISTS idx_team_projects_indexing_status ON team_projects(indexing_status);
CREATE INDEX IF NOT EXISTS idx_team_projects_indexed_at ON team_projects(indexed_at);

CREATE INDEX IF NOT EXISTS idx_team_knowledge_team_id ON team_knowledge(team_id);
CREATE INDEX IF NOT EXISTS idx_team_knowledge_type ON team_knowledge(type);
CREATE INDEX IF NOT EXISTS idx_team_knowledge_category ON team_knowledge(category);
CREATE INDEX IF NOT EXISTS idx_team_knowledge_created_by ON team_knowledge(created_by);
CREATE INDEX IF NOT EXISTS idx_team_knowledge_vector_id ON team_knowledge(vector_id);

CREATE INDEX IF NOT EXISTS idx_team_conversations_team_id ON team_conversations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_conversations_user_id ON team_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_team_conversations_session_id ON team_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_team_conversations_created_at ON team_conversations(created_at);

CREATE INDEX IF NOT EXISTS idx_team_search_history_team_id ON team_search_history(team_id);
CREATE INDEX IF NOT EXISTS idx_team_search_history_user_id ON team_search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_team_search_history_search_type ON team_search_history(search_type);
CREATE INDEX IF NOT EXISTS idx_team_search_history_created_at ON team_search_history(created_at);

CREATE INDEX IF NOT EXISTS idx_team_shared_documents_team_id ON team_shared_documents(team_id);
CREATE INDEX IF NOT EXISTS idx_team_shared_documents_uploaded_by ON team_shared_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_team_shared_documents_file_type ON team_shared_documents(file_type);
CREATE INDEX IF NOT EXISTS idx_team_shared_documents_vector_id ON team_shared_documents(vector_id);

CREATE INDEX IF NOT EXISTS idx_team_collaboration_sessions_team_id ON team_collaboration_sessions(team_id);
CREATE INDEX IF NOT EXISTS idx_team_collaboration_sessions_host_user_id ON team_collaboration_sessions(host_user_id);
CREATE INDEX IF NOT EXISTS idx_team_collaboration_sessions_status ON team_collaboration_sessions(status);
CREATE INDEX IF NOT EXISTS idx_team_collaboration_sessions_started_at ON team_collaboration_sessions(started_at);

-- Full-text search indexes (if supported)
-- Note: Cloudflare D1 supports FTS5
CREATE VIRTUAL TABLE IF NOT EXISTS team_knowledge_fts USING fts5(
    title,
    content,
    tags,
    content='team_knowledge',
    content_rowid='rowid'
);

CREATE VIRTUAL TABLE IF NOT EXISTS team_conversations_fts USING fts5(
    message,
    response,
    content='team_conversations',
    content_rowid='rowid'
);

-- Triggers to maintain FTS indexes
CREATE TRIGGER IF NOT EXISTS team_knowledge_fts_insert AFTER INSERT ON team_knowledge BEGIN
    INSERT INTO team_knowledge_fts(rowid, title, content, tags)
    VALUES (new.id, new.title, new.content, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS team_knowledge_fts_update AFTER UPDATE ON team_knowledge BEGIN
    UPDATE team_knowledge_fts SET
        title = new.title,
        content = new.content,
        tags = new.tags
    WHERE rowid = new.id;
END;

CREATE TRIGGER IF NOT EXISTS team_knowledge_fts_delete AFTER DELETE ON team_knowledge BEGIN
    DELETE FROM team_knowledge_fts WHERE rowid = old.id;
END;

CREATE TRIGGER IF NOT EXISTS team_conversations_fts_insert AFTER INSERT ON team_conversations BEGIN
    INSERT INTO team_conversations_fts(rowid, message, response)
    VALUES (new.id, new.message, new.response);
END;

CREATE TRIGGER IF NOT EXISTS team_conversations_fts_update AFTER UPDATE ON team_conversations BEGIN
    UPDATE team_conversations_fts SET
        message = new.message,
        response = new.response
    WHERE rowid = new.id;
END;

CREATE TRIGGER IF NOT EXISTS team_conversations_fts_delete AFTER DELETE ON team_conversations BEGIN
    DELETE FROM team_conversations_fts WHERE rowid = old.id;
END;