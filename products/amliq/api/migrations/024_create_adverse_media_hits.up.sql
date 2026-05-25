CREATE TABLE adverse_media_hits (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    entity_id TEXT NOT NULL,
    source_url TEXT NOT NULL,
    headline TEXT NOT NULL,
    category TEXT NOT NULL,
    severity INT NOT NULL DEFAULT 1,
    snippet TEXT,
    published_at TIMESTAMPTZ,
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_media_tenant ON adverse_media_hits(tenant_id);
CREATE INDEX idx_media_entity ON adverse_media_hits(entity_id);
CREATE INDEX idx_media_category ON adverse_media_hits(category);
