/**
 * D1 schema for integration tests.
 *
 * Creates all required tables matching the production schema.
 * Called by seedAll() before inserting test data.
 */

const TABLE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'free',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (owner_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS team_members (
    team_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (team_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS team_shared_agents (
    team_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    shared_by TEXT NOT NULL,
    shared_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (team_id, agent_id)
  )`,
  `CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'custom',
    user_id TEXT NOT NULL,
    config TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS chains (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    user_id TEXT NOT NULL,
    nodes TEXT NOT NULL,
    edges TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    scopes TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at TEXT,
    revoked_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS executions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    agent TEXT NOT NULL,
    provider TEXT,
    model TEXT,
    duration_ms INTEGER,
    output_length INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    tags TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS chain_executions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    chain_name TEXT,
    chain_def TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    current_node_index INTEGER DEFAULT 0,
    context TEXT,
    node_results TEXT,
    duration_ms INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    updated_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    ls_customer_id TEXT,
    ls_subscription_id TEXT,
    ls_order_id TEXT,
    ls_variant_id TEXT,
    tier TEXT NOT NULL DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'active',
    current_period_start TEXT,
    current_period_end TEXT,
    cancel_at_period_end INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS github_connections (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    github_username TEXT,
    github_id TEXT,
    access_token TEXT,
    scopes TEXT,
    connected_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS indexed_repos (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    repo_full_name TEXT NOT NULL,
    file_count INTEGER DEFAULT 0,
    indexed_at TEXT,
    UNIQUE(user_id, repo_full_name)
  )`,
  `CREATE TABLE IF NOT EXISTS analytics_events (
    id TEXT PRIMARY KEY,
    event_type TEXT,
    agent TEXT,
    provider TEXT,
    model TEXT,
    duration_ms INTEGER,
    created_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS openclaw_gateways (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    gateway_url TEXT NOT NULL,
    label TEXT,
    status TEXT DEFAULT 'active',
    health_status TEXT DEFAULT 'unknown',
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS openclaw_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    gateway_id TEXT,
    session_key TEXT,
    run_id TEXT,
    agent TEXT,
    agent_name TEXT,
    model TEXT,
    task_summary TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
];

/** Create the required tables in D1 for tests */
export async function createTables(db: D1Database): Promise<void> {
  for (const sql of TABLE_STATEMENTS) {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    await db.exec(normalized + ';');
  }
}
