-- Token Usage Tracking Table
-- Track LLM token usage for billing and analytics
CREATE TABLE IF NOT EXISTS token_usage (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT,
    api_key_id TEXT,
    request_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    tokens_used INTEGER NOT NULL,
    prompt_tokens INTEGER NOT NULL,
    completion_tokens INTEGER NOT NULL,
    cost_usd REAL NOT NULL,
    operation_type TEXT NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_token_usage_created_at ON token_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_token_usage_operation_type ON token_usage(operation_type);
CREATE INDEX IF NOT EXISTS idx_token_usage_cost_usd ON token_usage(cost_usd);

-- Audit Logs Table
-- Comprehensive audit trail for compliance
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT,
    api_key_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    details TEXT NOT NULL DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE SET NULL
);

-- Create indexes for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_api_key_id ON audit_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs(ip_address);

-- Usage Quotas Table
-- Track tenant usage quotas and limits
CREATE TABLE IF NOT EXISTS usage_quotas (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    quota_type TEXT NOT NULL,
    limit_value INTEGER NOT NULL,
    current_usage INTEGER DEFAULT 0,
    reset_period TEXT NOT NULL,
    last_reset_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Create indexes for usage quotas
CREATE INDEX IF NOT EXISTS idx_usage_quotas_tenant_id ON usage_quotas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_quotas_quota_type ON usage_quotas(quota_type);
CREATE INDEX IF NOT EXISTS idx_usage_quotas_reset_period ON usage_quotas(reset_period);
CREATE INDEX IF NOT EXISTS idx_usage_quotas_last_reset_at ON usage_quotas(last_reset_at);

-- Rate Limit Rules Table
-- Store rate limiting rules per tenant
CREATE TABLE IF NOT EXISTS rate_limit_rules (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    rule_name TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    limit_per_window INTEGER NOT NULL,
    window_seconds INTEGER NOT NULL,
    burst_capacity INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    created_by TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for rate limit rules
CREATE INDEX IF NOT EXISTS idx_rate_limit_rules_tenant_id ON rate_limit_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_rules_rule_name ON rate_limit_rules(rule_name);
CREATE INDEX IF NOT EXISTS idx_rate_limit_rules_resource_type ON rate_limit_rules(resource_type);
CREATE INDEX IF NOT EXISTS idx_rate_limit_rules_is_active ON rate_limit_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_rate_limit_rules_created_at ON rate_limit_rules(created_at);

-- Usage Analytics Table
-- Pre-computed usage analytics for performance
CREATE TABLE IF NOT EXISTS usage_analytics (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    date_key TEXT NOT NULL,
    total_requests INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost_usd REAL DEFAULT 0.0,
    unique_users INTEGER DEFAULT 0,
    unique_api_keys INTEGER DEFAULT 0,
    avg_response_time_ms REAL DEFAULT 0.0,
    error_rate_percent REAL DEFAULT 0.0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Create indexes for usage analytics
CREATE INDEX IF NOT EXISTS idx_usage_analytics_tenant_id ON usage_analytics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_analytics_date_key ON usage_analytics(date_key);
CREATE INDEX IF NOT EXISTS idx_usage_analytics_created_at ON usage_analytics(created_at);
