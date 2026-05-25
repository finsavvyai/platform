CREATE TABLE audit_entries (
    id VARCHAR(20) PRIMARY KEY,
    tenant_id VARCHAR(20) NOT NULL REFERENCES tenants(id),
    action VARCHAR(50) NOT NULL,
    actor_id VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(100),
    details JSONB,
    previous_hash VARCHAR(64),
    hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant ON audit_entries(tenant_id);
CREATE INDEX idx_audit_resource ON audit_entries(resource_type, resource_id);
CREATE INDEX idx_audit_action ON audit_entries(action);
CREATE INDEX idx_audit_created ON audit_entries(created_at);
