-- OpenClaw Channel Connections
-- Users connect their own Slack, WhatsApp, Discord, Telegram channels
-- Each connection is owned by a user and routes messages to their agents

CREATE TABLE IF NOT EXISTS channel_connections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    
    -- Channel type: slack, whatsapp, discord, telegram, webhook
    channel_type TEXT NOT NULL,
    
    -- Human-readable label (e.g. "My Team Slack", "Support WhatsApp")
    label TEXT NOT NULL DEFAULT 'My Channel',
    
    -- Connection status
    status TEXT NOT NULL DEFAULT 'pending', -- pending, active, paused, revoked, error
    
    -- Channel-specific identifiers
    -- Slack: workspace_id, Discord: guild_id, WhatsApp: phone_number_id, Telegram: bot_username
    external_id TEXT,
    external_name TEXT,  -- workspace name, server name, phone number, bot name
    
    -- OAuth tokens & credentials (encrypted in production)
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TEXT,
    
    -- Webhook URL for this specific connection (unique per user+channel)
    webhook_url TEXT,
    webhook_secret TEXT,
    
    -- Configuration
    config TEXT DEFAULT '{}',  -- JSON: default_agent, allowed_channels, auto_respond, etc.
    
    -- Which agent to use by default for this channel
    default_agent TEXT DEFAULT 'run',
    
    -- Rate limiting per channel connection
    rate_limit_per_minute INTEGER DEFAULT 30,
    
    -- Scopes granted (Slack: chat:write, commands, etc.)
    scopes TEXT,
    
    -- Stats
    message_count INTEGER DEFAULT 0,
    last_message_at TEXT,
    
    -- Timestamps
    connected_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_channel_connections_user ON channel_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_connections_type ON channel_connections(channel_type, status);
CREATE INDEX IF NOT EXISTS idx_channel_connections_external ON channel_connections(channel_type, external_id);
CREATE INDEX IF NOT EXISTS idx_channel_connections_webhook ON channel_connections(webhook_url);

-- Channel message log — tracks every message processed through a channel
CREATE TABLE IF NOT EXISTS channel_messages (
    id TEXT PRIMARY KEY,
    connection_id TEXT NOT NULL REFERENCES channel_connections(id),
    user_id TEXT NOT NULL,
    
    -- Message direction
    direction TEXT NOT NULL DEFAULT 'inbound', -- inbound (user→agent), outbound (agent→user)
    
    -- Original message content
    sender_id TEXT,       -- platform-specific sender ID
    sender_name TEXT,
    channel_id TEXT,      -- platform-specific channel/group ID
    channel_name TEXT,
    message_text TEXT,
    
    -- Agent execution
    agent_slug TEXT,
    execution_id TEXT,
    response_text TEXT,
    
    -- Timing
    duration_ms INTEGER,
    status TEXT NOT NULL DEFAULT 'received', -- received, processing, responded, failed, ignored
    error TEXT,
    
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_channel_messages_connection ON channel_messages(connection_id);
CREATE INDEX IF NOT EXISTS idx_channel_messages_user ON channel_messages(user_id, created_at);

-- OAuth state for CSRF protection during OAuth flows
CREATE TABLE IF NOT EXISTS oauth_states (
    state TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    channel_type TEXT NOT NULL,
    redirect_uri TEXT,
    metadata TEXT DEFAULT '{}',
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);
