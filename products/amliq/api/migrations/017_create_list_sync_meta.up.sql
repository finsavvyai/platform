-- List sync metadata per tenant per list
CREATE TABLE IF NOT EXISTS list_sync_meta (
    tenant_id   TEXT NOT NULL,
    list_id     TEXT NOT NULL,
    etag        TEXT DEFAULT '',
    entity_count INTEGER DEFAULT 0,
    synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, list_id)
);

-- Add soft-delete column to entities
ALTER TABLE entities ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_entities_deleted_at ON entities (deleted_at)
    WHERE deleted_at IS NULL;
