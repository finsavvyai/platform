
DROP TABLE IF EXISTS search_analytics;
DROP TABLE IF EXISTS chunks;
DROP TABLE IF EXISTS documents;

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  metadata TEXT, -- JSON structure
  updated_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE TABLE chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  content TEXT, -- The actual chunk text which might be large
  chunk_index INTEGER,
  metadata TEXT, -- JSON specific to chunk
  embedding_ref TEXT, -- Reference ID in Vectorize if needed
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX idx_chunks_document_id ON chunks(document_id);
CREATE INDEX idx_chunks_content ON chunks(content);

-- Search analytics for tracking query performance
CREATE TABLE search_analytics (
  id TEXT PRIMARY KEY,
  query_text TEXT NOT NULL,
  result_count INTEGER DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  cache_hit INTEGER DEFAULT 0,
  search_type TEXT DEFAULT 'semantic',
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX idx_search_analytics_created ON search_analytics(created_at);
