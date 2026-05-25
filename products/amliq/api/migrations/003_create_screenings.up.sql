CREATE TABLE screenings (
    id VARCHAR(20) PRIMARY KEY,
    tenant_id VARCHAR(20) NOT NULL REFERENCES tenants(id),
    entity_id VARCHAR(20) NOT NULL REFERENCES entities(id),
    max_confidence FLOAT NOT NULL,
    disposition VARCHAR(50) NOT NULL,
    processing_time_ms INT,
    result_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_screenings_tenant ON screenings(tenant_id);
CREATE INDEX idx_screenings_entity ON screenings(entity_id);
CREATE INDEX idx_screenings_created ON screenings(created_at);
