-- Graph RAG: chunk relationships + community membership
-- Enables RuVector-style community-aware search expansion

CREATE TABLE IF NOT EXISTS chunk_edges (
  id TEXT PRIMARY KEY,
  source_chunk_id TEXT NOT NULL,
  target_chunk_id TEXT NOT NULL,
  edge_type TEXT NOT NULL,
  weight REAL DEFAULT 1.0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chunk_edges_source ON chunk_edges(source_chunk_id);
CREATE INDEX IF NOT EXISTS idx_chunk_edges_target ON chunk_edges(target_chunk_id);
CREATE INDEX IF NOT EXISTS idx_chunk_edges_type ON chunk_edges(edge_type);

-- Community ID on chunks (assigned at index time via label propagation)
-- Using separate lookup to avoid ALTER TABLE on shared chunks table
CREATE TABLE IF NOT EXISTS chunk_communities (
  chunk_id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL,
  assigned_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chunk_communities_community
  ON chunk_communities(community_id);
