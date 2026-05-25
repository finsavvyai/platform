-- Add pre-computed columns for fast tiered search
ALTER TABLE entities ADD COLUMN IF NOT EXISTS soundex_code VARCHAR(10);
ALTER TABLE entities ADD COLUMN IF NOT EXISTS name_normalized VARCHAR(500);
ALTER TABLE entities ADD COLUMN IF NOT EXISTS name_tokens TEXT[];

-- Skip bulk UPDATE — columns populated lazily on next sync.
-- Indexes (created empty, populated as data comes in)
CREATE INDEX IF NOT EXISTS idx_entities_norm
    ON entities (name_normalized) WHERE name_normalized IS NOT NULL;
