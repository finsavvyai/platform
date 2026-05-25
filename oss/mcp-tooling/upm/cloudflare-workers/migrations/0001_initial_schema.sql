-- UPM Cloudflare D1 Database Initial Schema
-- This migration creates the initial database schema for UPM

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    organization_id TEXT NOT NULL,
    repository_url TEXT,
    language TEXT,
    build_system TEXT,
    last_analysis INTEGER,
    total_dependencies INTEGER DEFAULT 0,
    vulnerability_count INTEGER DEFAULT 0,
    policy_violation_count INTEGER DEFAULT 0,
    compliance_score REAL DEFAULT 0.0,
    tags TEXT, -- JSON array
    metadata TEXT, -- JSON object
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Dependencies table
CREATE TABLE IF NOT EXISTS dependencies (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    group_id TEXT,
    artifact_id TEXT NOT NULL,
    version TEXT NOT NULL,
    scope TEXT DEFAULT 'compile',
    type TEXT DEFAULT 'jar',
    ecosystem TEXT NOT NULL,
    file_path TEXT,
    line_number INTEGER,
    is_direct INTEGER DEFAULT 1,
    transitive_dependencies TEXT, -- JSON array
    license TEXT,
    size INTEGER,
    download_count INTEGER,
    last_updated INTEGER,
    metadata TEXT, -- JSON object
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Vulnerabilities table
CREATE TABLE IF NOT EXISTS vulnerabilities (
    id TEXT PRIMARY KEY,
    cve_id TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    score REAL,
    vector TEXT,
    affected_versions TEXT NOT NULL, -- JSON array
    patched_versions TEXT NOT NULL, -- JSON array
    published_date INTEGER,
    last_modified_date INTEGER,
    references TEXT, -- JSON array
    weaknesses TEXT, -- JSON array
    exploitability TEXT,
    impact TEXT,
    remediation TEXT,
    metadata TEXT, -- JSON object
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Dependency vulnerabilities junction table
CREATE TABLE IF NOT EXISTS dependency_vulnerabilities (
    dependency_id TEXT NOT NULL,
    vulnerability_id TEXT NOT NULL,
    detected_at INTEGER DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (dependency_id, vulnerability_id),
    FOREIGN KEY (dependency_id) REFERENCES dependencies(id) ON DELETE CASCADE,
    FOREIGN KEY (vulnerability_id) REFERENCES vulnerabilities(id) ON DELETE CASCADE
);

-- Policies table
CREATE TABLE IF NOT EXISTS policies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    framework TEXT, -- SOX, HIPAA, PCI-DSS, GDPR, etc.
    rules TEXT NOT NULL, -- JSON array of policy rules
    is_active INTEGER DEFAULT 1,
    organization_id TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Policy violations table
CREATE TABLE IF NOT EXISTS policy_violations (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    policy_id TEXT NOT NULL,
    rule_id TEXT NOT NULL,
    dependency_id TEXT,
    severity TEXT NOT NULL CHECK (severity IN ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RESOLVED', 'FALSE_POSITIVE', 'EXCEPTION_GRANTED')),
    actual_value TEXT,
    expected_value TEXT,
    detected_at INTEGER DEFAULT (strftime('%s', 'now')),
    resolved_at INTEGER,
    resolved_by TEXT,
    resolution_note TEXT,
    metadata TEXT, -- JSON object
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE CASCADE,
    FOREIGN KEY (dependency_id) REFERENCES dependencies(id) ON DELETE SET NULL
);

-- Exception requests table
CREATE TABLE IF NOT EXISTS exception_requests (
    id TEXT PRIMARY KEY,
    violation_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    requested_by TEXT NOT NULL,
    reason TEXT NOT NULL,
    type TEXT DEFAULT 'TEMPORARY' CHECK (type IN ('TEMPORARY', 'PERMANENT', 'ONE_TIME_BUILD')),
    duration INTEGER, -- days
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED')),
    submitted_at INTEGER DEFAULT (strftime('%s', 'now')),
    reviewed_at INTEGER,
    reviewed_by TEXT,
    review_comment TEXT,
    expires_at INTEGER,
    metadata TEXT, -- JSON object
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (violation_id) REFERENCES policy_violations(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Users table (for authentication)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user', 'readonly')),
    organization_id TEXT,
    is_active INTEGER DEFAULT 1,
    last_login INTEGER,
    metadata TEXT, -- JSON object
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

-- Analysis results cache table
CREATE TABLE IF NOT EXISTS analysis_cache (
    project_id TEXT PRIMARY KEY,
    analysis_result TEXT NOT NULL, -- JSON object
    cache_key TEXT,
    expires_at INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- API rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
    client_id TEXT PRIMARY KEY,
    request_count INTEGER DEFAULT 0,
    window_start INTEGER DEFAULT (strftime('%s', 'now')),
    reset_at INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_last_analysis ON projects(last_analysis);
CREATE INDEX IF NOT EXISTS idx_dependencies_project_id ON dependencies(project_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_ecosystem ON dependencies(ecosystem);
CREATE INDEX IF NOT EXISTS idx_dependencies_group_artifact ON dependencies(group_id, artifact_id);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_severity ON vulnerabilities(severity);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_published_date ON vulnerabilities(published_date);
CREATE INDEX IF NOT EXISTS idx_dependency_vulnerabilities_dependency_id ON dependency_vulnerabilities(dependency_id);
CREATE INDEX IF NOT EXISTS idx_dependency_vulnerabilities_vulnerability_id ON dependency_vulnerabilities(vulnerability_id);
CREATE INDEX IF NOT EXISTS idx_policy_violations_project_id ON policy_violations(project_id);
CREATE INDEX IF NOT EXISTS idx_policy_violations_policy_id ON policy_violations(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_violations_severity ON policy_violations(severity);
CREATE INDEX IF NOT EXISTS idx_policy_violations_status ON policy_violations(status);
CREATE INDEX IF NOT EXISTS idx_exception_requests_status ON exception_requests(status);
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_analysis_cache_expires_at ON analysis_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_client_id ON rate_limits(client_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits(reset_at);

-- Insert default data
INSERT OR IGNORE INTO organizations (id, name, slug, description) VALUES
    ('default-org', 'Default Organization', 'default', 'Default organization for new users');

INSERT OR IGNORE INTO policies (id, name, description, framework, rules, is_active) VALUES
    ('security-policy', 'Default Security Policy', 'Basic security policy for all projects', 'SECURITY',
     '[{"rule": "no_critical_vulnerabilities", "description": "No critical vulnerabilities allowed", "severity": "CRITICAL"},
       {"rule": "max_high_vulnerabilities", "description": "Maximum 5 high vulnerabilities", "severity": "HIGH", "limit": 5}]', 1);

INSERT OR IGNORE INTO users (id, email, name, role, organization_id) VALUES
    ('admin-user', 'admin@upm.plus', 'UPM Administrator', 'admin', 'default-org');

-- Create triggers for updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_organizations_updated_at
    AFTER UPDATE ON organizations
    BEGIN
        UPDATE organizations SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_projects_updated_at
    AFTER UPDATE ON projects
    BEGIN
        UPDATE projects SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_dependencies_updated_at
    AFTER UPDATE ON dependencies
    BEGIN
        UPDATE dependencies SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_vulnerabilities_updated_at
    AFTER UPDATE ON vulnerabilities
    BEGIN
        UPDATE vulnerabilities SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_policy_violations_updated_at
    AFTER UPDATE ON policy_violations
    BEGIN
        UPDATE policy_violations SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_exception_requests_updated_at
    AFTER UPDATE ON exception_requests
    BEGIN
        UPDATE exception_requests SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_users_updated_at
    AFTER UPDATE ON users
    BEGIN
        UPDATE users SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
    END;
