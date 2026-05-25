-- LunaOS Engine — D1 Schema
-- Migration 001: Users and Executions

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  tier TEXT DEFAULT 'free' CHECK(tier IN ('free', 'pro', 'team')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Agent executions table
CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  duration_ms INTEGER DEFAULT 0,
  output_length INTEGER DEFAULT 0,
  input_hash TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_executions_user ON executions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_executions_agent ON executions(agent);
