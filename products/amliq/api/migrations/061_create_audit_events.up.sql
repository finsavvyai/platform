CREATE TABLE IF NOT EXISTS audit_events (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    request_id TEXT,
    tenant_id TEXT NOT NULL,
    action TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    ip TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant_time ON audit_events (tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_events (action, timestamp DESC);
