-- Create email_verification_tokens table for email verification
-- Migration: 0006_create_email_verification_table
-- Created: 2025-01-05

CREATE TABLE IF NOT EXISTS dashboard_email_verification_tokens (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  token_prefix TEXT NOT NULL, -- First 8 chars for display
  purpose TEXT NOT NULL CHECK(purpose IN ('email_verification', 'password_reset')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES dashboard_users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_verification_tokens_user_id ON dashboard_email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token_hash ON dashboard_email_verification_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_expires_at ON dashboard_email_verification_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_purpose ON dashboard_email_verification_tokens(purpose);
