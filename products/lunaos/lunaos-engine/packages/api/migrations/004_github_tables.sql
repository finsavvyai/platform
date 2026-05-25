-- GitHub Integration Tables
-- Stores OAuth connections and indexed repo tracking

CREATE TABLE IF NOT EXISTS github_connections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    github_username TEXT NOT NULL,
    github_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    scopes TEXT DEFAULT 'read:user,repo',
    connected_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS indexed_repos (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    repo_full_name TEXT NOT NULL,
    file_count INTEGER DEFAULT 0,
    indexed_at TEXT NOT NULL,
    UNIQUE(user_id, repo_full_name),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_github_connections_user ON github_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_indexed_repos_user ON indexed_repos(user_id);
CREATE INDEX IF NOT EXISTS idx_indexed_repos_name ON indexed_repos(repo_full_name);
