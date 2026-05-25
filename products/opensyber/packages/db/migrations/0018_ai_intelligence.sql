-- Sprint 32: AI Intelligence Layer tables

CREATE TABLE IF NOT EXISTS ai_insights (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_recommendations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  insight_id TEXT REFERENCES ai_insights(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  applied_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_query_history (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  translated_filter TEXT NOT NULL,
  result_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_org ON ai_insights(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_org ON ai_recommendations(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_query_history_org ON ai_query_history(org_id);
