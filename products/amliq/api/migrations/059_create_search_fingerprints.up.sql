-- Search fingerprints: pre-computed hash keys for O(1)-like entity lookup.
-- Replaces expensive similarity() full-table scans with B-tree indexed lookups.
-- fp_type codes: 1=normalized, 2=soundex, 3=metaphone, 4=dm_primary,
--   5=dm_alt, 6=token_pair, 7=initials, 8=reversed, 9=variant

CREATE TABLE IF NOT EXISTS search_fingerprints (
    entity_id  VARCHAR(250) NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    fp_type    SMALLINT     NOT NULL,
    fp_value   VARCHAR(255) NOT NULL,
    PRIMARY KEY (fp_type, fp_value, entity_id)
);

CREATE INDEX idx_search_fp_entity ON search_fingerprints (entity_id);
