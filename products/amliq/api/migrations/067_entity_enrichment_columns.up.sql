-- Promote the enrichment fields that every parser stuffs into the
-- metadata JSONB today into first-class, indexable columns on
-- entities. See docs/deploy-verification-2026-04-17.md (Tier 2 + 3
-- of the enrichment roadmap) for the coverage audit that justified
-- this.
--
-- All columns are nullable; no backfill required. Existing rows stay
-- as-is. The next reingest will populate them for every entity whose
-- parser promotes the corresponding metadata key.

ALTER TABLE entities ADD COLUMN IF NOT EXISTS pep_tier SMALLINT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS designation_date DATE;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS delisting_date DATE;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS position_title TEXT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS place_of_birth TEXT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS gender TEXT;

-- Indexes for the filters we expect to see in the screening UI.
CREATE INDEX IF NOT EXISTS idx_entities_pep_tier
    ON entities(pep_tier) WHERE pep_tier IS NOT NULL AND pep_tier > 0;
CREATE INDEX IF NOT EXISTS idx_entities_designation_date
    ON entities(designation_date) WHERE designation_date IS NOT NULL;
