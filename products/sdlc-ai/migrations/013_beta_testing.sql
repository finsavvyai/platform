-- Beta Testing Program Database Schema
-- Migration: 013_beta_testing.sql
-- Created: 2025-11-04
-- Description: Database schema for beta testing program management

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
    application_status TEXT NOT NULL DEFAULT 'pending' CHECK (application_status IN ('pending', 'approved', 'rejected', 'active', 'completed')),
    testing_phase TEXT NOT NULL DEFAULT 'onboarding' CHECK (testing_phase IN ('onboarding', 'core', 'advanced', 'load', 'integration')),
    join_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_date DATETIME,
    feedback_count INTEGER DEFAULT 0,
    bugs_reported INTEGER DEFAULT 0,
    reward_credits INTEGER DEFAULT 0,
    engagement_score INTEGER DEFAULT 0,
    last_active_date DATETIME,
    survey_responses TEXT, -- JSON
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Beta Feedback Table
CREATE TABLE IF NOT EXISTS beta_feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('bug', 'feature', 'usability', 'performance', 'general')),
    category TEXT NOT NULL DEFAULT 'medium' CHECK (category IN ('critical', 'high', 'medium', 'low')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    context TEXT, -- JSON with additional context
    attachments TEXT, -- JSON array of attachment URLs
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'triaged', 'in-progress', 'resolved', 'closed', 'deferred')),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
    assigned_to TEXT, -- User ID of assigned team member
    response TEXT, -- Response from team
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    user_id_response TEXT, -- User's response to resolution
    helpful BOOLEAN, -- User found resolution helpful

    FOREIGN KEY (user_id) REFERENCES beta_users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

-- Testing Scenarios Table
CREATE TABLE IF NOT EXISTS beta_testing_scenarios (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    phase TEXT NOT NULL CHECK (phase IN ('onboarding', 'core', 'advanced', 'load', 'integration')),
    steps TEXT NOT NULL, -- JSON array of steps
    expected_outcome TEXT NOT NULL,
    completion_points INTEGER NOT NULL DEFAULT 10,
    category TEXT NOT NULL CHECK (category IN ('integration', 'security', 'performance', 'usability', 'feature')),
    estimated_time INTEGER NOT NULL, -- in minutes
    prerequisites TEXT, -- JSON array of prerequisites
    active BOOLEAN DEFAULT true,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Scenario Completions Table
CREATE TABLE IF NOT EXISTS beta_scenario_completions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    scenario_id TEXT NOT NULL,
    completion_data TEXT, -- JSON with completion details
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, scenario_id),
    FOREIGN KEY (user_id) REFERENCES beta_users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (scenario_id) REFERENCES beta_testing_scenarios(id) ON DELETE CASCADE
);

-- Beta Activities Table
CREATE TABLE IF NOT EXISTS beta_activities (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    activity_data TEXT, -- JSON with activity details
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES beta_users(user_id) ON DELETE CASCADE
);

-- Beta Survey Responses Table
CREATE TABLE IF NOT EXISTS beta_survey_responses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    survey_id TEXT NOT NULL,
    responses TEXT NOT NULL, -- JSON with survey responses
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    would_recommend BOOLEAN,
    comments TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES beta_users(user_id) ON DELETE CASCADE
);

-- Beta Invitations Table
CREATE TABLE IF NOT EXISTS beta_invitations (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    invited_by TEXT NOT NULL, -- User ID who invited
    invitation_token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    expires_at DATETIME NOT NULL,
    accepted_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Beta Rewards Table
CREATE TABLE IF NOT EXISTS beta_rewards (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    reward_type TEXT NOT NULL CHECK (reward_type IN ('feedback', 'bug', 'scenario', 'survey', 'referral')),
    reward_amount INTEGER NOT NULL,
    description TEXT,
    reference_id TEXT, -- ID of related feedback, bug, scenario, etc.
    granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    used_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES beta_users(user_id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_beta_users_user_id ON beta_users(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_users_email ON beta_users(email);
CREATE INDEX IF NOT EXISTS idx_beta_users_status ON beta_users(application_status);
CREATE INDEX IF NOT EXISTS idx_beta_users_phase ON beta_users(testing_phase);
CREATE INDEX IF NOT EXISTS idx_beta_users_join_date ON beta_users(join_date);
CREATE INDEX IF NOT EXISTS idx_beta_users_engagement ON beta_users(engagement_score DESC);

CREATE INDEX IF NOT EXISTS idx_beta_feedback_user_id ON beta_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_type ON beta_feedback(type);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_status ON beta_feedback(status);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_priority ON beta_feedback(priority DESC);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_created_at ON beta_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_assigned_to ON beta_feedback(assigned_to);

CREATE INDEX IF NOT EXISTS idx_beta_scenarios_phase ON beta_testing_scenarios(phase);
CREATE INDEX IF NOT EXISTS idx_beta_scenarios_category ON beta_testing_scenarios(category);
CREATE INDEX IF NOT EXISTS idx_beta_scenarios_active ON beta_testing_scenarios(active);

CREATE INDEX IF NOT EXISTS idx_beta_scenario_completions_user_id ON beta_scenario_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_scenario_completions_scenario_id ON beta_scenario_completions(scenario_id);
CREATE INDEX IF NOT EXISTS idx_beta_scenario_completions_completed_at ON beta_scenario_completions(completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_beta_activities_user_id ON beta_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_activities_type ON beta_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_beta_activities_created_at ON beta_activities(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_beta_survey_responses_user_id ON beta_survey_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_survey_responses_survey_id ON beta_survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_beta_survey_responses_rating ON beta_survey_responses(rating);

CREATE INDEX IF NOT EXISTS idx_beta_invitations_email ON beta_invitations(email);
CREATE INDEX IF NOT EXISTS idx_beta_invitations_token ON beta_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_beta_invitations_status ON beta_invitations(status);

CREATE INDEX IF NOT EXISTS idx_beta_rewards_user_id ON beta_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_rewards_type ON beta_rewards(reward_type);
CREATE INDEX IF NOT EXISTS idx_beta_rewards_granted_at ON beta_rewards(granted_at DESC);

-- Insert default testing scenarios
INSERT OR IGNORE INTO beta_testing_scenarios (id, name, description, phase, steps, expected_outcome, completion_points, category, estimated_time) VALUES
-- Onboarding Phase Scenarios
('scenario-001', 'Account Setup and API Key Generation', 'Complete initial account setup and generate your first API key', 'onboarding',
 '["Sign up for beta account", "Verify email address", "Generate API key", "Test API key authentication"]',
 'Successfully authenticate with API key and receive account information', 20, 'integration', 15),

('scenario-002', 'SDK Installation and First API Call', 'Install preferred SDK and make first API call', 'onboarding',
 '["Install Python/TypeScript/Go SDK", "Configure with API key", "Make test API call to health endpoint", "Verify successful response"]',
 'SDK successfully installed and authenticated with SDLC.ai API', 25, 'integration', 20),

('scenario-003', 'Document Upload Test', 'Upload first document and verify processing', 'onboarding',
 '["Prepare test document (PDF or text)", "Upload document via SDK", "Monitor processing status", "Verify document is indexed"]',
 'Document successfully uploaded, processed, and ready for search', 30, 'feature', 10),

-- Core Phase Scenarios
('scenario-004', 'Basic Vector Search', 'Perform vector search on uploaded documents', 'core',
 '["Upload 3-5 test documents", "Wait for processing to complete", "Perform semantic search query", "Verify relevant results"]',
 'Search returns relevant documents based on semantic similarity', 35, 'feature', 15),

('scenario-005', 'RAG Query Test', 'Test Retrieval-Augmented Generation with context', 'core',
 '["Ensure documents are uploaded", "Craft question about document content", "Execute RAG query", "Verify answer includes document context"]',
 'RAG query provides accurate answers with source citations', 40, 'feature', 20),

('scenario-006', 'DLP Content Redaction', 'Test DLP features with sensitive content', 'core',
 '["Upload document with PII/PHI", "Configure DLP rules", "Process document", "Verify sensitive data is redacted"]',
 'Sensitive content properly identified and redacted', 50, 'security', 25),

-- Advanced Phase Scenarios
('scenario-007', 'Multi-Tenant Isolation', 'Verify data isolation between tenants', 'advanced',
 '["Create two separate tenants", "Upload different documents to each", "Search from each tenant", "Verify no cross-tenant data leakage"]',
 'Complete data isolation with no cross-tenant access', 60, 'security', 30),

('scenario-008', 'Batch Document Processing', 'Process multiple documents simultaneously', 'advanced',
 '["Prepare 20+ test documents", "Initiate batch upload", "Monitor all documents processing", "Verify all complete successfully"]',
 'All documents processed in parallel within SLA', 45, 'performance', 45),

('scenario-009', 'Custom Embedding Model', 'Test custom embedding model integration', 'advanced',
 '["Configure custom embedding model", "Upload test documents", "Generate embeddings", "Compare search quality"]',
 'Custom model provides improved search relevance', 55, 'feature', 40),

-- Load Testing Phase Scenarios
('scenario-010', 'Concurrent User Simulation', 'Test system under concurrent load', 'load',
 '["Create 10+ concurrent API clients", "Simultaneously upload documents", "Perform concurrent searches", "Monitor response times"]',
 'System maintains performance under concurrent load', 70, 'performance', 60),

('scenario-011', 'Large Document Processing', 'Test with large documents (>100MB)', 'load',
 '["Prepare 100MB+ test document", "Upload large document", "Monitor processing time", "Verify successful completion"]',
 'Large documents processed within acceptable time limits', 65, 'performance', 90),

('scenario-012', 'Search Stress Test', 'Perform 1000+ rapid searches', 'load',
 '["Ensure 100+ documents are indexed", "Execute 1000 search queries rapidly", "Monitor performance metrics", "Verify accuracy maintained"]',
 'Search maintains accuracy and performance under stress', 75, 'performance', 45),

-- Integration Phase Scenarios
('scenario-013', 'End-to-End Application Integration', 'Build complete application workflow', 'integration',
 '["Build application using SDLC.ai", "Implement user authentication", "Integrate document upload", "Add search functionality"]',
 'Fully functional application using SDLC.ai platform', 100, 'integration', 240),

('scenario-014', 'Webhook Integration Test', 'Test webhook notifications', 'integration',
 '["Configure webhook endpoint", "Set up event subscriptions", "Trigger webhook events", "Verify webhook delivery"]',
 'Webhooks deliver events reliably and securely', 40, 'integration', 30),

('scenario-015', 'API Rate Limiting', 'Test rate limiting behavior', 'integration',
 '["Make rapid API calls", "Hit rate limits", "Verify 429 responses", "Test backoff and retry"]',
 'Rate limiting works correctly with proper backoff', 35, 'usability', 15);

-- Insert initial beta program configuration
INSERT OR IGNORE INTO settings (key, value, description, category) VALUES
('beta.max_users', '100', 'Maximum number of beta users', 'beta'),
('beta.duration_days', '56', 'Duration of beta program in days (8 weeks)', 'beta'),
('beta.feedback_credits', '100', 'Credits awarded for feedback submission', 'beta'),
('beta.bug_credits', '500', 'Credits awarded for critical bug reports', 'beta'),
('beta.scenario_multiplier', '0.1', 'Multiplier for converting scenario points to credits', 'beta'),
('beta.survey_credits', '50', 'Credits awarded for survey completion', 'beta'),
('beta.referral_credits', '200', 'Credits awarded for successful referrals', 'beta');

-- Create triggers for automatic timestamp updates
CREATE TRIGGER IF NOT EXISTS update_beta_users_timestamp
    AFTER UPDATE ON beta_users
    FOR EACH ROW
BEGIN
    UPDATE beta_users
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_beta_feedback_timestamp
    AFTER UPDATE ON beta_feedback
    FOR EACH ROW
BEGIN
    UPDATE beta_feedback
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_beta_testing_scenarios_timestamp
    AFTER UPDATE ON beta_testing_scenarios
    FOR EACH ROW
BEGIN
    UPDATE beta_testing_scenarios
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_beta_scenario_completions_timestamp
    AFTER UPDATE ON beta_scenario_completions
    FOR EACH ROW
BEGIN
    UPDATE beta_scenario_completions
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

-- Create views for common queries
CREATE VIEW IF NOT EXISTS beta_active_users AS
SELECT
    bu.*,
    u.email as user_email,
    u.created_at as user_created_at
FROM beta_users bu
JOIN users u ON bu.user_id = u.id
WHERE bu.application_status = 'active'
AND (bu.end_date IS NULL OR bu.end_date > CURRENT_TIMESTAMP);

CREATE VIEW IF NOT EXISTS beta_feedback_summary AS
SELECT
    f.type,
    f.category,
    f.status,
    COUNT(*) as count,
    AVG(f.priority) as avg_priority,
    DATE(f.created_at) as date
FROM beta_feedback f
GROUP BY f.type, f.category, f.status, DATE(f.created_at);

CREATE VIEW IF NOT EXISTS beta_scenario_progress AS
SELECT
    bu.user_id,
    bu.name,
    bu.testing_phase,
    COUNT(sc.id) as total_scenarios,
    COUNT(scc.scenario_id) as completed_scenarios,
    ROUND(
        (COUNT(scc.scenario_id) * 100.0 / COUNT(sc.id)), 2
    ) as completion_percentage
FROM beta_users bu
LEFT JOIN beta_testing_scenarios sc ON sc.phase = bu.testing_phase AND sc.active = true
LEFT JOIN beta_scenario_completions scc ON scc.scenario_id = sc.id AND scc.user_id = bu.user_id AND scc.completed_at IS NOT NULL
WHERE bu.application_status = 'active'
GROUP BY bu.user_id, bu.name, bu.testing_phase;

-- Add Row Level Security (RLS) policies
ALTER TABLE beta_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_scenario_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_rewards ENABLE ROW LEVEL SECURITY;

-- RLS Policies for beta_users
CREATE POLICY IF NOT EXISTS "Users can view their own beta profile"
    ON beta_users FOR SELECT
    USING (user_id = current_user_id());

CREATE POLICY IF NOT EXISTS "Admins can view all beta users"
    ON beta_users FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = current_user_id()
            AND role = 'admin'
        )
    );

-- RLS Policies for beta_feedback
CREATE POLICY IF NOT EXISTS "Users can view their own feedback"
    ON beta_feedback FOR SELECT
    USING (user_id = current_user_id());

CREATE POLICY IF NOT EXISTS "Users can insert their own feedback"
    ON beta_feedback FOR INSERT
    WITH CHECK (user_id = current_user_id());

CREATE POLICY IF NOT EXISTS "Admins can manage all feedback"
    ON beta_feedback FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = current_user_id()
            AND role = 'admin'
        )
    );

-- Functions for beta program management
CREATE OR REPLACE FUNCTION calculate_beta_engagement_score(
    p_user_id TEXT
) RETURNS INTEGER AS $$
DECLARE
    feedback_score INTEGER;
    scenario_score INTEGER;
    activity_score INTEGER;
    survey_score INTEGER;
    total_score INTEGER;
BEGIN
    -- Feedback contribution (10 points per feedback)
    SELECT COALESCE(feedback_count * 10, 0)
    INTO feedback_score
    FROM beta_users
    WHERE user_id = p_user_id;

    -- Scenario completion contribution (1 point per point earned)
    SELECT COALESCE(SUM(s.completion_points), 0)
    INTO scenario_score
    FROM beta_scenario_completions sc
    JOIN beta_testing_scenarios s ON sc.scenario_id = s.id
    WHERE sc.user_id = p_user_id AND sc.completed_at IS NOT NULL;

    -- Activity contribution (5 points per activity)
    SELECT COALESCE(COUNT(*) * 5, 0)
    INTO activity_score
    FROM beta_activities
    WHERE user_id = p_user_id
    AND created_at > CURRENT_DATE - INTERVAL '7 days';

    -- Survey contribution (20 points per survey)
    SELECT COALESCE(COUNT(*) * 20, 0)
    INTO survey_score
    FROM beta_survey_responses
    WHERE user_id = p_user_id;

    -- Calculate total
    total_score := feedback_score + scenario_score + activity_score + survey_score;

    -- Update user's engagement score
    UPDATE beta_users
    SET engagement_score = total_score,
        last_active_date = CURRENT_TIMESTAMP
    WHERE user_id = p_user_id;

    RETURN total_score;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_beta_leaderboard(
    p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
    rank INTEGER,
    user_id TEXT,
    name TEXT,
    company TEXT,
    engagement_score INTEGER,
    feedback_count INTEGER,
    scenarios_completed INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ROW_NUMBER() OVER (ORDER BY bu.engagement_score DESC) as rank,
        bu.user_id,
        bu.name,
        bu.company,
        bu.engagement_score,
        bu.feedback_count,
        COUNT(scc.scenario_id) as scenarios_completed
    FROM beta_users bu
    LEFT JOIN beta_scenario_completions scc ON scc.user_id = bu.user_id AND scc.completed_at IS NOT NULL
    WHERE bu.application_status = 'active'
    GROUP BY bu.user_id, bu.name, bu.company, bu.engagement_score, bu.feedback_count
    ORDER BY bu.engagement_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Create scheduled jobs for beta program maintenance
CREATE OR REPLACE FUNCTION cleanup_expired_beta_invitations()
RETURNS VOID AS $$
BEGIN
    UPDATE beta_invitations
    SET status = 'expired'
    WHERE status = 'pending'
    AND expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_beta_phase_transitions()
RETURNS VOID AS $$
BEGIN
    -- Auto-advance users who complete all scenarios in current phase
    WITH phase_completion AS (
        SELECT
            bu.user_id,
            bu.testing_phase,
            COUNT(sc.id) as total_scenarios,
            COUNT(scc.scenario_id) as completed_scenarios
        FROM beta_users bu
        LEFT JOIN beta_testing_scenarios sc ON sc.phase = bu.testing_phase AND sc.active = true
        LEFT JOIN beta_scenario_completions scc ON scc.scenario_id = sc.id AND scc.user_id = bu.user_id AND scc.completed_at IS NOT NULL
        WHERE bu.application_status = 'active'
        GROUP BY bu.user_id, bu.testing_phase
        HAVING COUNT(sc.id) = COUNT(scc.scenario_id)
        AND COUNT(sc.id) > 0
    )
    UPDATE beta_users
    SET testing_phase = CASE testing_phase
        WHEN 'onboarding' THEN 'core'
        WHEN 'core' THEN 'advanced'
        WHEN 'advanced' THEN 'load'
        WHEN 'load' THEN 'integration'
        ELSE testing_phase
    END,
    updated_at = CURRENT_TIMESTAMP
    FROM phase_completion pc
    WHERE beta_users.user_id = pc.user_id
    AND beta_users.testing_phase = pc.testing_phase;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON beta_users TO authenticated_role;
GRANT SELECT, INSERT, UPDATE ON beta_feedback TO authenticated_role;
GRANT SELECT ON beta_testing_scenarios TO authenticated_role;
GRANT SELECT, INSERT, UPDATE ON beta_scenario_completions TO authenticated_role;
GRANT SELECT, INSERT ON beta_activities TO authenticated_role;
GRANT SELECT, INSERT ON beta_survey_responses TO authenticated_role;
GRANT SELECT ON beta_rewards TO authenticated_role;

GRANT EXECUTE ON FUNCTION calculate_beta_engagement_score TO authenticated_role;
GRANT EXECUTE ON FUNCTION get_beta_leaderboard TO authenticated_role;

COMMIT;
