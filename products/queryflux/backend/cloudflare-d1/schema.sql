-- Cloudflare D1 Database Schema for QueryFlux
-- Run these commands in the Cloudflare Dashboard or via wrangler

-- Connections table
CREATE TABLE IF NOT EXISTS connections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('postgresql', 'mysql', 'mongodb', 'sqlite', 'redis', 'supabase', 'neon', 'planetscale')),
  host TEXT NOT NULL,
  port INTEGER DEFAULT 5432,
  database TEXT DEFAULT '',
  username TEXT DEFAULT '',
  password TEXT DEFAULT '',
  ssl BOOLEAN DEFAULT false,
  description TEXT DEFAULT '',
  tags TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Queries table
CREATE TABLE IF NOT EXISTS queries (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL,
  name TEXT,
  query TEXT NOT NULL,
  database_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'error')),
  result TEXT,
  error_message TEXT,
  execution_time REAL DEFAULT 0,
  row_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
);

-- Query history (for analytics)
CREATE TABLE IF NOT EXISTS query_history (
  id TEXT PRIMARY KEY,
  query_id TEXT NOT NULL,
  user_id TEXT,
  execution_time REAL,
  result_size INTEGER,
  success BOOLEAN,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (query_id) REFERENCES queries(id) ON DELETE CASCADE
);

-- Saved queries
CREATE TABLE IF NOT EXISTS saved_queries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  query TEXT NOT NULL,
  tags TEXT DEFAULT '[]',
  is_public BOOLEAN DEFAULT false,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User settings
CREATE TABLE IF NOT EXISTS user_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  theme TEXT DEFAULT 'dark',
  language TEXT DEFAULT 'en',
  ai_provider TEXT DEFAULT 'ollama',
  ai_model TEXT DEFAULT 'llama3',
  preferences TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by TEXT NOT NULL,
  connections TEXT DEFAULT '[]',
  collaborators TEXT DEFAULT '[]',
  settings TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- AI conversations
CREATE TABLE IF NOT EXISTS ai_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,
  messages TEXT DEFAULT '[]',
  provider TEXT DEFAULT 'ollama',
  model TEXT DEFAULT 'llama3',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- API keys for integrations
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  permissions TEXT DEFAULT '[]',
  last_used DATETIME,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details TEXT DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_connections_user_id ON connections(created_by);
CREATE INDEX IF NOT EXISTS idx_connections_type ON connections(type);
CREATE INDEX IF NOT EXISTS idx_queries_connection_id ON queries(connection_id);
CREATE INDEX IF NOT EXISTS idx_queries_status ON queries(status);
CREATE INDEX IF NOT EXISTS idx_queries_created_at ON queries(created_at);
CREATE INDEX IF NOT EXISTS idx_query_history_user_id ON query_history(user_id);
CREATE INDEX IF NOT EXISTS idx_query_history_created_at ON query_history(created_at);
CREATE INDEX IF NOT EXISTS idx_saved_queries_created_by ON saved_queries(created_by);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- Insert sample data
INSERT OR IGNORE INTO connections (id, name, type, host, port, database, description) VALUES
('demo-postgres', 'Demo PostgreSQL', 'postgresql', 'demo.db.example.com', 5432, 'demo_db', 'Sample PostgreSQL connection for testing'),
('demo-mysql', 'Demo MySQL', 'mysql', 'demo.mysql.example.com', 3306, 'demo_db', 'Sample MySQL connection for testing');

INSERT OR IGNORE INTO saved_queries (id, name, description, query, created_by) VALUES
('sample-1', 'Get All Users', 'Retrieve all users from the database', 'SELECT * FROM users ORDER BY created_at DESC;', 'demo-user'),
('sample-2', 'User Count', 'Count total number of users', 'SELECT COUNT(*) as total_users FROM users;', 'demo-user'),
('sample-3', 'Recent Queries', 'Get recent query history', 'SELECT * FROM queries ORDER BY created_at DESC LIMIT 10;', 'demo-user');
