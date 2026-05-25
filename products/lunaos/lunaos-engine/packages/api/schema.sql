-- RAG System Database Schema for Cloudflare D1
-- Optimized for Cloudflare Workers with SQLite

-- Documents table for storing processed documents
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  file_path TEXT NOT NULL,
  metadata TEXT, -- JSON metadata
  embedding_id TEXT, -- Reference to external vector DB
  storage_key TEXT, -- R2 storage key for large content
  environment TEXT NOT NULL DEFAULT 'development',
  document_type TEXT DEFAULT 'unknown',
  language TEXT DEFAULT 'en',
  word_count INTEGER DEFAULT 0,
  chunk_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  indexed_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Document chunks for better search granularity
CREATE TABLE IF NOT EXISTS document_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding_id TEXT,
  start_position INTEGER DEFAULT 0,
  end_position INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Conversation history for context tracking
CREATE TABLE IF NOT EXISTS conversation_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  context TEXT, -- JSON context used
  sources TEXT, -- JSON sources referenced
  environment TEXT NOT NULL DEFAULT 'development',
  user_id TEXT,
  metadata TEXT, -- Additional metadata
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Query logs for analytics and monitoring
CREATE TABLE IF NOT EXISTS query_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  response_time INTEGER, -- Response time in milliseconds
  document_count INTEGER DEFAULT 0,
  context_length INTEGER DEFAULT 0,
  environment TEXT NOT NULL DEFAULT 'development',
  user_id TEXT,
  session_id TEXT,
  cache_hit BOOLEAN DEFAULT FALSE,
  sources_found INTEGER DEFAULT 0,
  confidence_score REAL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexing jobs for background processing tracking
CREATE TABLE IF NOT EXISTS indexing_jobs (
  id TEXT PRIMARY KEY,
  repository_path TEXT NOT NULL,
  file_patterns TEXT, -- JSON array of patterns
  exclude_patterns TEXT, -- JSON array of patterns
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  result TEXT, -- JSON result
  error_message TEXT,
  total_files INTEGER DEFAULT 0,
  processed_files INTEGER DEFAULT 0,
  failed_files INTEGER DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Document metadata for quick lookups
CREATE TABLE IF NOT EXISTS document_metadata (
  document_id TEXT PRIMARY KEY,
  file_size INTEGER DEFAULT 0,
  file_type TEXT,
  programming_language TEXT,
  framework TEXT,
  last_modified TEXT,
  author TEXT,
  commit_hash TEXT,
  branch TEXT,
  tags TEXT, -- JSON array of tags
  custom_fields TEXT, -- JSON object for custom metadata
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- User sessions for context tracking
CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT UNIQUE NOT NULL,
  user_id TEXT,
  environment TEXT NOT NULL DEFAULT 'development',
  metadata TEXT, -- JSON metadata
  last_activity TEXT DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Search cache for performance optimization
CREATE TABLE IF NOT EXISTS search_cache (
  query_hash TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  results TEXT NOT NULL, -- JSON results
  response_time INTEGER,
  hit_count INTEGER DEFAULT 0,
  last_accessed TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'development',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- System metrics and statistics
CREATE TABLE IF NOT EXISTS system_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  environment TEXT NOT NULL DEFAULT 'development',
  metadata TEXT, -- JSON metadata
  recorded_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_documents_environment ON documents(environment);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_language ON documents(language);
CREATE INDEX IF NOT EXISTS idx_documents_indexed_at ON documents(indexed_at);
CREATE INDEX IF NOT EXISTS idx_documents_file_path ON documents(file_path);

CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_index ON document_chunks(chunk_index);

CREATE INDEX IF NOT EXISTS idx_conversation_environment ON conversation_history(environment);
CREATE INDEX IF NOT EXISTS idx_conversation_session_id ON conversation_history(session_id);
CREATE INDEX IF NOT EXISTS idx_conversation_created_at ON conversation_history(created_at);

CREATE INDEX IF NOT EXISTS idx_query_logs_environment ON query_logs(environment);
CREATE INDEX IF NOT EXISTS idx_query_logs_created_at ON query_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_query_logs_cache_hit ON query_logs(cache_hit);
CREATE INDEX IF NOT EXISTS idx_query_logs_response_time ON query_logs(response_time);

CREATE INDEX IF NOT EXISTS idx_indexing_jobs_status ON indexing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_indexing_jobs_created_at ON indexing_jobs(created_at);

CREATE INDEX IF NOT EXISTS idx_metadata_language ON document_metadata(programming_language);
CREATE INDEX IF NOT EXISTS idx_metadata_framework ON document_metadata(framework);
CREATE INDEX IF NOT EXISTS idx_metadata_file_type ON document_metadata(file_type);

CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON user_sessions(last_activity);

CREATE INDEX IF NOT EXISTS idx_search_cache_expires ON search_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_search_cache_environment ON search_cache(environment);
CREATE INDEX IF NOT EXISTS idx_search_cache_last_accessed ON search_cache(last_accessed);

CREATE INDEX IF NOT EXISTS idx_metrics_name ON system_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_metrics_recorded_at ON system_metrics(recorded_at);

-- Triggers for automatic timestamp updates
CREATE TRIGGER IF NOT EXISTS update_documents_updated_at
  AFTER UPDATE ON documents
  BEGIN
    UPDATE documents SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_sessions_last_activity
  AFTER UPDATE ON user_sessions
  BEGIN
    UPDATE user_sessions SET last_activity = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

-- Views for common queries
CREATE VIEW IF NOT EXISTS document_stats AS
SELECT
  environment,
  document_type,
  COUNT(*) as document_count,
  SUM(word_count) as total_words,
  AVG(chunk_count) as avg_chunks,
  COUNT(DISTINCT programming_language) as unique_languages
FROM documents d
LEFT JOIN document_metadata dm ON d.id = dm.document_id
GROUP BY environment, document_type;

CREATE VIEW IF NOT EXISTS query_stats AS
SELECT
  DATE(created_at) as date,
  environment,
  COUNT(*) as query_count,
  AVG(response_time) as avg_response_time,
  AVG(confidence_score) as avg_confidence,
  SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) as cache_hits,
  100.0 * SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) / COUNT(*) as cache_hit_rate
FROM query_logs
GROUP BY DATE(created_at), environment;

CREATE VIEW IF NOT EXISTS indexing_stats AS
SELECT
  environment,
  status,
  COUNT(*) as job_count,
  AVG(total_files) as avg_total_files,
  AVG(processed_files) as avg_processed_files,
  AVG(failed_files) as avg_failed_files
FROM indexing_jobs
GROUP BY environment, status;

-- Insert initial system metrics
INSERT OR IGNORE INTO system_metrics (metric_name, metric_value, environment, metadata) VALUES
('system_startup', 1, 'development', '{"version": "2.0.0", "deployment": "cloudflare-workers"}'),
('rag_api_ready', 1, 'development', '{"status": "initialized", "timestamp": "' || datetime('now') || '""}');
