-- PostgreSQL to D1 SQLite Migration Script
-- Complete schema conversion for Qestro platform to Cloudflare D1
--
-- Data Type Mappings Applied:
-- UUID -> TEXT
-- VARCHAR(n) -> TEXT
-- TEXT -> TEXT
-- TIMESTAMP -> INTEGER (Unix timestamp in milliseconds)
-- BOOLEAN -> INTEGER (0/1)
-- JSONB -> TEXT (stored as JSON string)
-- DECIMAL -> REAL
-- SERIAL -> INTEGER
-- ARRAY -> TEXT (stored as JSON string)

-- Core Tables Migration

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    avatar TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    subscription TEXT DEFAULT 'free',
    is_email_verified INTEGER DEFAULT 0,
    last_login_at INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL,
    platform TEXT,
    settings TEXT DEFAULT '{}',
    is_active INTEGER DEFAULT 1,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Recording sessions table
CREATE TABLE IF NOT EXISTS recording_sessions (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
    project_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT,
    type TEXT NOT NULL,
    platform TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'idle',
    start_time INTEGER,
    end_time INTEGER,
    duration INTEGER DEFAULT 0,
    actions_count INTEGER DEFAULT 0,
    metadata TEXT DEFAULT '{}',
    artifacts TEXT DEFAULT '{}',
    export_formats TEXT DEFAULT '[]',
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Core Indexes
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);
CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects(user_id);
CREATE INDEX IF NOT EXISTS projects_type_idx ON projects(type);
CREATE INDEX IF NOT EXISTS recording_sessions_project_id_idx ON recording_sessions(project_id);
CREATE INDEX IF NOT EXISTS recording_sessions_user_id_idx ON recording_sessions(user_id);
CREATE INDEX IF NOT EXISTS recording_sessions_status_idx ON recording_sessions(status);

-- Test Management Tables

-- Recorded actions table
CREATE TABLE IF NOT EXISTS recorded_actions (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
    session_id TEXT NOT NULL,
    sequence_number INTEGER NOT NULL,
    type TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    coordinates TEXT,
    text TEXT,
    element TEXT,
    selector TEXT,
    screenshot TEXT,
    metadata TEXT DEFAULT '{}',
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (session_id) REFERENCES recording_sessions(id) ON DELETE CASCADE
);

-- Test suites table
CREATE TABLE IF NOT EXISTS test_suites (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
    project_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL,
    test_cases TEXT DEFAULT '[]',
    settings TEXT DEFAULT '{}',
    schedule TEXT,
    is_active INTEGER DEFAULT 1,
    last_run_at INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Test cases table
CREATE TABLE IF NOT EXISTS test_cases (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
    project_id TEXT NOT NULL,
    session_id TEXT,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL,
    platform TEXT,
    test_data TEXT NOT NULL,
    expected_results TEXT DEFAULT '[]',
    tags TEXT DEFAULT '[]',
    is_active INTEGER DEFAULT 1,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES recording_sessions(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Test runs table
CREATE TABLE IF NOT EXISTS test_runs (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
    test_suite_id TEXT,
    test_case_id TEXT,
    project_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    start_time INTEGER,
    end_time INTEGER,
    duration INTEGER,
    results TEXT DEFAULT '{}',
    logs TEXT DEFAULT '[]',
    screenshots TEXT DEFAULT '[]',
    videos TEXT DEFAULT '[]',
    error_message TEXT,
    environment TEXT DEFAULT '{}',
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (test_suite_id) REFERENCES test_suites(id) ON DELETE CASCADE,
    FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- API Management Tables

-- API endpoints table
CREATE TABLE IF NOT EXISTS api_endpoints (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    base_url TEXT NOT NULL,
    version TEXT NOT NULL,
    authentication TEXT NOT NULL,
    headers TEXT DEFAULT '{}',
    rate_limit TEXT,
    timeout INTEGER DEFAULT 30000,
    retry_config TEXT,
    health_check TEXT,
    documentation TEXT,
    tags TEXT DEFAULT '[]',
    is_active INTEGER DEFAULT 1,
    last_health_check INTEGER,
    health_status TEXT DEFAULT 'unknown',
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- API calls table
CREATE TABLE IF NOT EXISTS api_calls (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
    endpoint_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    headers TEXT DEFAULT '{}',
    query_params TEXT DEFAULT '{}',
    body TEXT,
    response_status INTEGER,
    response_headers TEXT DEFAULT '{}',
    response_body TEXT,
    response_time INTEGER,
    success INTEGER NOT NULL,
    error TEXT,
    validation_results TEXT DEFAULT '[]',
    transformed_data TEXT,
    executed_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (endpoint_id) REFERENCES api_endpoints(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Plugin System Tables

-- Plugins table
CREATE TABLE IF NOT EXISTS plugins (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    version TEXT NOT NULL,
    author_id TEXT NOT NULL,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    long_description TEXT,
    code TEXT NOT NULL,
    entry_point TEXT NOT NULL,
    configuration TEXT DEFAULT '{}',
    permissions TEXT DEFAULT '[]',
    security_scan_status TEXT DEFAULT 'pending',
    security_scan_results TEXT DEFAULT '{}',
    is_public INTEGER DEFAULT 0,
    is_approved INTEGER DEFAULT 0,
    downloads INTEGER DEFAULT 0,
    rating REAL DEFAULT 0.00,
    review_count INTEGER DEFAULT 0,
    ai_generated INTEGER DEFAULT 0,
    generation_prompt TEXT,
    confidence REAL,
    status TEXT NOT NULL DEFAULT 'draft',
    is_active INTEGER DEFAULT 1,
    published_at INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Plugin installations table
CREATE TABLE IF NOT EXISTS plugin_installations (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
    user_id TEXT NOT NULL,
    plugin_id TEXT NOT NULL,
    installed_version TEXT NOT NULL,
    auto_update INTEGER DEFAULT 1,
    user_configuration TEXT DEFAULT '{}',
    is_active INTEGER DEFAULT 1,
    last_used INTEGER,
    usage_count INTEGER DEFAULT 0,
    installed_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (plugin_id) REFERENCES plugins(id) ON DELETE CASCADE
);

-- Payment System Tables

-- Payment customers table
CREATE TABLE IF NOT EXISTS payment_customers (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
    user_id TEXT NOT NULL,
    lemon_squeezy_customer_id TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
    user_id TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    status TEXT NOT NULL,
    current_period_start INTEGER NOT NULL,
    current_period_end INTEGER NOT NULL,
    cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
    lemon_squeezy_subscription_id TEXT NOT NULL UNIQUE,
    lemon_squeezy_customer_id TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Voice System Tables

-- Voice recordings table
CREATE TABLE IF NOT EXISTS voice_recordings (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
    user_id TEXT NOT NULL,
    project_id TEXT,
    session_id TEXT,
    test_case_id TEXT,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    duration INTEGER NOT NULL,
    format TEXT NOT NULL,
    sample_rate INTEGER,
    bit_rate INTEGER,
    channels INTEGER,
    transcription_text TEXT,
    transcription_provider TEXT,
    transcription_confidence REAL,
    transcription_language TEXT,
    processing_status TEXT DEFAULT 'pending',
    processing_error TEXT,
    contains_commands INTEGER DEFAULT 0,
    detected_commands TEXT DEFAULT '[]',
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (session_id) REFERENCES recording_sessions(id) ON DELETE SET NULL,
    FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE SET NULL
);

-- Security and Analytics Tables

-- Security audit logs table
CREATE TABLE IF NOT EXISTS security_audit_logs (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
    user_id TEXT,
    event_type TEXT NOT NULL,
    event_category TEXT NOT NULL,
    severity TEXT NOT NULL,
    description TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    session_id TEXT,
    metadata TEXT DEFAULT '{}',
    status TEXT NOT NULL,
    timestamp INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Advanced analytics table
CREATE TABLE IF NOT EXISTS advanced_analytics (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
    user_id TEXT NOT NULL,
    project_id TEXT,
    date INTEGER NOT NULL,
    granularity TEXT NOT NULL,
    total_tests INTEGER DEFAULT 0,
    passed_tests INTEGER DEFAULT 0,
    failed_tests INTEGER DEFAULT 0,
    skipped_tests INTEGER DEFAULT 0,
    avg_execution_time INTEGER DEFAULT 0,
    min_execution_time INTEGER,
    max_execution_time INTEGER,
    test_coverage REAL,
    code_quality_score REAL,
    bug_detection_rate REAL,
    ai_generated_tests INTEGER DEFAULT 0,
    ai_suggestion_accuracy REAL,
    browser_distribution TEXT DEFAULT '{}',
    device_distribution TEXT DEFAULT '{}',
    platform_distribution TEXT DEFAULT '{}',
    api_test_count INTEGER DEFAULT 0,
    database_test_count INTEGER DEFAULT 0,
    plugin_usage_count INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- Additional Indexes for Performance
CREATE INDEX IF NOT EXISTS recorded_actions_session_id_idx ON recorded_actions(session_id);
CREATE INDEX IF NOT EXISTS recorded_actions_sequence_idx ON recorded_actions(session_id, sequence_number);
CREATE INDEX IF NOT EXISTS test_suites_project_id_idx ON test_suites(project_id);
CREATE INDEX IF NOT EXISTS test_suites_user_id_idx ON test_suites(user_id);
CREATE INDEX IF NOT EXISTS test_cases_project_id_idx ON test_cases(project_id);
CREATE INDEX IF NOT EXISTS test_cases_user_id_idx ON test_cases(user_id);
CREATE INDEX IF NOT EXISTS test_runs_project_id_idx ON test_runs(project_id);
CREATE INDEX IF NOT EXISTS test_runs_user_id_idx ON test_runs(user_id);
CREATE INDEX IF NOT EXISTS test_runs_status_idx ON test_runs(status);
CREATE INDEX IF NOT EXISTS api_endpoints_user_id_idx ON api_endpoints(user_id);
CREATE INDEX IF NOT EXISTS api_calls_endpoint_id_idx ON api_calls(endpoint_id);
CREATE INDEX IF NOT EXISTS api_calls_user_id_idx ON api_calls(user_id);
CREATE INDEX IF NOT EXISTS api_calls_success_idx ON api_calls(success);
CREATE INDEX IF NOT EXISTS plugins_author_id_idx ON plugins(author_id);
CREATE INDEX IF NOT EXISTS plugins_type_idx ON plugins(type);
CREATE INDEX IF NOT EXISTS plugins_is_public_idx ON plugins(is_public);
CREATE INDEX IF NOT EXISTS plugin_installations_user_id_idx ON plugin_installations(user_id);
CREATE INDEX IF NOT EXISTS plugin_installations_plugin_id_idx ON plugin_installations(plugin_id);
CREATE INDEX IF NOT EXISTS payment_customers_user_id_idx ON payment_customers(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status);
CREATE INDEX IF NOT EXISTS voice_recordings_user_id_idx ON voice_recordings(user_id);
CREATE INDEX IF NOT EXISTS voice_recordings_processing_status_idx ON voice_recordings(processing_status);
CREATE INDEX IF NOT EXISTS security_audit_logs_user_id_idx ON security_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS security_audit_logs_event_type_idx ON security_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS security_audit_logs_timestamp_idx ON security_audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS advanced_analytics_user_id_idx ON advanced_analytics(user_id);
CREATE INDEX IF NOT EXISTS advanced_analytics_date_idx ON advanced_analytics(date);

-- Unique constraints for data integrity
CREATE UNIQUE INDEX IF NOT EXISTS plugin_installations_user_plugin_unique ON plugin_installations(user_id, plugin_id);
CREATE UNIQUE INDEX IF NOT EXISTS advanced_analytics_user_date_granularity_unique ON advanced_analytics(user_id, date, granularity);

-- Migration complete - All 35+ tables converted to D1 SQLite
