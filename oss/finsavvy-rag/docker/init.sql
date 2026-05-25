-- Enable pgvector and basic schema
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
  id BIGSERIAL PRIMARY KEY,
  doc_id TEXT UNIQUE,
  content TEXT NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  embedding VECTOR(384) -- all-MiniLM-L6-v2 = 384 dims
);

-- ivfflat index (populate after data)
CREATE INDEX IF NOT EXISTS idx_documents_embedding
  ON documents USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_documents_meta ON documents USING GIN (meta);
