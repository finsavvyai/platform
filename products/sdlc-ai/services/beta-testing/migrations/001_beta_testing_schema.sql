-- Beta Testing Program Schema
-- Manages beta users, feedback, testing scenarios, and program analytics

-- Beta Users Table
CREATE TABLE IF NOT EXISTS beta_users (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    company TEXT,
    role TEXT,
    experience TEXT CHECK (experience IN ('beginner', 'intermediate', 'expert')) NOT NULL,
    use_case TEXT NOT NULL,
    application_status TEXT CHECK (application_status IN ('pending', 'approved', 'rejected', 'active', 'completed')) DEFAULT 'pending',
    testing_phase TEXT CHECK (testing_phase IN ('onboarding', 'core', 'advanced', 'load', 'integration')) DEFAULT 'onboarding',
    join_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_date DATETIME,
    feedback_count INTEGER DEFAULT 0,
    bugs_reported INTEGER DEFAULT 0,
    reward_credits INTEGER DEFAULT 0,
    engagement_score INTEGER DEFAULT 0,
    last_active_date DATETIME,
    survey_responses TEXT, -- JSON
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Beta Feedback Table
CREATE TABLE IF NOT EXISTS beta_feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT CHECK (type IN ('bug', 'feature', 'usability', 'performance', 'general')) NOT NULL,
    category TEXT CHECK (category IN ('critical', 'high', 'medium', 'low')) NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    context TEXT, -- JSON with additional context
    attachments TEXT, -- JSON array of attachment URLs
    status TEXT CHECK (status IN ('new', 'triaged', 'in-progress', 'resolved', 'closed', 'deferred')) DEFAULT 'new',
    priority TEXT CHECK (priority IN ('urgent', 'high', 'normal', 'low')) DEFAULT 'normal',
    assigned_to TEXT,
    response TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    user_response TEXT,
    helpful BOOLEAN,

    FOREIGN KEY (user_id) REFERENCES beta_users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

-- Testing Scenarios Table
CREATE TABLE IF NOT EXISTS beta_testing_scenarios (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    phase TEXT CHECK (phase IN ('onboarding', 'core', 'advanced', 'load', 'integration')) NOT NULL,
    steps TEXT NOT NULL, -- JSON array of steps
    expected_outcome TEXT NOT NULL,
    completion_points INTEGER NOT NULL DEFAULT 10,
    category TEXT CHECK (category IN ('integration', 'security', 'performance', 'usability', 'feature')) NOT NULL,
    estimated_time INTEGER NOT NULL, -- in minutes
    prerequisites TEXT, -- JSON array
    active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Scenario Completions Table
CREATE TABLE IF NOT EXISTS beta_scenario_completions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    scenario_id TEXT NOT NULL,
    completion_data TEXT, -- JSON with completion details
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES beta_users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (scenario_id) REFERENCES beta_testing_scenarios(id) ON DELETE CASCADE,
    UNIQUE(user_id, scenario_id)
);

-- Beta Activities Table (Track all beta user activities)
CREATE TABLE IF NOT EXISTS beta_activities (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    activity_type TEXT NOT NULL, -- e.g., 'login', 'document_upload', 'api_call', 'feedback_submit'
    activity_data TEXT, -- JSON with activity details
    metadata TEXT, -- JSON with additional metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES beta_users(user_id) ON DELETE CASCADE
);

-- Survey Responses Table
CREATE TABLE IF NOT EXISTS beta_survey_responses (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    survey_id TEXT NOT NULL,
    responses TEXT NOT NULL, -- JSON with survey responses
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    would_recommend BOOLEAN,
    comments TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES beta_users(user_id) ON DELETE CASCADE
);

-- Beta Rewards Table
CREATE TABLE IF NOT EXISTS beta_rewards (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    reward_type TEXT NOT NULL, -- e.g., 'feedback', 'bug', 'scenario', 'survey'
    reward_amount INTEGER NOT NULL,
    description TEXT,
    reference_id TEXT, -- ID of related item (feedback_id, scenario_id, etc.)
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES beta_users(user_id) ON DELETE CASCADE
);

-- Beta Invitations Table
CREATE TABLE IF NOT EXISTS beta_invitations (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT NOT NULL,
    invited_by TEXT NOT NULL,
    invitation_token TEXT UNIQUE NOT NULL,
    status TEXT CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')) DEFAULT 'pending',
    expires_at DATETIME NOT NULL,
    accepted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Beta Metrics Aggregation Table
CREATE TABLE IF NOT EXISTS beta_metrics_daily (
    date DATE PRIMARY KEY,
    total_users INTEGER,
    active_users INTEGER,
    new_users INTEGER,
    completed_users INTEGER,
    total_feedback INTEGER,
    bugs_reported INTEGER,
    feature_requests INTEGER,
    avg_engagement_score REAL,
    nps_score REAL,
    satisfaction_score REAL,
    scenarios_completed INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_beta_users_email ON beta_users(email);
CREATE INDEX IF NOT EXISTS idx_beta_users_status ON beta_users(application_status);
CREATE INDEX IF NOT EXISTS idx_beta_users_phase ON beta_users(testing_phase);
CREATE INDEX IF NOT EXISTS idx_beta_users_join_date ON beta_users(join_date);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_user_id ON beta_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_status ON beta_feedback(status);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_type ON beta_feedback(type);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_created_at ON beta_feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_beta_scenarios_phase ON beta_testing_scenarios(phase);
CREATE INDEX IF NOT EXISTS idx_beta_scenarios_active ON beta_testing_scenarios(active);
CREATE INDEX IF NOT EXISTS idx_scenario_completions_user_id ON beta_scenario_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_scenario_completions_scenario_id ON beta_scenario_completions(scenario_id);
CREATE INDEX IF NOT EXISTS idx_beta_activities_user_id ON beta_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_activities_type ON beta_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_beta_activities_created_at ON beta_activities(created_at);
CREATE INDEX IF NOT EXISTS idx_survey_responses_user_id ON beta_survey_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey_id ON beta_survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_beta_rewards_user_id ON beta_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_invitations_email ON beta_invitations(email);
CREATE INDEX IF NOT EXISTS idx_beta_invitations_token ON beta_invitations(invitation_token);

-- Insert initial testing scenarios
INSERT OR IGNORE INTO beta_testing_scenarios (id, name, description, phase, steps, expected_outcome, completion_points, category, estimated_time, prerequisites) VALUES
-- Onboarding Phase Scenarios
('scenario-001', 'Account Setup and API Key Generation', 'Complete account setup and generate your first API key', 'onboarding',
 '["Log in to beta dashboard", "Navigate to API keys section", "Generate new API key", "Test API key with health check"]',
 'User successfully generates API key and validates it works', 20, 'usability', 15, '[]'),

('scenario-002', 'SDK Installation and First Connection', 'Install your preferred SDK and make first API call', 'onboarding',
 '["Choose SDK (Python/TypeScript/Go)", "Install SDK using package manager", "Configure SDK with API key", "Make test API call", "Verify response"]',
 'SDK installed and first successful API call made', 25, 'integration', 20, '[]'),

('scenario-003', 'Document Upload and Processing', 'Upload your first document and verify processing', 'onboarding',
 '["Prepare test document", "Use SDK to upload document", "Monitor processing status", "Verify extraction results", "Check for any redactions"]',
 'Document successfully uploaded, processed, and content extracted', 30, 'integration', 25, '[]'),

-- Core Phase Scenarios
('scenario-004', 'Vector Search Implementation', 'Implement vector search on processed documents', 'core',
 '["Upload multiple related documents", "Wait for vector indexing", "Perform semantic search query", "Verify relevant results", "Test search filters"]',
 'Vector search returns relevant documents with good accuracy', 40, 'feature', 30, '["scenario-003"]'),

('scenario-005', 'RAG Pipeline Integration', 'Build a complete RAG pipeline', 'core',
 '["Set up document collection", "Create search query", "Configure RAG parameters", "Execute RAG query", "Verify context in response"]',
 'RAG pipeline successfully retrieves and augments responses', 50, 'feature', 35, '["scenario-004"]'),

('scenario-006', 'DLP Features Testing', 'Test data loss prevention features', 'core',
 '["Upload document with PII", "Verify PII detection", "Test content redaction", "Check audit logs", "Verify compliance"]',
 'PII properly detected, redacted, and logged', 45, 'security', 30, '["scenario-003"]'),

('scenario-007', 'Multi-Tenant Isolation', 'Verify data isolation between tenants', 'core',
 '["Create data in Tenant A", "Switch to Tenant B", "Verify no access to Tenant A data", "Test cross-tenant scenarios", "Check audit trails"]',
 'Complete data isolation with no leakage', 60, 'security', 25, '[]'),

-- Advanced Phase Scenarios
('scenario-008', 'Custom Embedding Models', 'Test custom embedding model integration', 'advanced',
 '["Configure custom embedding model", "Upload test documents", "Generate custom embeddings", "Compare with default embeddings", "Measure performance"]',
 'Custom embeddings working with measurable differences', 50, 'feature', 45, '["scenario-004"]'),

('scenario-009', 'Advanced Authentication Methods', 'Test SAML/SSO integration', 'advanced',
 '["Configure SAML provider", "Set up SSO connection", "Test SSO login flow", "Verify user provisioning", "Test session management"]',
 'SSO integration working seamlessly', 70, 'security', 40, '[]'),

('scenario-010', 'Audit and Compliance Features', 'Test comprehensive audit logging', 'advanced',
 '["Perform various operations", "Check audit log completeness", "Test log immutability", "Generate compliance reports", "Verify retention policies"]',
 'All operations properly logged with tamper protection', 55, 'security', 35, '[]'),

-- Load Testing Scenarios
('scenario-011', 'Concurrent User Load Test', 'Test system under concurrent load', 'load',
 '["Set up load testing environment", "Configure 100 concurrent users", "Run sustained test for 1 hour", "Monitor performance metrics", "Check for errors"]',
 'System maintains performance under load', 80, 'performance', 60, '[]'),

('scenario-012', 'Large Document Processing', 'Test processing of large documents', 'load',
 '["Upload 10MB+ documents", "Monitor processing time", "Verify memory usage", "Check quality of extraction", "Test batch processing"]',
 'Large documents processed efficiently', 60, 'performance', 40, '["scenario-003"]'),

('scenario-013', 'High Volume API Calls', 'Test API rate limits and performance', 'load',
 '["Configure API test client", "Send 1000 requests/minute", "Monitor response times", "Check rate limiting", "Verify no errors"]',
 'API handles high volume with acceptable performance', 70, 'performance', 45, '[]'),

-- Integration Scenarios
('scenario-014', 'End-to-End Application Integration', 'Build complete application integration', 'integration',
 '["Design application architecture", "Implement full workflow", "Add error handling", "Test with real data", "Deploy to staging"]',
 'Complete application built and tested with SDLC.ai', 100, 'integration', 90, '["scenario-005", "scenario-006"]'),

('scenario-015', 'Third-Party Integration Test', 'Test integration with external services', 'integration',
 '["Configure webhook endpoints", "Set up event listeners", "Test real-time notifications", "Verify data synchronization", "Monitor for errors"]',
 'Third-party integrations working reliably', 65, 'integration', 50, '[]');

-- Create initial beta metrics record
INSERT OR IGNORE INTO beta_metrics_daily (date, total_users, active_users, new_users, completed_users, total_feedback, bugs_reported, feature_requests, avg_engagement_score, nps_score, satisfaction_score, scenarios_completed)
VALUES (DATE('now'), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

-- Create views for common queries
CREATE VIEW IF NOT EXISTS beta_user_summary AS
SELECT
    u.id,
    u.name,
    u.email,
    u.company,
    u.experience,
    u.application_status,
    u.testing_phase,
    u.join_date,
    u.feedback_count,
    u.engagement_score,
    u.reward_credits,
    COUNT(f.id) as unresolved_feedback,
    COUNT(sc.id) as completed_scenarios
FROM beta_users u
LEFT JOIN beta_feedback f ON u.user_id = f.user_id AND f.status != 'resolved'
LEFT JOIN beta_scenario_completions sc ON u.user_id = sc.user_id AND sc.completed_at IS NOT NULL
GROUP BY u.id;

CREATE VIEW IF NOT EXISTS beta_feedback_summary AS
SELECT
    f.type,
    f.category,
    f.status,
    COUNT(*) as count,
    AVG(CASE WHEN f.helpful IS NOT NULL THEN CASE WHEN f.helpful THEN 1 ELSE 0 END END) as helpful_rate
FROM beta_feedback f
GROUP BY f.type, f.category, f.status;

CREATE VIEW IF NOT EXISTS beta_phase_progress AS
SELECT
    u.testing_phase,
    COUNT(*) as total_users,
    COUNT(CASE WHEN u.last_active_date > DATE('now', '-7 days') THEN 1 END) as active_users,
    AVG(u.engagement_score) as avg_engagement,
    COUNT(sc.id) / CAST((SELECT COUNT(*) FROM beta_testing_scenarios WHERE phase = u.testing_phase AND active = true) AS REAL) as phase_completion_rate
FROM beta_users u
LEFT JOIN beta_scenario_completions sc ON u.user_id = sc.user_id
LEFT JOIN beta_testing_scenarios ts ON sc.scenario_id = ts.id AND ts.phase = u.testing_phase
WHERE u.application_status = 'active'
GROUP BY u.testing_phase;
