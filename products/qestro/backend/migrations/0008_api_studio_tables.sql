-- 0008_api_studio_tables.sql
-- Durable API Studio storage for the active Cloudflare Worker backend.

CREATE TABLE IF NOT EXISTS api_testing_collections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  variables TEXT NOT NULL DEFAULT '{}',
  tags TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS api_testing_requests (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  method TEXT NOT NULL DEFAULT 'GET',
  url TEXT NOT NULL,
  headers TEXT NOT NULL DEFAULT '{}',
  body TEXT,
  body_type TEXT NOT NULL DEFAULT 'json',
  auth TEXT,
  pre_request_script TEXT,
  test_script TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (collection_id) REFERENCES api_testing_collections(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_testing_environments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  name TEXT NOT NULL,
  variables TEXT NOT NULL DEFAULT '{}',
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS api_testing_history (
  id TEXT PRIMARY KEY,
  request_id TEXT,
  collection_id TEXT,
  user_id TEXT NOT NULL,
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  response_status INTEGER NOT NULL DEFAULT 0,
  response_status_text TEXT NOT NULL DEFAULT '',
  request_headers TEXT NOT NULL DEFAULT '{}',
  request_body TEXT,
  response_headers TEXT NOT NULL DEFAULT '{}',
  response_body TEXT,
  response_time INTEGER NOT NULL DEFAULT 0,
  response_size INTEGER NOT NULL DEFAULT 0,
  executed_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS api_testing_collections_user_id_idx
  ON api_testing_collections(user_id);
CREATE INDEX IF NOT EXISTS api_testing_collections_project_id_idx
  ON api_testing_collections(project_id);
CREATE INDEX IF NOT EXISTS api_testing_requests_collection_id_idx
  ON api_testing_requests(collection_id);
CREATE INDEX IF NOT EXISTS api_testing_requests_user_id_idx
  ON api_testing_requests(user_id);
CREATE INDEX IF NOT EXISTS api_testing_environments_user_id_idx
  ON api_testing_environments(user_id);
CREATE INDEX IF NOT EXISTS api_testing_history_user_id_idx
  ON api_testing_history(user_id);
CREATE INDEX IF NOT EXISTS api_testing_history_executed_at_idx
  ON api_testing_history(executed_at);
