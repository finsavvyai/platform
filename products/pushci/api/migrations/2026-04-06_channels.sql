-- Channel connections: WhatsApp, Slack, Discord, Telegram, Webhook
CREATE TABLE IF NOT EXISTS channel_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  channel_type TEXT NOT NULL,
  label TEXT,
  status TEXT DEFAULT 'pending',
  external_id TEXT,
  external_name TEXT,
  access_token TEXT,
  webhook_url TEXT,
  webhook_secret TEXT,
  config TEXT DEFAULT '{}',
  default_agent TEXT DEFAULT 'run',
  rate_limit_per_minute INTEGER DEFAULT 30,
  message_count INTEGER DEFAULT 0,
  last_message_at TEXT,
  connected_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ch_conn_user ON channel_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_ch_conn_type ON channel_connections(channel_type, status);
CREATE INDEX IF NOT EXISTS idx_ch_conn_ext ON channel_connections(channel_type, external_id);
CREATE INDEX IF NOT EXISTS idx_ch_conn_webhook ON channel_connections(webhook_url);

-- Channel message log
CREATE TABLE IF NOT EXISTS channel_messages (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES channel_connections(id),
  user_id TEXT NOT NULL,
  direction TEXT DEFAULT 'inbound',
  sender_id TEXT,
  sender_name TEXT,
  message_text TEXT,
  agent_slug TEXT,
  execution_id TEXT,
  response_text TEXT,
  duration_ms INTEGER,
  status TEXT DEFAULT 'received',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ch_msg_conn ON channel_messages(connection_id);
CREATE INDEX IF NOT EXISTS idx_ch_msg_user ON channel_messages(user_id);
