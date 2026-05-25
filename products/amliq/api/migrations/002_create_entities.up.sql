CREATE TABLE entities (
    id VARCHAR(20) PRIMARY KEY,
    tenant_id VARCHAR(20) NOT NULL REFERENCES tenants(id),
    type VARCHAR(50) NOT NULL,
    full_name VARCHAR(500) NOT NULL,
    given_name VARCHAR(255),
    family_name VARCHAR(255),
    original_script TEXT,
    dob DATE,
    nationalities TEXT,
    list_id VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_entities_tenant ON entities(tenant_id);
CREATE INDEX idx_entities_list ON entities(list_id);
CREATE INDEX idx_entities_name ON entities(full_name);
