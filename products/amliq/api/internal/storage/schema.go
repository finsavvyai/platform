package storage

const schema = `
-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Entities
CREATE TABLE IF NOT EXISTS entities (
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

-- Screenings
CREATE TABLE IF NOT EXISTS screenings (
    id VARCHAR(20) PRIMARY KEY,
    tenant_id VARCHAR(20) NOT NULL REFERENCES tenants(id),
    entity_id VARCHAR(20) NOT NULL REFERENCES entities(id),
    max_confidence FLOAT NOT NULL,
    disposition VARCHAR(50) NOT NULL,
    processing_time_ms INT,
    result_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
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

-- Audit
CREATE TABLE IF NOT EXISTS audit_entries (
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
`

func GetSchema() string {
	return schema
}
