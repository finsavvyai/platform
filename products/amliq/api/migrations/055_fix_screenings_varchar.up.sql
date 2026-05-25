-- Fix VARCHAR(20) too short for generated IDs (res_ + 19-digit nanosecond)
ALTER TABLE screenings ALTER COLUMN id TYPE VARCHAR(40);
ALTER TABLE screenings ALTER COLUMN tenant_id TYPE VARCHAR(40);
ALTER TABLE screenings ALTER COLUMN entity_id TYPE VARCHAR(40);

-- Drop invalid FK: entity_id references query entities, not sanctions entities
ALTER TABLE screenings DROP CONSTRAINT IF EXISTS screenings_entity_id_fkey;
