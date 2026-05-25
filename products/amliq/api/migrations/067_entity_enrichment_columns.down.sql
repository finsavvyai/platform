DROP INDEX IF EXISTS idx_entities_designation_date;
DROP INDEX IF EXISTS idx_entities_pep_tier;

ALTER TABLE entities DROP COLUMN IF EXISTS gender;
ALTER TABLE entities DROP COLUMN IF EXISTS place_of_birth;
ALTER TABLE entities DROP COLUMN IF EXISTS position_title;
ALTER TABLE entities DROP COLUMN IF EXISTS delisting_date;
ALTER TABLE entities DROP COLUMN IF EXISTS designation_date;
ALTER TABLE entities DROP COLUMN IF EXISTS pep_tier;
