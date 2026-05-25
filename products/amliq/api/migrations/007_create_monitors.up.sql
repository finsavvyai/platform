CREATE TABLE list_monitors (
    id VARCHAR(20) PRIMARY KEY,
    tenant_id VARCHAR(20) NOT NULL REFERENCES tenants(id),
    list_source VARCHAR(50) NOT NULL,
    last_synced_at TIMESTAMPTZ,
    next_sync_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_monitors_tenant ON list_monitors(tenant_id);
CREATE INDEX idx_monitors_next_sync ON list_monitors(next_sync_at);
