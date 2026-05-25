-- Conversations table for tracking user interactions and context
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    message TEXT NOT NULL,
    response TEXT NOT NULL,
    intent TEXT NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    processing_time_ms INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User preferences and settings
CREATE TABLE IF NOT EXISTS user_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    preferred_response_style TEXT DEFAULT 'helpful',
    language TEXT DEFAULT 'en',
    timezone TEXT DEFAULT 'UTC',
    notifications_enabled BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_session ON conversations(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_intent ON conversations(intent);