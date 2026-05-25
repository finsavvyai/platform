-- Policy Rule Packs: pre-built and custom rule pack definitions
CREATE TABLE IF NOT EXISTS policy_rule_packs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('ai_security', 'cloud_posture', 'dev_environment', 'compliance')),
  rules TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  is_built_in INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Installed rule packs: tracks which packs are active on which instances
CREATE TABLE IF NOT EXISTS installed_rule_packs (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES instances(id),
  pack_id TEXT NOT NULL REFERENCES policy_rule_packs(id),
  installed_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_active INTEGER NOT NULL DEFAULT 1,
  UNIQUE(instance_id, pack_id)
);
