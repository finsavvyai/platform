-- Audit Webhooks table
-- Stores webhook configurations for audit event delivery

CREATE TABLE IF NOT EXISTS audit_webhooks (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,              -- Hash of webhook secret (hashed on server)
    events TEXT,                       -- JSON array of events to trigger on
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    last_delivered_at TEXT,
    failure_count INTEGER DEFAULT 0,
    FOREIGN KEY (org_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_audit_webhooks_org ON audit_webhooks(org_id, active);
CREATE INDEX IF NOT EXISTS idx_audit_webhooks_created ON audit_webhooks(created_at DESC);
