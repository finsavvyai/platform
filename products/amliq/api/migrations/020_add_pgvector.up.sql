-- pgvector is optional; skip gracefully if extension not available
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
  ALTER TABLE entities ADD COLUMN IF NOT EXISTS embedding vector(384);
  CREATE INDEX IF NOT EXISTS idx_entities_embedding
    ON entities USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pgvector not installed — embedding features disabled';
END $$;
