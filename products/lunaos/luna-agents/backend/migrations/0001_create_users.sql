-- Users table for authentication and subscription management
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    user_id TEXT UNIQUE NOT NULL,
    tier TEXT NOT NULL DEFAULT 'free',
    api_key TEXT UNIQUE,
    subscription_id TEXT,
    subscription_status TEXT DEFAULT 'inactive',
    trial_started_at DATETIME,
    trial_ends_at DATETIME,
    subscription_created_at DATETIME,
    cancelled_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);
CREATE INDEX IF NOT EXISTS idx_users_subscription_id ON users(subscription_id);
CREATE INDEX IF NOT EXISTS idx_users_trial_ends_at ON users(trial_ends_at);