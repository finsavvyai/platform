-- Create dashboard_api_keys table for API key management
-- Migration: 0003_create_api_keys_table
-- Created: 2025-01-04

CREATE TABLE IF NOT EXISTS dashboard_api_keys (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  key_prefix TEXT NOT NULL, -- First 8 chars for display (e.g., "ab_12345678")
  scopes TEXT NOT NULL DEFAULT '[]', -- JSON array of scopes
  rate_limit INTEGER NOT NULL DEFAULT 1000, -- Requests per hour
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  last_used_at TEXT,
  expires_at TEXT, -- NULL for no expiration
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES dashboard_users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON dashboard_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON dashboard_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON dashboard_api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON dashboard_api_keys(expires_at);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS trigger_api_keys_updated_at
AFTER UPDATE ON dashboard_api_keys
BEGIN
  UPDATE dashboard_api_keys SET updated_at = datetime('now') WHERE id = NEW.id;
END;
