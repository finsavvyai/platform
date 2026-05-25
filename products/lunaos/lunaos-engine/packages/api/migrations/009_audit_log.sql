-- Audit Log table
-- Stores all security-relevant events for compliance and debugging

CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    user_id TEXT,
    resource_id TEXT,
    resource_type TEXT,
    metadata TEXT,           -- JSON blob for action-specific data
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action, created_at);
