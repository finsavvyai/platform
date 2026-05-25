-- Custom Agents Table
-- Stores user-created custom agent personas

CREATE TABLE IF NOT EXISTS custom_agents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  category TEXT DEFAULT 'custom',
  model TEXT,
  temperature REAL,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_custom_agents_user ON custom_agents(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_agents_user_slug ON custom_agents(user_id, slug);

-- Triggers for automatic timestamp updates
CREATE TRIGGER IF NOT EXISTS update_custom_agents_updated_at
  AFTER UPDATE ON custom_agents
  BEGIN
    UPDATE custom_agents SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;
