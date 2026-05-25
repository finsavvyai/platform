-- Create dashboard_sessions table for user session management
-- Migration: 0002_create_sessions_table
-- Created: 2025-01-04

CREATE TABLE IF NOT EXISTS dashboard_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_activity_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES dashboard_users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON dashboard_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON dashboard_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON dashboard_sessions(expires_at);

-- Trigger to update last_activity_at on access
CREATE TRIGGER IF NOT EXISTS trigger_sessions_activity
AFTER UPDATE ON dashboard_sessions
BEGIN
  UPDATE dashboard_sessions SET last_activity_at = datetime('now') WHERE id = NEW.id;
END;
