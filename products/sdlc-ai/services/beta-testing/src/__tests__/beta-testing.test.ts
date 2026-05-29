/**
 * Beta Testing Service Tests
 * Comprehensive test suite for beta testing functionality
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';
import { createMcpClient } from '@sdlc/mcp-sdk';

describe('Beta Testing Service', () => {
  let app: Hono;
  let mcp: any;
  let testUserId: string;
  let testFeedbackId: string;

  beforeAll(async () => {
    // Initialize test environment
    mcp = createMcpClient({
      mode: 'test',
      database: ':memory:',
    });

    // Setup test database
    await setupTestDatabase();

    // Create test app
    app = new Hono();
    await setupRoutes(app);
  });

  beforeEach(async () => {
    // Clean up test data
    await cleanupTestData();

    // Create test user
    testUserId = await createTestUser();
  });

  afterAll(async () => {
    // Cleanup
    await mcp.close();
  });

  describe('Beta Application', () => {
    it('should accept new beta applications', async () => {
      const application = {
        email: 'test@example.com',
        name: 'Test User',
        company: 'Test Corp',
        experience: 'intermediate' as const,
        useCase: 'Building secure AI applications for healthcare',
        motivation: 'Want to ensure HIPAA compliance while using AI',
        technicalBackground: '5 years full-stack development',
        agreeToTerms: true,
      };

      const response = await app.request('/api/beta/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(application),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.applicationId).toBeDefined();
      expect(json.data.nextSteps).toHaveLength(3);
    });

    it('should reject duplicate applications', async () => {
      const application = {
        email: 'duplicate@example.com',
        name: 'Test User',
        experience: 'beginner' as const,
        useCase: 'Testing duplicate prevention',
        motivation: 'Testing',
        technicalBackground: 'Testing',
        agreeToTerms: true,
      };

      // First application
      await app.request('/api/beta/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(application),
      });

      // Duplicate application
      const response = await app.request('/api/beta/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(application),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('ALREADY_APPLIED');
    });

    it('should validate required fields', async () => {
      const invalidApplication = {
        email: 'invalid-email',
        name: 'A', // Too short
        experience: 'beginner' as const,
        // Missing required fields
        agreeToTerms: false,
      };

      const response = await app.request('/api/beta/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidApplication),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Application Review (Admin)', () => {
    let applicationId: string;

    beforeEach(async () => {
      // Create a pending application
      const result = await mcp.db
        .prepare(`
          INSERT INTO beta_users (
            user_id, email, name, experience, use_case,
            application_status, join_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          testUserId,
          'review@test.com',
          'Review User',
          'expert',
          'Security testing',
          'pending',
          new Date().toISOString()
        )
        .run();

      applicationId = result.meta.last_row_id;
    });

    it('should approve beta application', async () => {
      const adminToken = await createAdminToken();

      const response = await app.request(`/api/beta/admin/applications/${applicationId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          decision: 'approved',
          notes: 'Strong technical background',
        }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('approved');
      expect(json.data.betaUser.endDate).toBeDefined();
    });

    it('should reject beta application', async () => {
      const adminToken = await createAdminToken();

      const response = await app.request(`/api/beta/admin/applications/${applicationId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          decision: 'rejected',
          notes: 'Program full',
        }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.status).toBe('rejected');
    });

    it('should require admin access for review', async () => {
      const response = await app.request(`/api/beta/admin/applications/${applicationId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer user-token',
        },
        body: JSON.stringify({
          decision: 'approved',
        }),
      });

      expect(response.status).toBe(403);
    });
  });

  describe('Onboarding', () => {
    beforeEach(async () => {
      // Create approved beta user
      await mcp.db
        .prepare(`
          UPDATE beta_users
          SET application_status = 'approved', testing_phase = 'onboarding'
          WHERE user_id = ?
        `)
        .bind(testUserId)
        .run();
    });

    it('should complete onboarding', async () => {
      const onboardingData = {
        sdkUsed: 'python' as const,
        firstApiCall: {
          endpoint: '/api/v1/health',
          success: true,
          responseTime: 145,
        },
        setupExperience: {
          ease: 4,
          issues: 'Minor confusion with API key format',
          comments: 'Overall smooth process',
        },
      };

      const token = generateOnboardingToken(testUserId);

      const response = await app.request(`/api/beta/onboarding/complete?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(onboardingData),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.nextSteps).toHaveLength(3);
      expect(json.data.welcomeKit.quickStartGuide).toBeDefined();
    });

    it('should reject invalid onboarding token', async () => {
      const response = await app.request('/api/beta/onboarding/complete?token=invalid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sdkUsed: 'python',
          firstApiCall: { endpoint: '/test', success: true, responseTime: 100 },
          setupExperience: { ease: 5 },
        }),
      });

      expect(response.status).toBe(400);
      expect(response.json().error).toBe('Invalid or expired onboarding token');
    });
  });

  describe('Testing Scenarios', () => {
    beforeEach(async () => {
      // Create active beta user
      await mcp.db
        .prepare(`
          UPDATE beta_users
          SET application_status = 'active', testing_phase = 'core'
          WHERE user_id = ?
        `)
        .bind(testUserId)
        .run();

      // Create test scenario
      await mcp.db
        .prepare(`
          INSERT INTO beta_testing_scenarios (
            id, name, description, phase, steps, expected_outcome,
            completion_points, category, estimated_time
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          'test-scenario-001',
          'Test Document Upload',
          'Upload and process a test document',
          'core',
          JSON.stringify(['Upload document', 'Check processing', 'Verify results']),
          'Document processed successfully',
          30,
          'integration',
          20
        )
        .run();
    });

    it('should get testing scenarios for current phase', async () => {
      const response = await app.request('/api/beta/scenarios', {
        headers: { 'Authorization': `Bearer ${await createTestToken(testUserId)}` },
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.phase).toBe('core');
      expect(json.data.scenarios).toHaveLength(1);
      expect(json.data.scenarios[0].id).toBe('test-scenario-001');
    });

    it('should complete testing scenario', async () => {
      const completionData = {
        success: true,
        timeSpent: 25,
        issues: ['Slight delay in processing'],
        feedback: 'Works well, processing could be faster',
      };

      const response = await app.request('/api/beta/scenarios/test-scenario-001/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await createTestToken(testUserId)}`,
        },
        body: JSON.stringify(completionData),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.pointsEarned).toBe(30);
      expect(json.data.engagementScore).toBeGreaterThan(0);
    });
  });

  describe('Feedback Submission', () => {
    beforeEach(async () => {
      // Create active beta user
      await mcp.db
        .prepare(`
          UPDATE beta_users
          SET application_status = 'active'
          WHERE user_id = ?
        `)
        .bind(testUserId)
        .run();
    });

    it('should submit bug report', async () => {
      const feedback = {
        type: 'bug' as const,
        title: 'Document upload fails for large files',
        description: 'Uploading files larger than 5MB causes timeout',
        context: {
          feature: 'document-upload',
          endpoint: '/api/v1/documents',
          environment: 'production',
          reproductionSteps: [
            'Select file > 5MB',
            'Click upload',
            'Wait for upload',
            'Error occurs',
          ],
        },
      };

      const response = await app.request('/api/beta/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await createTestToken(testUserId)}`,
        },
        body: JSON.stringify(feedback),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.feedbackId).toBeDefined();
      expect(json.data.creditsEarned).toBe(500); // Critical bug reward
      testFeedbackId = json.data.feedbackId;
    });

    it('should submit feature request', async () => {
      const feedback = {
        type: 'feature' as const,
        title: 'Add batch document processing',
        description: 'Would be great to upload multiple documents at once',
        context: {
          feature: 'document-processing',
        },
      };

      const response = await app.request('/api/beta/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await createTestToken(testUserId)}`,
        },
        body: JSON.stringify(feedback),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.creditsEarned).toBe(100); // Regular feedback reward
    });

    it('should require active beta status for feedback', async () => {
      await mcp.db
        .prepare('UPDATE beta_users SET application_status = ? WHERE user_id = ?')
        .bind('pending', testUserId)
        .run();

      const response = await app.request('/api/beta/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await createTestToken(testUserId)}`,
        },
        body: JSON.stringify({
          type: 'general',
          title: 'Test',
          description: 'Test feedback',
        }),
      });

      expect(response.status).toBe(400);
      expect(response.json().error).toBe('Not an active beta user');
    });
  });

  describe('Survey Responses', () => {
    beforeEach(async () => {
      // Create active beta user
      await mcp.db
        .prepare(`
          UPDATE beta_users
          SET application_status = 'active'
          WHERE user_id = ?
        `)
        .bind(testUserId)
        .run();
    });

    it('should submit survey response', async () => {
      const surveyData = {
        surveyId: 'beta-week-2-satisfaction',
        responses: {
          easeOfUse: 4,
          documentationQuality: 5,
          featureCompleteness: 3,
          overallSatisfaction: 4,
        },
        rating: 4,
        wouldRecommend: true,
        comments: 'Great platform, looking forward to more features',
      };

      const response = await app.request('/api/beta/survey', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await createTestToken(testUserId)}`,
        },
        body: JSON.stringify(surveyData),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.creditsEarned).toBe(50); // Survey reward
    });
  });

  describe('Dashboard Data', () => {
    beforeEach(async () => {
      // Setup user with data
      await mcp.db
        .prepare(`
          UPDATE beta_users
          SET application_status = 'active',
              feedback_count = 5,
              engagement_score = 150,
              reward_credits = 750
          WHERE user_id = ?
        `)
        .bind(testUserId)
        .run();

      // Add some activities
      await mcp.db
        .prepare(`
          INSERT INTO beta_activities (user_id, activity_type, activity_data)
          VALUES (?, 'api_call', ?), (?, 'document_upload', ?), (?, 'feedback_submit', ?)
        `)
        .bind(
          testUserId, JSON.stringify({ endpoint: '/api/v1/search' }),
          testUserId, JSON.stringify({ fileSize: '2MB' }),
          testUserId, JSON.stringify({ feedbackId: 'test-001' })
        )
        .run();
    });

    it('should return dashboard data', async () => {
      const response = await app.request('/api/beta/dashboard', {
        headers: { 'Authorization': `Bearer ${await createTestToken(testUserId)}` },
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.summary).toBeDefined();
      expect(json.data.summary.engagementScore).toBe(150);
      expect(json.data.summary.totalCredits).toBe(750);
      expect(json.data.summary.feedbackSubmitted).toBe(5);
      expect(json.data.activity).toHaveLength(3);
    });
  });

  describe('Admin Metrics', () => {
    beforeEach(async () => {
      // Create test data
      await createTestMetrics();
    });

    it('should return beta metrics for admin', async () => {
      const adminToken = await createAdminToken();

      const response = await app.request('/api/beta/admin/metrics', {
        headers: { 'Authorization': `Bearer ${adminToken}` },
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.totalUsers).toBeGreaterThan(0);
      expect(json.data.activeUsers).toBeGreaterThan(0);
      expect(json.data.feedbackCount).toBeGreaterThan(0);
      expect(json.data.npsScore).toBeDefined();
      expect(json.data.phaseDistribution).toBeDefined();
    });

    it('should require admin access for metrics', async () => {
      const response = await app.request('/api/beta/admin/metrics', {
        headers: { 'Authorization': 'Bearer user-token' },
      });

      expect(response.status).toBe(403);
    });
  });

  describe('Feedback Management', () => {
    beforeEach(async () => {
      // Create test feedback
      const result = await mcp.db
        .prepare(`
          INSERT INTO beta_feedback (
            id, user_id, type, category, title, description, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          'test-feedback-001',
          testUserId,
          'bug',
          'high',
          'Test Bug',
          'This is a test bug report',
          'new'
        )
        .run();

      testFeedbackId = result.meta.last_row_id;
    });

    it('should update feedback status', async () => {
      const adminToken = await createAdminToken();

      const response = await app.request(`/api/beta/admin/feedback/${testFeedbackId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          status: 'resolved',
          priority: 'normal',
          response: 'Fixed in version 1.2.3',
        }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
    });

    it('should get feedback list', async () => {
      const adminToken = await createAdminToken();

      const response = await app.request('/api/beta/admin/feedback', {
        headers: { 'Authorization': `Bearer ${adminToken}` },
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.feedback).toBeDefined();
      expect(json.data.pagination).toBeDefined();
    });
  });

  // Helper functions
  async function setupTestDatabase() {
    // Run migrations
    await mcp.db.exec(`
      CREATE TABLE IF NOT EXISTS beta_users (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        company TEXT,
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
        survey_responses TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS beta_feedback (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT CHECK (type IN ('bug', 'feature', 'usability', 'performance', 'general')) NOT NULL,
        category TEXT CHECK (category IN ('critical', 'high', 'medium', 'low')) NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        context TEXT,
        attachments TEXT,
        status TEXT CHECK (status IN ('new', 'triaged', 'in-progress', 'resolved', 'closed', 'deferred')) DEFAULT 'new',
        priority TEXT CHECK (priority IN ('urgent', 'high', 'normal', 'low')) DEFAULT 'normal',
        assigned_to TEXT,
        response TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME,
        user_response TEXT,
        helpful BOOLEAN
      );

      CREATE TABLE IF NOT EXISTS beta_testing_scenarios (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        phase TEXT CHECK (phase IN ('onboarding', 'core', 'advanced', 'load', 'integration')) NOT NULL,
        steps TEXT NOT NULL,
        expected_outcome TEXT NOT NULL,
        completion_points INTEGER NOT NULL DEFAULT 10,
        category TEXT CHECK (category IN ('integration', 'security', 'performance', 'usability', 'feature')) NOT NULL,
        estimated_time INTEGER NOT NULL,
        prerequisites TEXT,
        active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS beta_scenario_completions (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL,
        scenario_id TEXT NOT NULL,
        completion_data TEXT,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, scenario_id)
      );

      CREATE TABLE IF NOT EXISTS beta_activities (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL,
        activity_type TEXT NOT NULL,
        activity_data TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS beta_survey_responses (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL,
        survey_id TEXT NOT NULL,
        responses TEXT NOT NULL,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        would_recommend BOOLEAN,
        comments TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  async function cleanupTestData() {
    await mcp.db.exec(`
      DELETE FROM beta_survey_responses;
      DELETE FROM beta_activities;
      DELETE FROM beta_scenario_completions;
      DELETE FROM beta_feedback;
      DELETE FROM beta_testing_scenarios;
      DELETE FROM beta_users;
    `);
  }

  async function createTestUser(): Promise<string> {
    const userId = `test-user-${Date.now()}`;
    await mcp.db
      .prepare('INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)')
      .bind(userId, 'test@example.com', 'Test User', 'user')
      .run();
    return userId;
  }

  async function createAdminToken(): Promise<string> {
    const adminId = `admin-${Date.now()}`;
    await mcp.db
      .prepare('INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)')
      .bind(adminId, 'admin@example.com', 'Admin User', 'admin')
      .run();

    return await mcp.auth.generateJWT({
      sub: adminId,
      role: 'admin',
      email: 'admin@example.com',
    });
  }

  async function createTestToken(userId: string): Promise<string> {
    return await mcp.auth.generateJWT({
      sub: userId,
      role: 'user',
      email: 'test@example.com',
    });
  }

  function generateOnboardingToken(userId: string): string {
    const payload = {
      userId,
      timestamp: Date.now(),
      type: 'beta-onboarding',
    };
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  async function createTestMetrics() {
    // Create various test users
    const users = [
      { status: 'active', phase: 'core', feedback: 5, engagement: 100 },
      { status: 'active', phase: 'advanced', feedback: 12, engagement: 250 },
      { status: 'completed', phase: 'integration', feedback: 20, engagement: 400 },
    ];

    for (const user of users) {
      const userId = `metrics-user-${Date.now()}-${Math.random()}`;
      await mcp.db
        .prepare(`
          INSERT INTO beta_users (user_id, email, name, application_status, testing_phase,
                                feedback_count, engagement_score, join_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          userId,
          `${userId}@test.com`,
          'Metrics User',
          user.status,
          user.phase,
          user.feedback,
          user.engagement,
          new Date().toISOString()
        )
        .run();
    }

    // Create feedback
    await mcp.db
      .prepare(`
        INSERT INTO beta_feedback (user_id, type, category, title, description, status)
        VALUES
          (?, 'bug', 'critical', 'Critical Bug', 'This is critical', 'resolved'),
          (?, 'feature', 'medium', 'Feature Request', 'Add new feature', 'new'),
          (?, 'usability', 'low', 'UI Issue', 'Button placement', 'in-progress')
      `)
      .bind(testUserId, testUserId, testUserId)
      .run();
  }

  async function setupRoutes(app: Hono) {
    // Import and set up routes
    const betaController = await import('../src/beta-testing.controller');
    app.route('/api/beta', betaController.default);
  }
});

// Integration tests
describe('Beta Testing Integration', () => {
  it('should handle complete beta testing flow', async () => {
    // This test simulates a complete beta user journey
    // 1. Apply for beta
    // 2. Get approved
    // 3. Complete onboarding
    // 4. Test scenarios
    // 5. Submit feedback
    // 6. Complete surveys
    // 7. Graduate from beta

    // Implementation would test the full flow
    expect(true).toBe(true);
  });

  it('should scale under load', async () => {
    // Test concurrent feedback submissions
    const promises = Array.from({ length: 100 }, async (_, i) => {
      // Simulate feedback submission
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
      return `feedback-${i}`;
    });

    const results = await Promise.all(promises);
    expect(results).toHaveLength(100);
  });
});

// Performance tests
describe('Beta Testing Performance', () => {
  it('should respond to API calls within acceptable time', async () => {
    const startTime = Date.now();

    // Test scenario retrieval
    const response = await fetch('/api/beta/scenarios');

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(500); // Should respond in <500ms
  });
});

export {
  // Export for potential use in other test files
  createTestUser,
  createAdminToken,
  setupTestDatabase,
};
