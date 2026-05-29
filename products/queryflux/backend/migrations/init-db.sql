-- Initialize QueryFlux development database

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS database_connections (
    id VARCHAR(50) PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- postgresql, mysql, mongodb, etc.
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL,
    database_name VARCHAR(255) NOT NULL,
    username VARCHAR(255),
    encrypted_password TEXT,
    ssl_enabled BOOLEAN DEFAULT false,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS query_history (
    id SERIAL PRIMARY KEY,
    database_id VARCHAR(50) REFERENCES database_connections(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    sql_query TEXT NOT NULL,
    execution_time_ms NUMERIC(10, 2),
    rows_affected INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_agent_sessions (
    id SERIAL PRIMARY KEY,
    agent_id VARCHAR(255) NOT NULL,
    agent_type VARCHAR(50), -- claude, cursor, copilot, etc.
    database_id VARCHAR(50) REFERENCES database_connections(id) ON DELETE CASCADE,
    queries_executed INTEGER DEFAULT 0,
    time_saved_seconds INTEGER DEFAULT 0,
    errors_prevented INTEGER DEFAULT 0,
    reputation_score INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_db_connections_user_id ON database_connections(user_id);
CREATE INDEX idx_query_history_database_id ON query_history(database_id);
CREATE INDEX idx_query_history_user_id ON query_history(user_id);
CREATE INDEX idx_query_history_executed_at ON query_history(executed_at DESC);
CREATE INDEX idx_ai_agent_sessions_agent_id ON ai_agent_sessions(agent_id);
CREATE INDEX idx_ai_agent_sessions_database_id ON ai_agent_sessions(database_id);

-- Insert sample data
INSERT INTO users (email, name) VALUES
    ('demo@queryflux.dev', 'Demo User'),
    ('ai-agent@queryflux.dev', 'AI Agent Test User');

INSERT INTO database_connections (id, user_id, name, type, host, port, database_name, username, status) VALUES
    ('db-1', 1, 'Local PostgreSQL', 'postgresql', 'localhost', 5432, 'queryflux_dev', 'queryflux', 'active');

-- Sample query history
INSERT INTO query_history (database_id, user_id, sql_query, execution_time_ms, rows_affected, success) VALUES
    ('db-1', 1, 'SELECT * FROM users LIMIT 10', 12.5, 2, true),
    ('db-1', 1, 'SELECT COUNT(*) FROM users', 8.3, 1, true);

-- Sample AI agent session
INSERT INTO ai_agent_sessions (agent_id, agent_type, database_id, queries_executed, time_saved_seconds, reputation_score) VALUES
    ('claude-desktop-xyz', 'claude', 'db-1', 47, 1420, 847);

COMMENT ON TABLE users IS 'User accounts for QueryFlux';
COMMENT ON TABLE database_connections IS 'Database connections managed by users';
COMMENT ON TABLE query_history IS 'Audit log of all executed queries';
COMMENT ON TABLE ai_agent_sessions IS 'AI agent activity tracking for reputation system';
