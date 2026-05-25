-- 019: FTS5 virtual table for sparse keyword search (hybrid search)
-- Used alongside Vectorize dense search for Reciprocal Rank Fusion

CREATE VIRTUAL TABLE IF NOT EXISTS docs_fts USING fts5(
  doc_id, content, source, section,
  tokenize='porter unicode61'
);
