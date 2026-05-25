-- 064_entity_rich_fields.up.sql
-- Persist richer sanctions/PEP entity data that parsers already
-- extract but BulkUpsert was dropping: physical addresses, secondary
-- identifiers (passports, tax IDs, etc.) and aliases beyond the
-- primary display name.
--
-- JSONB is used so each column can carry either a simple string array
-- (aliases, addresses) or an array of structured objects (identifiers
-- with type/value/country) without further schema churn.

ALTER TABLE entities
    ADD COLUMN IF NOT EXISTS addresses   JSONB,
    ADD COLUMN IF NOT EXISTS identifiers JSONB,
    ADD COLUMN IF NOT EXISTS aliases     JSONB;

-- GIN indexes so match verification queries like
-- `WHERE identifiers @> '[{"value":"P1234567"}]'` stay fast.
CREATE INDEX IF NOT EXISTS idx_entities_identifiers
    ON entities USING GIN (identifiers);

CREATE INDEX IF NOT EXISTS idx_entities_addresses
    ON entities USING GIN (addresses);

CREATE INDEX IF NOT EXISTS idx_entities_aliases
    ON entities USING GIN (aliases);
