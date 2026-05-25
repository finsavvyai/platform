CREATE TABLE entity_clusters (
    cluster_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    entity_ids TEXT[] NOT NULL,
    merged_name TEXT,
    confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_clusters_tenant ON entity_clusters(tenant_id);
CREATE INDEX idx_clusters_status ON entity_clusters(status);

CREATE TABLE secondary_identifiers (
    entity_id TEXT NOT NULL,
    type TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (entity_id, type, value)
);
CREATE INDEX idx_sec_id_value ON secondary_identifiers(type, value);
