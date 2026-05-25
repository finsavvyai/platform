-- Migration: Add PII Redactions Tracking Table
-- Week 2 Day 1: PII Detection & Redaction Logging

CREATE TABLE IF NOT EXISTS pii_redactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    api_key_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    request_pii_count INTEGER DEFAULT 0,
    response_pii_count INTEGER DEFAULT 0,
    request_pii_types TEXT, -- JSON object: {"SSN": 2, "EMAIL": 1}
    response_pii_types TEXT, -- JSON object: {"CREDIT_CARD": 1}
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_pii_redactions_user_id ON pii_redactions(user_id);
CREATE INDEX IF NOT EXISTS idx_pii_redactions_api_key_id ON pii_redactions(api_key_id);
CREATE INDEX IF NOT EXISTS idx_pii_redactions_timestamp ON pii_redactions(timestamp);

-- Add index to existing usage_logs table for better query performance
CREATE INDEX IF NOT EXISTS idx_usage_logs_timestamp ON usage_logs(timestamp);
