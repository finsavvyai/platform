-- UPM.Plus Analytics Tables
-- Production schema for advanced analytics

-- Analytics Metrics Table
CREATE TABLE IF NOT EXISTS analytics_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    provider_id INTEGER,
    resource_id TEXT,
    resource_type TEXT,
    metric_name TEXT NOT NULL,
    metric_type TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT,
    tags TEXT, -- JSON string
    timestamp TEXT NOT NULL,
    collected_at TEXT NOT NULL,
    metadata TEXT, -- JSON string
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Anomaly Detection Table
CREATE TABLE IF NOT EXISTS anomaly_detection (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    metric_id INTEGER NOT NULL,
    provider_id INTEGER,
    resource_id TEXT,
    anomaly_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    score REAL NOT NULL,
    threshold REAL NOT NULL,
    metric_value REAL NOT NULL,
    expected_value REAL,
    deviation REAL,
    confidence REAL,
    status TEXT NOT NULL DEFAULT 'open',
    description TEXT,
    analysis_details TEXT, -- JSON string
    first_detected_at TEXT NOT NULL,
    last_detected_at TEXT NOT NULL,
    resolved_at TEXT,
    resolution_details TEXT, -- JSON string
    metadata TEXT, -- JSON string
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Predictive Models Table
CREATE TABLE IF NOT EXISTS predictive_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    provider_id INTEGER,
    model_name TEXT NOT NULL,
    model_type TEXT NOT NULL,
    target_metric TEXT NOT NULL,
    algorithm TEXT NOT NULL,
    parameters TEXT, -- JSON string
    features TEXT, -- JSON string
    model_data TEXT, -- Serialized model
    accuracy REAL,
    precision REAL,
    recall REAL,
    f1_score REAL,
    mae REAL,
    mse REAL,
    rmse REAL,
    training_data_points INTEGER,
    validation_data_points INTEGER,
    training_start_at TEXT,
    training_end_at TEXT,
    last_trained_at TEXT,
    last_prediction_at TEXT,
    status TEXT NOT NULL DEFAULT 'training',
    performance_metrics TEXT, -- JSON string
    feature_importance TEXT, -- JSON string
    training_logs TEXT,
    metadata TEXT, -- JSON string
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Performance Forecasts Table
CREATE TABLE IF NOT EXISTS performance_forecasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    provider_id INTEGER,
    model_id INTEGER NOT NULL,
    resource_id TEXT,
    metric_name TEXT NOT NULL,
    forecast_type TEXT NOT NULL,
    forecast_horizon INTEGER NOT NULL,
    forecast_values TEXT NOT NULL, -- JSON string
    confidence_intervals TEXT, -- JSON string
    forecast_start_at TEXT NOT NULL,
    forecast_end_at TEXT NOT NULL,
    model_version TEXT,
    accuracy REAL,
    mae REAL,
    mse REAL,
    rmse REAL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Intelligence Reports Table
CREATE TABLE IF NOT EXISTS intelligence_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    provider_id INTEGER,
    report_name TEXT NOT NULL,
    report_type TEXT NOT NULL,
    description TEXT,
    executive_summary TEXT,
    analysis_period_start TEXT NOT NULL,
    analysis_period_end TEXT NOT NULL,
    total_metrics_analyzed INTEGER NOT NULL,
    anomalies_detected INTEGER NOT NULL,
    predictions_generated INTEGER NOT NULL,
    key_insights TEXT NOT NULL, -- JSON string
    charts_data TEXT NOT NULL, -- JSON string
    recommendations TEXT NOT NULL, -- JSON string
    action_items TEXT, -- JSON string
    data_sources TEXT, -- JSON string
    methodology TEXT,
    confidence_level REAL,
    report_metadata TEXT, -- JSON string
    status TEXT NOT NULL DEFAULT 'completed',
    generated_at TEXT NOT NULL,
    expires_at TEXT,
    metadata TEXT, -- JSON string
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insight Patterns Table
CREATE TABLE IF NOT EXISTS insight_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    provider_id INTEGER,
    pattern_name TEXT NOT NULL,
    pattern_type TEXT NOT NULL,
    description TEXT,
    pattern_data TEXT NOT NULL, -- JSON string
    frequency INTEGER NOT NULL,
    confidence REAL NOT NULL,
    significance REAL NOT NULL,
    recommendations TEXT, -- JSON string
    last_seen_at TEXT NOT NULL,
    times_detected INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    metadata TEXT, -- JSON string
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Anomaly Alerts Table
CREATE TABLE IF NOT EXISTS anomaly_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    anomaly_id INTEGER NOT NULL,
    provider_id INTEGER,
    resource_id TEXT,
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    description TEXT,
    action_required TEXT,
    recommendations TEXT, -- JSON string
    threshold_value REAL,
    actual_value REAL,
    trigger_conditions TEXT, -- JSON string
    context_data TEXT, -- JSON string
    status TEXT NOT NULL DEFAULT 'open',
    acknowledged_at TEXT,
    acknowledged_by TEXT,
    escalation_level INTEGER NOT NULL DEFAULT 0,
    escalation_notified_at TEXT,
    resolved_at TEXT,
    resolution_method TEXT,
    metadata TEXT, -- JSON string
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Multi-Cloud Providers Table
CREATE TABLE IF NOT EXISTS multi_cloud_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    provider_name TEXT NOT NULL,
    provider_type TEXT NOT NULL,
    credentials TEXT NOT NULL, -- Encrypted JSON
    configuration TEXT, -- JSON string
    status TEXT NOT NULL DEFAULT 'active',
    last_verified_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Multi-Cloud Resources Table
CREATE TABLE IF NOT EXISTS multi_cloud_resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    provider_id INTEGER NOT NULL,
    resource_id TEXT NOT NULL,
    resource_name TEXT,
    resource_type TEXT NOT NULL,
    resource_region TEXT,
    resource_status TEXT,
    configuration TEXT, -- JSON string
    tags TEXT, -- JSON string
    metadata TEXT, -- JSON string
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    plan TEXT NOT NULL DEFAULT 'basic',
    status TEXT NOT NULL DEFAULT 'active',
    settings TEXT, -- JSON string
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    email TEXT UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    status TEXT NOT NULL DEFAULT 'active',
    last_login_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_tenant_timestamp ON analytics_metrics(tenant_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_metric_type ON analytics_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_anomaly_detection_tenant_severity ON anomaly_detection(tenant_id, severity);
CREATE INDEX IF NOT EXISTS idx_anomaly_detection_status ON anomaly_detection(status);
CREATE INDEX IF NOT EXISTS idx_predictive_models_tenant_type ON predictive_models(tenant_id, model_type);
CREATE INDEX IF NOT EXISTS idx_performance_forecasts_tenant_metric ON performance_forecasts(tenant_id, metric_name);
CREATE INDEX IF NOT EXISTS idx_intelligence_reports_tenant_type ON intelligence_reports(tenant_id, report_type);
CREATE INDEX IF NOT EXISTS idx_insight_patterns_tenant_type ON insight_patterns(tenant_id, pattern_type);
CREATE INDEX IF NOT EXISTS idx_anomaly_alerts_tenant_severity ON anomaly_alerts(tenant_id, severity);
CREATE INDEX IF NOT EXISTS idx_multi_cloud_resources_provider ON multi_cloud_resources(provider_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email);