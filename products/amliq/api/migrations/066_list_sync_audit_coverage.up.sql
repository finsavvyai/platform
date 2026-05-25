-- 066: field coverage stats on list_sync_audit.
-- For each sync, we now record how many of the parsed entities
-- had DOB, nationalities, addresses, identifiers populated. Lets
-- admins detect parser regressions where the source still returns
-- data but the parser stops emitting enrichment fields.

ALTER TABLE list_sync_audit
    ADD COLUMN IF NOT EXISTS entities_parsed        INTEGER,
    ADD COLUMN IF NOT EXISTS entities_with_dob      INTEGER,
    ADD COLUMN IF NOT EXISTS entities_with_nat      INTEGER,
    ADD COLUMN IF NOT EXISTS entities_with_addr     INTEGER,
    ADD COLUMN IF NOT EXISTS entities_with_ids      INTEGER,
    ADD COLUMN IF NOT EXISTS entities_with_aliases  INTEGER;
