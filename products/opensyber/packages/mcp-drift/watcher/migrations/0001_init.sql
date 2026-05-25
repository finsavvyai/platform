-- mcp-drift initial schema: tool_fingerprints keyed by (server_url, tool_name).
-- Drizzle composite-PK definition mirrors this layout.

CREATE TABLE IF NOT EXISTS tool_fingerprints (
  server_url   TEXT NOT NULL,
  tool_name    TEXT NOT NULL,
  fingerprint  TEXT NOT NULL,
  description  TEXT NOT NULL,
  input_schema TEXT NOT NULL,
  first_seen   INTEGER NOT NULL,
  last_seen    INTEGER NOT NULL,
  PRIMARY KEY (server_url, tool_name)
);

CREATE TABLE IF NOT EXISTS fingerprint_history (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  server_url   TEXT NOT NULL,
  tool_name    TEXT NOT NULL,
  fingerprint  TEXT NOT NULL,
  description  TEXT NOT NULL,
  input_schema TEXT NOT NULL,
  seen_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_history_server_tool
  ON fingerprint_history (server_url, tool_name, seen_at);
