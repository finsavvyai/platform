-- Enable pg_trgm extension for trigram similarity search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN index for full-text search on entity names
CREATE INDEX IF NOT EXISTS idx_entities_name_tsvector
    ON entities USING GIN (to_tsvector('simple', full_name));

-- GIN trigram index for fuzzy name matching
CREATE INDEX IF NOT EXISTS idx_entities_name_trigram
    ON entities USING GIN (full_name gin_trgm_ops);

-- Index for list_id + tenant_id lookups (used by sync delta)
CREATE INDEX IF NOT EXISTS idx_entities_tenant_list
    ON entities (tenant_id, list_id)
    WHERE deleted_at IS NULL;
