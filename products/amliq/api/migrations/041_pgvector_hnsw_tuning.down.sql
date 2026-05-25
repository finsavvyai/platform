-- Revert HNSW tuning
DROP INDEX IF EXISTS idx_entities_embedding_hnsw;
DROP INDEX IF EXISTS idx_entities_embedding_ofac;
DROP INDEX IF EXISTS idx_entities_embedding_eu;
DROP INDEX IF EXISTS idx_entities_embedding_un;
DROP INDEX IF EXISTS idx_entities_name_trgm_gin;
DROP INDEX IF EXISTS idx_entities_list_name;
