-- Usage statistics table for tracking search queries and limits
CREATE TABLE IF NOT EXISTS usage_stats (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date DATE NOT NULL,
    searches_count INTEGER DEFAULT 0,
    files_indexed INTEGER DEFAULT 0,
    vision_analyses INTEGER DEFAULT 0,
    glm_analyses INTEGER DEFAULT 0,
    api_calls INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, date)
);

-- Monthly usage aggregation for analytics
CREATE TABLE IF NOT EXISTS monthly_usage (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    total_searches INTEGER DEFAULT 0,
    total_files_indexed INTEGER DEFAULT 0,
    total_vision_analyses INTEGER DEFAULT 0,
    total_glm_analyses INTEGER DEFAULT 0,
    total_api_calls INTEGER DEFAULT 0,
    subscription_tier TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, year, month)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_usage_stats_user_date ON usage_stats(user_id, date);
CREATE INDEX IF NOT EXISTS idx_monthly_usage_user_period ON monthly_usage(user_id, year, month);
CREATE INDEX IF NOT EXISTS idx_usage_stats_date ON usage_stats(date);