-- AI conversation history table for the AI Agent chat feature.
-- Messages stored as JSON text in a single column to avoid a join per turn.

CREATE TABLE IF NOT EXISTS ai_conversations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  title TEXT,
  messages TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_tenant ON ai_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_tenant_user ON ai_conversations(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_updated ON ai_conversations(updated_at);
