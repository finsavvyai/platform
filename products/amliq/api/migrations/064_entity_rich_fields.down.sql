-- 064_entity_rich_fields.down.sql
-- Reverse migration 064. Drops the JSONB columns that carry
-- addresses, secondary identifiers and aliases. The underlying
-- data is also carried in metadata JSONB, so no information is
-- permanently lost by rolling back.

DROP INDEX IF EXISTS idx_entities_aliases;
DROP INDEX IF EXISTS idx_entities_addresses;
DROP INDEX IF EXISTS idx_entities_identifiers;

ALTER TABLE entities
    DROP COLUMN IF EXISTS aliases,
    DROP COLUMN IF EXISTS identifiers,
    DROP COLUMN IF EXISTS addresses;
