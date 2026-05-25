-- ClawPipe D1 Database Schema
-- Source of truth: dumped from production D1

CREATE TABLE IF NOT EXISTS cache_entries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  response TEXT NOT NULL,
  ttl INTEGER NOT NULL DEFAULT 300,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  UNIQUE (project_id, prompt_hash)
);

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (provider, provider_account_id)
);

CREATE TABLE IF NOT EXISTS project_members (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  api_key_hash TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL DEFAULT 'free',
  rate_limit_per_day INTEGER NOT NULL DEFAULT 1000,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  cached INTEGER NOT NULL DEFAULT 0,
  boosted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS route_weights (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  task_type TEXT NOT NULL DEFAULT 'general',
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  score REAL NOT NULL DEFAULT 0.5,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  UNIQUE (project_id, task_type, provider, model)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  password_hash TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT NOT NULL,
  threshold REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS weight_history (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  total_calls INTEGER NOT NULL DEFAULT 0,
  avg_latency_ms REAL NOT NULL DEFAULT 0,
  avg_tokens_out REAL NOT NULL DEFAULT 0,
  score REAL NOT NULL DEFAULT 0.5,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  UNIQUE (project_id, provider, model)
);

CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  UNIQUE(project_id, name)
);

CREATE TABLE IF NOT EXISTS prompt_versions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  prompt_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  template TEXT NOT NULL,
  system TEXT,
  model TEXT,
  variables TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
  UNIQUE(prompt_id, version)
);

CREATE TABLE IF NOT EXISTS quality_scores (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  request_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  score REAL NOT NULL CHECK(score >= 0 AND score <= 1),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prompts_project ON prompts(project_id);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt ON prompt_versions(prompt_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_quality_project ON quality_scores(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cache_lookup ON cache_entries(project_id, prompt_hash);
CREATE INDEX IF NOT EXISTS idx_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_provider ON oauth_accounts(provider, provider_account_id);
CREATE INDEX IF NOT EXISTS idx_projects_key ON projects(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_requests_project ON requests(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_requests_provider ON requests(provider, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_webhooks_project ON webhooks(project_id);
CREATE INDEX IF NOT EXISTS idx_weight_history ON weight_history(project_id);

-- Webhook delivery log + retry queue (migration 016).
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              TEXT PRIMARY KEY,
  webhook_id      TEXT NOT NULL,
  project_id      TEXT NOT NULL,
  event           TEXT NOT NULL,
  payload         TEXT NOT NULL,
  attempts        INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 5,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'success', 'dead')),
  last_error      TEXT,
  next_retry_at   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_pending
  ON webhook_deliveries (status, next_retry_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_project
  ON webhook_deliveries (project_id, created_at DESC);
