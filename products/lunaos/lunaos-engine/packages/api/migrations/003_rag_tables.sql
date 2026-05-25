-- RAG Pipeline: Documents + Chunks tables
-- Stores metadata and content for vector search results

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  metadata TEXT,
  updated_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  content TEXT,
  chunk_index INTEGER,
  metadata TEXT,
  embedding_ref TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_documents_path ON documents(path);
