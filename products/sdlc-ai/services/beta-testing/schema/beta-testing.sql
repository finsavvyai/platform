-- Beta Testing Program Schema
-- Supports comprehensive beta testing, feedback collection, and user management

-- Beta Users Table
CREATE TABLE IF NOT EXISTS beta_users (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    company TEXT,
    role TEXT,
    experience TEXT NOT NULL CHECK (experience IN ('beginner', 'intermediate', 'expert')),
    use_case TEXT NOT NULL,
    application_status TEXT NOT NULL DEFAULT 'pending' CHECK (application_status IN ('pending', 'approved', 'rejected', 'active', 'completed', 'suspended')),
    testing_phase TEXT DEFAULT 'onboarding' CHECK (testing_phase IN ('onboarding', 'core', 'advanced', 'load', 'integration')),
    join_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_date DATETIME,
    feedback_count INTEGER DEFAULT 0,
    bugs_reported INTEGER DEFAULT 0,
    reward_credits INTEGER DEFAULT 0,
    engagement_score INTEGER DEFAULT 0,
    last_active_date DATETIME,
    survey_responses TEXT, -- JSON
    notes TEXT,
    referral_source TEXT,
    beta_agreement_signed BOOLEAN DEFAULT FALSE,
    beta_agreement_signed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Beta Feedback Table
CREATE TABLE IF NOT EXISTS beta_feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('bug', 'feature', 'usability', 'performance', 'general', 'security')),
    category TEXT NOT NULL CHECK (category IN ('critical', 'high', 'medium', 'low')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    context TEXT, -- JSON with additional context
    attachments TEXT, -- JSON array of attachment URLs
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'triaged', 'in-progress', 'resolved', 'closed', 'deferred', 'duplicate')),
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
    assigned_to TEXT,
    response TEXT,
    user_response TEXT,
    helpful BOOLEAN,
    internal_notes TEXT,
    duplicate_of TEXT,
    related_issues TEXT, -- JSON array of related issue IDs
    reproduction_steps TEXT, -- JSON array
    environment_details TEXT, -- JSON
    logs TEXT, -- URLs to log files
    screenshots TEXT, -- JSON array of screenshot URLs
    video_recording TEXT, -- URL to screen recording
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,

    FOREIGN KEY (user_id) REFERENCES beta_users(user_id),
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    FOREIGN KEY (duplicate_of) REFERENCES beta_feedback(id)
);

-- Testing Scenarios Table
CREATE TABLE IF NOT EXISTS beta_testing_scenarios (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    phase TEXT NOT NULL CHECK (phase IN ('onboarding', 'core', 'advanced', 'load', 'integration')),
    category TEXT NOT NULL CHECK (category IN ('integration', 'security', 'performance', 'usability', 'feature')),
    steps TEXT NOT NULL, -- JSON array of steps
    expected_outcome TEXT NOT NULL,
    completion_points INTEGER DEFAULT 10,
    estimated_time INTEGER NOT NULL, -- in minutes
    difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    prerequisites TEXT, -- JSON array of prerequisite scenario IDs
    tags TEXT, -- JSON array of tags
    active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Scenario Completions Table
CREATE TABLE IF NOT EXISTS beta_scenario_completions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    scenario_id TEXT NOT NULL,
    completion_data TEXT, -- JSON with completion details
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    time_spent INTEGER, -- in minutes
    success BOOLEAN,
    notes TEXT,
    attachments TEXT, -- JSON array of attachment URLs
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES beta_users(user_id),
    FOREIGN KEY (scenario_id) REFERENCES beta_testing_scenarios(id),
    UNIQUE(user_id, scenario_id)
);

-- Survey Responses Table
CREATE TABLE IF NOT EXISTS beta_survey_responses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    survey_id TEXT NOT NULL,
    survey_type TEXT NOT NULL CHECK (survey_type IN ('nps', 'satisfaction', 'feature', 'exit', 'weekly')),
    responses TEXT NOT NULL, -- JSON with all responses
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    would_recommend BOOLEAN,
    comments TEXT,
    sentiment_score REAL, -- -1 to 1
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES beta_users(user_id)
);

-- Beta Activities Table
CREATE TABLE IF NOT EXISTS beta_activities (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    activity_data TEXT, -- JSON with activity details
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES beta_users(user_id)
);

-- Beta Invitations Table
CREATE TABLE IF NOT EXISTS beta_invitations (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    invited_by TEXT,
    invitation_token TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    invited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    accepted_at DATETIME,
    expires_at DATETIME NOT NULL,
    referral_code TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (invited_by) REFERENCES beta_users(user_id)
);

-- Beta Rewards Table
CREATE TABLE IF NOT EXISTS beta_rewards (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    reward_type TEXT NOT NULL CHECK (reward_type IN ('feedback', 'bug', 'scenario', 'survey', 'referral')),
    reward_amount INTEGER NOT NULL,
    description TEXT,
    related_entity_id TEXT, -- e.g., feedback_id, scenario_id
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    used BOOLEAN DEFAULT FALSE,
    used_at DATETIME,

    FOREIGN KEY (user_id) REFERENCES beta_users(user_id)
);

-- Beta Metrics Aggregation Table
CREATE TABLE IF NOT EXISTS beta_metrics_daily (
    date DATE PRIMARY KEY,
    total_users INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,
    churned_users INTEGER DEFAULT 0,
    total_feedback INTEGER DEFAULT 0,
    bugs_reported INTEGER DEFAULT 0,
    scenarios_completed INTEGER DEFAULT 0,
    avg_engagement_score REAL DEFAULT 0,
    avg_satisfaction_score REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Beta Phase Progress Table
CREATE TABLE IF NOT EXISTS beta_phase_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    phase TEXT NOT NULL,
    started_at DATETIME NOT NULL,
    completed_at DATETIME,
    total_scenarios INTEGER DEFAULT 0,
    completed_scenarios INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES beta_users(user_id),
    UNIQUE(user_id, phase)
);

-- Beta Communication Log Table
CREATE TABLE IF NOT EXISTS beta_communications (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    type TEXT NOT NULL CHECK (type IN ('email', 'in_app', 'push', 'sms')),
    category TEXT NOT NULL CHECK (category IN ('onboarding', 'announcement', 'feedback', 'reminder', 'alert')),
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'sent' CHECK (status IN ('draft', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')),
    sent_at DATETIME,
    delivered_at DATETIME,
    opened_at DATETIME,
    clicked_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES beta_users(user_id)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_beta_users_user_id ON beta_users(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_users_email ON beta_users(email);
CREATE INDEX IF NOT EXISTS idx_beta_users_status ON beta_users(application_status);
CREATE INDEX IF NOT EXISTS idx_beta_users_phase ON beta_users(testing_phase);
CREATE INDEX IF NOT EXISTS idx_beta_users_join_date ON beta_users(join_date);

CREATE INDEX IF NOT EXISTS idx_beta_feedback_user_id ON beta_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_type ON beta_feedback(type);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_status ON beta_feedback(status);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_priority ON beta_feedback(priority);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_created_at ON beta_feedback(created_at);

CREATE INDEX IF NOT EXISTS idx_beta_scenario_completions_user_id ON beta_scenario_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_scenario_completions_scenario_id ON beta_scenario_completions(scenario_id);
CREATE INDEX IF NOT EXISTS idx_beta_scenario_completions_completed_at ON beta_scenario_completions(completed_at);

CREATE INDEX IF NOT EXISTS idx_beta_survey_responses_user_id ON beta_survey_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_survey_responses_survey_id ON beta_survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_beta_survey_responses_created_at ON beta_survey_responses(created_at);

CREATE INDEX IF NOT EXISTS idx_beta_activities_user_id ON beta_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_activities_type ON beta_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_beta_activities_created_at ON beta_activities(created_at);

-- Triggers for automatic updates
CREATE TRIGGER IF NOT EXISTS update_beta_users_timestamp
    AFTER UPDATE ON beta_users
    FOR EACH ROW
    BEGIN
        UPDATE beta_users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_beta_feedback_timestamp
    AFTER UPDATE ON beta_feedback
    FOR EACH ROW
    BEGIN
        UPDATE beta_feedback SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Insert default testing scenarios
INSERT OR IGNORE INTO beta_testing_scenarios (id, name, description, phase, category, steps, expected_outcome, completion_points, estimated_time) VALUES
-- Onboarding Phase Scenarios
('scenario-001', 'Account Setup and API Key Generation', 'Complete account setup and generate your first API key', 'onboarding', 'integration',
'["Log in to the beta dashboard", "Navigate to API settings", "Generate new API key", "Test API key with health check"]',
'Successfully generate and validate API key', 10, 15),

('scenario-002', 'SDK Installation and Basic Configuration', 'Install the SDLC SDK in your preferred language and configure it', 'onboarding', 'integration',
'["Choose your preferred SDK (Python/TypeScript/Go)", "Install SDK using package manager", "Configure SDK with API key", "Run connection test"]',
'SDK successfully connects to the platform', 15, 20),

('scenario-003', 'First Document Upload', 'Upload your first document to the platform', 'onboarding', 'feature',
'["Navigate to documents section", "Click upload button", "Select a test document", "Configure processing options", "Submit and monitor upload"]',
'Document successfully uploaded and processed', 20, 10),

-- Core Phase Scenarios
('scenario-004', 'Document Processing and Text Extraction', 'Test full document processing pipeline', 'core', 'feature',
'["Upload a PDF document", "Wait for processing completion", "Verify extracted text accuracy", "Check metadata extraction"]',
'Document content accurately extracted and indexed', 25, 15),

('scenario-005', 'Vector Search Implementation', 'Implement and test vector search functionality', 'core', 'feature',
'["Create a search query", "Specify search parameters", "Execute vector search", "Review search results relevance"]',
'Relevant search results returned with similarity scores', 30, 20),

('scenario-006', 'RAG Query Pipeline', 'Test the complete RAG (Retrieval-Augmented Generation) pipeline', 'core', 'feature',
'["Upload reference documents", "Create a RAG query", "Execute query with context retrieval", "Verify response includes relevant context"]',
'RAG response includes accurate context from documents', 35, 25),

('scenario-007', 'DLP Content Scanning', 'Test DLP (Data Loss Prevention) scanning and redaction', 'core', 'security',
'["Upload document with sensitive data", "Enable DLP scanning", "Review detected sensitive information", "Verify redaction is applied"]',
'Sensitive data detected and properly redacted', 40, 20),

('scenario-008', 'Multi-Tenant Data Isolation', 'Verify data isolation between different tenants', 'core', 'security',
'["Create data in Tenant A", "Switch to Tenant B", "Verify no access to Tenant A data", "Test cross-tenant query restrictions"]',
'Complete data isolation with no leakage', 50, 30),

-- Advanced Phase Scenarios
('scenario-009', 'Custom Embedding Models', 'Test integration with custom embedding models', 'advanced', 'feature',
'["Configure custom embedding model", "Upload test documents", "Generate embeddings with custom model", "Compare results with default model"]',
'Custom embeddings generated and functional', 45, 40),

('scenario-010', 'Batch Document Processing', 'Test bulk document processing capabilities', 'advanced', 'performance',
'["Prepare batch of 100+ documents", "Initiate batch processing", "Monitor processing progress", "Verify all documents processed"]',
'Batch processing completes successfully for all documents', 60, 60),

('scenario-011', 'Custom Policy Configuration', 'Create and test custom access policies', 'advanced', 'security',
'["Navigate to policy editor", "Create custom policy rules", "Apply policy to resources", "Test policy enforcement"]',
'Custom policies correctly enforce access rules', 55, 35),

-- Load Testing Phase Scenarios
('scenario-012', 'Concurrent User Load Test', 'Test system performance under concurrent load', 'load', 'performance',
'["Generate 100 concurrent API requests", "Monitor response times", "Check error rates", "Verify system stability"]',
'System maintains performance under load', 100, 45),

('scenario-013', 'Large Document Processing', 'Test processing of large documents (>100MB)', 'load', 'performance',
'["Upload large document", "Monitor processing progress", "Verify successful completion", "Check memory usage"]',
'Large documents processed without timeouts', 80, 90),

('scenario-014', 'Complex Query Performance', 'Test performance of complex multi-stage queries', 'load', 'performance',
'["Create complex query with multiple filters", "Execute query with large dataset", "Measure response time", "Optimize if needed"]',
'Complex queries complete within acceptable time', 70, 40),

-- Integration Phase Scenarios
('scenario-015', 'End-to-End Application Integration', 'Build complete application using SDLC platform', 'integration', 'integration',
'["Design application architecture", "Implement authentication", "Integrate document upload", "Add search functionality", "Implement RAG features", "Test complete workflow"]',
'Full application successfully integrated and functional', 150, 180);

-- Insert initial beta metrics
INSERT OR IGNORE INTO beta_metrics_daily (date) VALUES
(CURRENT_DATE - INTERVAL '7 day'),
(CURRENT_DATE - INTERVAL '6 day'),
(CURRENT_DATE - INTERVAL '5 day'),
(CURRENT_DATE - INTERVAL '4 day'),
(CURRENT_DATE - INTERVAL '3 day'),
(CURRENT_DATE - INTERVAL '2 day'),
(CURRENT_DATE - INTERVAL '1 day'),
(CURRENT_DATE);
