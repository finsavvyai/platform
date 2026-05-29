-- Policies Table
-- Store OPA policies and their metadata
CREATE TABLE IF NOT EXISTS policies (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL,
    rego_policy TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    created_by TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Create indexes for policies
CREATE INDEX IF NOT EXISTS idx_policies_tenant_id ON policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policies_type ON policies(type);
CREATE INDEX IF NOT EXISTS idx_policies_is_active ON policies(is_active);
CREATE INDEX IF NOT EXISTS idx_policies_version ON policies(version);
CREATE INDEX IF NOT EXISTS idx_policies_created_at ON policies(created_at);
CREATE INDEX IF NOT EXISTS idx_policies_created_by ON policies(created_by);

-- Policy Evaluations Table
-- Audit log for all policy evaluations
CREATE TABLE IF NOT EXISTS policy_evaluations (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    policy_id TEXT,
    user_id TEXT NOT NULL,
    request_id TEXT NOT NULL,
    decision BOOLEAN NOT NULL,
    reason TEXT,
    input_data TEXT NOT NULL,
    output_data TEXT NOT NULL,
    execution_time_ms INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for policy evaluations
CREATE INDEX IF NOT EXISTS idx_policy_evaluations_tenant_id ON policy_evaluations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policy_evaluations_policy_id ON policy_evaluations(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_evaluations_user_id ON policy_evaluations(user_id);
CREATE INDEX IF NOT EXISTS idx_policy_evaluations_decision ON policy_evaluations(decision);
CREATE INDEX IF NOT EXISTS idx_policy_evaluations_execution_time_ms ON policy_evaluations(execution_time_ms);
CREATE INDEX IF NOT EXISTS idx_policy_evaluations_created_at ON policy_evaluations(created_at);
CREATE INDEX IF NOT EXISTS idx_policy_evaluations_request_id ON policy_evaluations(request_id);

-- Policy Test Results Table
-- Store policy testing results
CREATE TABLE IF NOT EXISTS policy_test_results (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    policy_id TEXT NOT NULL,
    test_name TEXT NOT NULL,
    test_input TEXT NOT NULL,
    expected_output TEXT NOT NULL,
    actual_output TEXT NOT NULL,
    test_result TEXT NOT NULL,
    execution_time_ms INTEGER NOT NULL,
    error_message TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    created_by TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for policy test results
CREATE INDEX IF NOT EXISTS idx_policy_test_results_tenant_id ON policy_test_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policy_test_results_policy_id ON policy_test_results(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_test_results_test_result ON policy_test_results(test_result);
CREATE INDEX IF NOT EXISTS idx_policy_test_results_created_at ON policy_test_results(created_at);
CREATE INDEX IF NOT EXISTS idx_policy_test_results_created_by ON policy_test_results(created_by);

-- DLP Scans Table
-- Track DLP scanning results
CREATE TABLE IF NOT EXISTS dlp_scans (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    content_id TEXT NOT NULL,
    content_type TEXT NOT NULL,
    scan_results TEXT NOT NULL,
    risk_score REAL NOT NULL,
    action_taken TEXT NOT NULL,
    scan_duration_ms INTEGER NOT NULL,
    scan_model TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Create indexes for DLP scans
CREATE INDEX IF NOT EXISTS idx_dlp_scans_tenant_id ON dlp_scans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dlp_scans_content_id ON dlp_scans(content_id);
CREATE INDEX IF NOT EXISTS idx_dlp_scans_content_type ON dlp_scans(content_type);
CREATE INDEX IF NOT EXISTS idx_dlp_scans_risk_score ON dlp_scans(risk_score);
CREATE INDEX IF NOT EXISTS idx_dlp_scans_action_taken ON dlp_scans(action_taken);
CREATE INDEX IF NOT EXISTS idx_dlp_scans_created_at ON dlp_scans(created_at);

-- Policy Bundles Table
-- Track OPA policy bundles
CREATE TABLE IF NOT EXISTS policy_bundles (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    bundle_name TEXT NOT NULL,
    bundle_version TEXT NOT NULL,
    bundle_url TEXT NOT NULL,
    checksum TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    policies_included TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    deployed_at INTEGER,
    created_by TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for policy bundles
CREATE INDEX IF NOT EXISTS idx_policy_bundles_tenant_id ON policy_bundles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policy_bundles_bundle_name ON policy_bundles(bundle_name);
CREATE INDEX IF NOT EXISTS idx_policy_bundles_status ON policy_bundles(status);
CREATE INDEX IF NOT EXISTS idx_policy_bundles_created_at ON policy_bundles(created_at);
CREATE INDEX IF NOT EXISTS idx_policy_bundles_created_by ON policy_bundles(created_by);
