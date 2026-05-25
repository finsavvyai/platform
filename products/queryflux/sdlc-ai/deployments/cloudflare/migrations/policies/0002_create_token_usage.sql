-- Token Usage Tracking Table
-- Track LLM token usage for billing and analytics
CREATE TABLE IF NOT EXISTS token_usage (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT,
    api_key_id TEXT,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    tokens_used INTEGER NOT NULL,
    prompt_tokens INTEGER NOT NULL,
    completion_tokens INTEGER NOT NULL,
    cost_usd REAL NOT NULL,
    request_id TEXT NOT NULL,
    request_type TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE SET NULL
);

-- Create indexes for token usage
CREATE INDEX IF NOT EXISTS idx_token_usage_tenant_id ON token_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_user_id ON token_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_api_key_id ON token_usage(api_key_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_provider ON token_usage(provider);
CREATE INDEX IF NOT EXISTS idx_token_usage_model ON token_usage(model);
CREATE INDEX IF NOT EXISTS idx_token_usage_request_type ON token_usage(request_type);
CREATE INDEX IF NOT EXISTS idx_token_usage_created_at ON token_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_token_usage_cost_usd ON token_usage(cost_usd);

-- Budget Tracking Table
-- Track tenant budget allocations and usage
CREATE TABLE IF NOT EXISTS tenant_budgets (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL UNIQUE,
    monthly_token_budget INTEGER NOT NULL DEFAULT 1000000,
    monthly_cost_budget REAL NOT NULL DEFAULT 1000.0,
    current_month_tokens INTEGER DEFAULT 0,
    current_month_cost REAL DEFAULT 0.0,
    budget_period_start INTEGER NOT NULL,
    alerts_enabled BOOLEAN DEFAULT true,
    alert_thresholds TEXT NOT NULL DEFAULT '{"tokens": 0.8, "cost": 0.8}',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Create indexes for tenant budgets
CREATE INDEX IF NOT EXISTS idx_tenant_budgets_tenant_id ON tenant_budgets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_budgets_budget_period_start ON tenant_budgets(budget_period_start);
CREATE INDEX IF NOT EXISTS idx_tenant_budgets_created_at ON tenant_budgets(created_at);

-- Budget Alerts Table
-- Track budget alert notifications
CREATE TABLE IF NOT EXISTS budget_alerts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    alert_type TEXT NOT NULL,
    threshold_percentage REAL NOT NULL,
    current_usage REAL NOT NULL,
    budget_limit REAL NOT NULL,
    alert_message TEXT NOT NULL,
    is_sent BOOLEAN DEFAULT false,
    sent_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Create indexes for budget alerts
CREATE INDEX IF NOT EXISTS idx_budget_alerts_tenant_id ON budget_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_budget_alerts_alert_type ON budget_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_budget_alerts_is_sent ON budget_alerts(is_sent);
CREATE INDEX IF NOT EXISTS idx_budget_alerts_created_at ON budget_alerts(created_at);

-- Usage Analytics Table
-- Pre-computed usage analytics for reporting
CREATE TABLE IF NOT EXISTS usage_analytics (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    analytics_date TEXT NOT NULL,
    period_type TEXT NOT NULL,
    total_requests INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost REAL DEFAULT 0.0,
    unique_users INTEGER DEFAULT 0,
    top_models TEXT NOT NULL DEFAULT '[]',
    top_request_types TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, analytics_date, period_type)
);

-- Create indexes for usage analytics
CREATE INDEX IF NOT EXISTS idx_usage_analytics_tenant_id ON usage_analytics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_analytics_analytics_date ON usage_analytics(analytics_date);
CREATE INDEX IF NOT EXISTS idx_usage_analytics_period_type ON usage_analytics(period_type);
CREATE INDEX IF NOT EXISTS idx_usage_analytics_created_at ON usage_analytics(created_at);

-- Cost Optimization Table
-- Track cost optimization suggestions and actions
CREATE TABLE IF NOT EXISTS cost_optimizations (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    optimization_type TEXT NOT NULL,
    description TEXT NOT NULL,
    potential_savings REAL NOT NULL,
    implementation_status TEXT NOT NULL DEFAULT 'pending',
    implemented_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Create indexes for cost optimizations
CREATE INDEX IF NOT EXISTS idx_cost_optimizations_tenant_id ON cost_optimizations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cost_optimizations_optimization_type ON cost_optimizations(optimization_type);
CREATE INDEX IF NOT EXISTS idx_cost_optimizations_implementation_status ON cost_optimizations(implementation_status);
CREATE INDEX IF NOT EXISTS idx_cost_optimizations_created_at ON cost_optimizations(created_at);

-- Insert default budget for system tenant
INSERT OR IGNORE INTO tenant_budgets (
    id,
    tenant_id,
    monthly_token_budget,
    monthly_cost_budget,
    budget_period_start,
    alert_thresholds
) VALUES (
    'system-budget',
    'system-tenant',
    10000000,
    10000.0,
    strftime('%s', 'now', 'start of month'),
    '{"tokens": 0.8, "cost": 0.8}'
);
