-- P7: pgvector HNSW index tuning (optional — skip if pgvector not installed)
DO $$
BEGIN
  -- Only create HNSW indexes if pgvector extension exists
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    EXECUTE 'DROP INDEX IF EXISTS idx_entities_embedding_ivf';
    EXECUTE 'DROP INDEX IF EXISTS idx_entities_embedding';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_entities_embedding_hnsw
      ON entities USING hnsw (embedding vector_cosine_ops)
      WITH (m = 32, ef_construction = 200)';
  ELSE
    RAISE NOTICE 'pgvector not installed — skipping HNSW indexes';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'HNSW index creation skipped: %', SQLERRM;
END $$;

-- Trigram GIN index (always available)
DROP INDEX IF EXISTS idx_entities_name_trgm;
CREATE INDEX IF NOT EXISTS idx_entities_name_trgm_gin
  ON entities USING GIN (full_name gin_trgm_ops);

-- Composite index for filtered searches
CREATE INDEX IF NOT EXISTS idx_entities_list_name
  ON entities (list_id, full_name);
