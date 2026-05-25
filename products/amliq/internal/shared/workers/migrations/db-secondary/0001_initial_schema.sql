-- DB_SECONDARY Database Schema
-- Contains: risk_*, organizations, audit_logs, api_keys, user_sessions tables

-- Organizations table (shared across all products)
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT UNIQUE,
    region TEXT CHECK(region IN ('US', 'EU')) NOT NULL,
    subscription_tier TEXT CHECK(tier IN ('free', 'starter', 'professional', 'enterprise')) DEFAULT 'free',
    settings TEXT, -- JSON for flexible configuration
    billing_info TEXT, -- JSON
    compliance_info TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    trial_ends_at DATETIME,

    -- Indexes
    INDEX idx_organizations_region (region),
    INDEX idx_organizations_tier (subscription_tier),
    INDEX idx_organizations_domain (domain),
    INDEX idx_organizations_active (is_active)
);

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    refresh_token TEXT UNIQUE,
    ip_address TEXT,
    user_agent TEXT,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,

    -- Foreign keys
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_user_sessions_user (user_id),
    INDEX idx_user_sessions_org (organization_id),
    INDEX idx_user_sessions_token (session_token),
    INDEX idx_user_sessions_expires (expires_at),
    INDEX idx_user_sessions_active (is_active)
);

-- API keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    key_hash TEXT UNIQUE NOT NULL, -- Hashed API key
    key_prefix TEXT NOT NULL, -- First few characters for identification
    permissions TEXT, -- JSON array of permissions
    rate_limit INTEGER DEFAULT 1000, -- Requests per hour
    allowed_ips TEXT, -- JSON array of allowed IP addresses
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    last_used_at DATETIME,
    is_active BOOLEAN DEFAULT true,

    -- Foreign keys
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_api_keys_org (organization_id),
    INDEX idx_api_keys_hash (key_hash),
    INDEX idx_api_keys_prefix (key_prefix),
    INDEX idx_api_keys_active (is_active),
    INDEX idx_api_keys_expires (expires_at)
);

-- Unified audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    trace_id TEXT NOT NULL, -- For distributed tracing
    organization_id TEXT NOT NULL,
    user_id TEXT,
    service TEXT NOT NULL, -- 'billing', 'compliance', 'intelligence', 'risk'
    action TEXT NOT NULL, -- 'create', 'update', 'delete', 'read', etc.
    resource_type TEXT NOT NULL, -- 'invoice', 'customer', 'case', etc.
    resource_id TEXT NOT NULL,

    -- Change tracking
    old_value TEXT, -- JSON
    new_value TEXT, -- JSON

    -- Metadata
    ip_address TEXT,
    user_agent TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Compliance
    data_classification TEXT CHECK(classification IN ('public', 'internal', 'confidential', 'restricted')) DEFAULT 'internal',
    retention_until DATETIME,

    -- Indexes
    INDEX idx_audit_organization (organization_id),
    INDEX idx_audit_trace (trace_id),
    INDEX idx_audit_timestamp (timestamp),
    INDEX idx_audit_action (action),
    INDEX idx_audit_resource (resource_type, resource_id),
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_retention (retention_until)
);

-- Risk management tables
CREATE TABLE IF NOT EXISTS risk_events (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'transaction', 'login', 'api_call', etc.
    event_id TEXT NOT NULL UNIQUE, -- Deduplication key
    user_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    device_fingerprint TEXT,
    geolocation TEXT, -- JSON
    event_data TEXT, -- JSON
    risk_score INTEGER CHECK(risk_score >= 0 AND risk_score <= 1000),
    confidence_score REAL CHECK(confidence_score >= 0 AND confidence_score <= 1),
    status TEXT CHECK(status IN ('pending', 'processing', 'completed', 'escalated')) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,

    -- Indexes
    INDEX idx_risk_events_org (organization_id),
    INDEX idx_risk_events_type (event_type),
    INDEX idx_risk_events_user (user_id),
    INDEX idx_risk_events_score (risk_score),
    INDEX idx_risk_events_status (status),
    INDEX idx_risk_events_created (created_at),
    INDEX idx_risk_events_unique (event_id)
);

CREATE TABLE IF NOT EXISTS risk_assessments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    assessment_type TEXT NOT NULL, -- 'transaction_risk', 'fraud_detection', 'aml_screening'
    model_version TEXT NOT NULL,
    risk_score INTEGER CHECK(risk_score >= 0 AND risk_score <= 1000),
    confidence_score REAL CHECK(confidence_score >= 0 AND confidence_score <= 1),
    risk_level TEXT CHECK(risk_level IN ('low', 'medium', 'high', 'critical')),
    features TEXT, -- JSON of calculated features
    explanation TEXT, -- JSON of SHAP values or feature importance
    recommendation TEXT, -- 'accept', 'review', 'decline', 'escalate'
    automated_decision BOOLEAN DEFAULT true,
    reviewed_by TEXT,
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Foreign keys
    FOREIGN KEY (event_id) REFERENCES risk_events(id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_risk_assessments_org (organization_id),
    INDEX idx_risk_assessments_event (event_id),
    INDEX idx_risk_assessments_type (assessment_type),
    INDEX idx_risk_assessments_score (risk_score),
    INDEX idx_risk_assessments_level (risk_level),
    INDEX idx_risk_assessments_created (created_at)
);

CREATE TABLE IF NOT EXISTS risk_cases (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    case_number TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    case_type TEXT CHECK(case_type IN ('fraud', 'aml', 'sanctions', 'compliance', 'security_breach')) NOT NULL,
    severity TEXT CHECK(severity IN ('low', 'medium', 'high', 'critical')) NOT NULL,
    status TEXT CHECK(status IN ('open', 'under_investigation', 'escalated', 'resolved', 'closed')) DEFAULT 'open',
    priority INTEGER CHECK(priority >= 1 AND priority <= 5) DEFAULT 3,
    assigned_to TEXT,
    reported_by TEXT NOT NULL,
    source_event_id TEXT,
    risk_score INTEGER CHECK(risk_score >= 0 AND risk_score <= 1000),
    financial_impact_cents INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    resolution_summary TEXT,

    -- Indexes
    INDEX idx_risk_cases_org (organization_id),
    INDEX idx_risk_cases_number (case_number),
    INDEX idx_risk_cases_type (case_type),
    INDEX idx_risk_cases_severity (severity),
    INDEX idx_risk_cases_status (status),
    INDEX idx_risk_cases_priority (priority),
    INDEX idx_risk_cases_assigned (assigned_to),
    INDEX idx_risk_cases_created (created_at)
);

CREATE TABLE IF NOT EXISTS risk_case_activities (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    activity_type TEXT CHECK(activity_type IN ('note', 'assignment', 'status_change', 'evidence_added', 'escalation')) NOT NULL,
    description TEXT NOT NULL,
    details TEXT, -- JSON
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Foreign keys
    FOREIGN KEY (case_id) REFERENCES risk_cases(id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_risk_activities_case (case_id),
    INDEX idx_risk_activities_type (activity_type),
    INDEX idx_risk_activities_created (created_at),
    INDEX idx_risk_activities_creator (created_by)
);

CREATE TABLE IF NOT EXISTS risk_alerts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    alert_type TEXT NOT NULL, -- 'unusual_activity', 'high_risk_transaction', 'pattern_detected'
    alert_level TEXT CHECK(alert_level IN ('info', 'warning', 'error', 'critical')) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    source_type TEXT, -- 'automated', 'manual', 'external'
    source_id TEXT,
    reference_type TEXT, -- 'transaction', 'user', 'account'
    reference_id TEXT,
    alert_data TEXT, -- JSON
    acknowledged_by TEXT,
    acknowledged_at DATETIME,
    resolved_by TEXT,
    resolved_at DATETIME,
    resolution TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,

    -- Indexes
    INDEX idx_risk_alerts_org (organization_id),
    INDEX idx_risk_alerts_type (alert_type),
    INDEX idx_risk_alerts_level (alert_level),
    INDEX idx_risk_alerts_status (resolved_at IS NULL),
    INDEX idx_risk_alerts_reference (reference_type, reference_id),
    INDEX idx_risk_alerts_created (created_at)
);

CREATE TABLE IF NOT EXISTS risk_models (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    version TEXT NOT NULL,
    model_type TEXT CHECK(model_type IN ('classification', 'regression', 'anomaly_detection', 'ensemble')) NOT NULL,
    description TEXT,
    target_variable TEXT,
    features TEXT, -- JSON array of feature names
    hyperparameters TEXT, -- JSON
    performance_metrics TEXT, -- JSON with accuracy, precision, recall, etc.
    training_data_info TEXT, -- JSON with training data statistics
    model_artifact_url TEXT, -- R2 URL for model file
    is_active BOOLEAN DEFAULT false,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    trained_at DATETIME,
    deployed_at DATETIME,

    -- Indexes
    INDEX idx_risk_models_name (name),
    INDEX idx_risk_models_type (model_type),
    INDEX idx_risk_models_active (is_active),
    INDEX idx_risk_models_deployed (deployed_at)
);

CREATE TABLE IF NOT EXISTS risk_model_performance (
    id TEXT PRIMARY KEY,
    model_id TEXT NOT NULL,
    evaluation_date DATE NOT NULL,
    accuracy REAL CHECK(accuracy >= 0 AND accuracy <= 1),
    precision REAL CHECK(precision >= 0 AND precision <= 1),
    recall REAL CHECK(recall >= 0 AND recall <= 1),
    f1_score REAL CHECK(f1_score >= 0 AND f1_score <= 1),
    auc_roc REAL CHECK(auc_roc >= 0 AND auc_roc <= 1),
    confusion_matrix TEXT, -- JSON
    sample_size INTEGER NOT NULL,
    evaluation_set TEXT CHECK(evaluation_set IN ('training', 'validation', 'test', 'production')),
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Foreign keys
    FOREIGN KEY (model_id) REFERENCES risk_models(id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_risk_model_performance_model (model_id),
    INDEX idx_risk_model_performance_date (evaluation_date),
    INDEX idx_risk_model_performance_set (evaluation_set)
);

CREATE TABLE IF NOT EXISTS risk_rules (
    id TEXT PRIMARY KEY,
    organization_id TEXT, -- NULL for global rules
    name TEXT NOT NULL,
    description TEXT,
    rule_type TEXT CHECK(rule_type IN ('threshold', 'pattern', 'velocity', 'blacklist')) NOT NULL,
    conditions TEXT NOT NULL, -- JSON with rule conditions
    actions TEXT NOT NULL, -- JSON with actions to take
    priority INTEGER CHECK(priority >= 1 AND priority <= 10) DEFAULT 5,
    is_active BOOLEAN DEFAULT true,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Indexes
    INDEX idx_risk_rules_org (organization_id),
    INDEX idx_risk_rules_type (rule_type),
    INDEX idx_risk_rules_priority (priority),
    INDEX idx_risk_rules_active (is_active)
);

-- Feature engineering tables
CREATE TABLE IF NOT EXISTS risk_features (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    entity_id TEXT NOT NULL, -- user_id, transaction_id, etc.
    entity_type TEXT NOT NULL, -- 'user', 'transaction', 'device', 'ip_address'
    feature_name TEXT NOT NULL,
    feature_value REAL,
    feature_category TEXT, -- 'velocity', 'behavioral', 'demographic', etc.
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,

    -- Indexes
    INDEX idx_risk_features_org (organization_id),
    INDEX idx_risk_features_entity (entity_type, entity_id),
    INDEX idx_risk_features_name (feature_name),
    INDEX idx_risk_features_category (feature_category),
    INDEX idx_risk_features_calculated (calculated_at),
    INDEX idx_risk_features_expires (expires_at)
);

CREATE TABLE IF NOT EXISTS risk_patterns (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    pattern_name TEXT NOT NULL,
    pattern_type TEXT CHECK(pattern_type IN ('fraud_pattern', 'behavioral_pattern', 'anomaly_pattern')) NOT NULL,
    description TEXT,
    indicators TEXT NOT NULL, -- JSON array of pattern indicators
    confidence_threshold REAL DEFAULT 0.8,
    is_active BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Indexes
    INDEX idx_risk_patterns_org (organization_id),
    INDEX idx_risk_patterns_type (pattern_type),
    INDEX idx_risk_patterns_active (is_active)
);

-- System monitoring and health checks
CREATE TABLE IF NOT EXISTS system_health (
    id TEXT PRIMARY KEY,
    service_name TEXT NOT NULL,
    component TEXT NOT NULL, -- 'database', 'api', 'worker', 'queue'
    status TEXT CHECK(status IN ('healthy', 'degraded', 'unhealthy', 'unknown')) NOT NULL,
    response_time_ms INTEGER,
    error_rate REAL,
    last_check DATETIME DEFAULT CURRENT_TIMESTAMP,
    details TEXT, -- JSON
    alert_threshold INTEGER,

    -- Indexes
    INDEX idx_system_health_service (service_name),
    INDEX idx_system_health_component (component),
    INDEX idx_system_health_status (status),
    INDEX idx_system_health_check (last_check)
);
