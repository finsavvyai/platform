CREATE TABLE alerts (
    id VARCHAR(20) PRIMARY KEY,
    tenant_id VARCHAR(20) NOT NULL REFERENCES tenants(id),
    screening_id VARCHAR(20) NOT NULL REFERENCES screenings(id),
    entity_id VARCHAR(20) NOT NULL REFERENCES entities(id),
    status VARCHAR(50) NOT NULL,
    priority VARCHAR(50) NOT NULL,
    assigned_to VARCHAR(255),
    resolution VARCHAR(500),
    justification TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_alerts_tenant ON alerts(tenant_id);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_priority ON alerts(priority);
CREATE INDEX idx_alerts_created ON alerts(created_at);
