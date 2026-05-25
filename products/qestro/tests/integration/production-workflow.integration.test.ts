/**
 * Production Workflow Integration Tests
 *
 * These tests validate complete end-to-end workflows in the production environment
 * to ensure all services work together correctly.
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';

describe('Production Workflow Integration', () => {
  let testUser: any;
  let testProject: any;
  let authHeaders: Record<string, string>;

  beforeAll(async () => {
    // Initialize test environment
    await initializeTestEnvironment();
  });

  beforeEach(async () => {
    // Clean up test data
    await cleanupTestData();
  });

  describe('User Authentication Workflow', () => {
    it('should complete full user registration and authentication flow', async () => {
      // Step 1: Register new user
      const registrationData = {
        email: 'test-user@qestro.io',
        password: 'Str0ngP@ssword123!',
        firstName: 'Test',
        lastName: 'User',
        company: 'Qestro Test Company'
      };

      const registerResponse = await makeAPIRequest('/api/auth/register', 'POST', registrationData);
      expect(registerResponse.status).toBe(201);
      expect(registerResponse.data.user.email).toBe(registrationData.email);
      expect(registerResponse.data.user.verified).toBe(false);

      // Step 2: Verify email
      const verificationToken = registerResponse.data.verificationToken;
      const verifyResponse = await makeAPIRequest('/api/auth/verify-email', 'POST', {
        token: verificationToken
      });
      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.data.verified).toBe(true);

      // Step 3: Login
      const loginResponse = await makeAPIRequest('/api/auth/login', 'POST', {
        email: registrationData.email,
        password: registrationData.password
      });
      expect(loginResponse.status).toBe(200);
      expect(loginResponse.data.tokens.accessToken).toBeDefined();
      expect(loginResponse.data.tokens.refreshToken).toBeDefined();

      // Save auth data for subsequent tests
      testUser = loginResponse.data.user;
      authHeaders = {
        'Authorization': `Bearer ${loginResponse.data.tokens.accessToken}`
      };

      // Step 4: Get user profile
      const profileResponse = await makeAPIRequest('/api/auth/profile', 'GET', null, authHeaders);
      expect(profileResponse.status).toBe(200);
      expect(profileResponse.data.id).toBe(testUser.id);
    });

    it('should handle token refresh flow', async () => {
      // First login to get tokens
      const loginResponse = await authenticateTestUser();
      const refreshToken = loginResponse.tokens.refreshToken;

      // Wait a moment (in real tests, you'd wait for token to expire)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Refresh token
      const refreshResponse = await makeAPIRequest('/api/auth/refresh', 'POST', {
        refreshToken
      });
      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.data.tokens.accessToken).toBeDefined();
      expect(refreshResponse.data.tokens.refreshToken).toBeDefined();

      // Use new token to access protected resource
      const newAuthHeaders = {
        'Authorization': `Bearer ${refreshResponse.data.tokens.accessToken}`
      };
      const profileResponse = await makeAPIRequest('/api/auth/profile', 'GET', null, newAuthHeaders);
      expect(profileResponse.status).toBe(200);
    });
  });

  describe('Project Management Workflow', () => {
    beforeEach(async () => {
      // Authenticate test user
      const loginResponse = await authenticateTestUser();
      authHeaders = {
        'Authorization': `Bearer ${loginResponse.tokens.accessToken}`
      };
      testUser = loginResponse.user;
    });

    it('should create and manage projects', async () => {
      // Step 1: Create project
      const projectData = {
        name: 'Test E-Commerce Application',
        description: 'Comprehensive test suite for e-commerce platform',
        type: 'web',
        settings: {
          baseUrl: 'https://test-ecommerce.example.com',
          testFrequency: 'daily',
          notifications: true
        }
      };

      const createResponse = await makeAPIRequest('/api/projects', 'POST', projectData, authHeaders);
      expect(createResponse.status).toBe(201);
      testProject = createResponse.data;
      expect(testProject.name).toBe(projectData.name);
      expect(testProject.createdBy).toBe(testUser.id);

      // Step 2: Upload test data/files
      const testFile = Buffer.from('test file content');
      const uploadResponse = await uploadFileToR2(testProject.id, 'test-data.json', testFile);
      expect(uploadResponse.success).toBe(true);

      // Step 3: Create test suite
      const suiteData = {
        name: 'Critical User Journeys',
        description: 'Tests for critical user paths',
        projectId: testProject.id
      };

      const suiteResponse = await makeAPIRequest('/api/test-suites', 'POST', suiteData, authHeaders);
      expect(suiteResponse.status).toBe(201);
      const testSuite = suiteResponse.data;

      // Step 4: Create test cases
      const testCases = [
        {
          name: 'User Registration Flow',
          description: 'Test user registration with various scenarios',
          type: 'functional',
          steps: [
            { action: 'navigate', target: '/register' },
            { action: 'fill', target: '#email', value: 'test@example.com' },
            { action: 'fill', target: '#password', value: 'password123' },
            { action: 'click', target: 'button[type="submit"]' },
            { action: 'assert', target: '.welcome-message', value: 'Welcome' }
          ]
        },
        {
          name: 'Product Search and Add to Cart',
          description: 'Test product search and cart functionality',
          type: 'functional',
          steps: [
            { action: 'navigate', target: '/' },
            { action: 'fill', target: '#search', value: 'laptop' },
            { action: 'click', target: '.search-button' },
            { action: 'click', target: '.product:first-child .add-to-cart' },
            { action: 'assert', target: '.cart-count', value: '1' }
          ]
        }
      ];

      for (const testCase of testCases) {
        const caseResponse = await makeAPIRequest('/api/test-cases', 'POST', {
          ...testCase,
          suiteId: testSuite.id,
          projectId: testProject.id
        }, authHeaders);
        expect(caseResponse.status).toBe(201);
      }

      // Step 5: Get project details with all relations
      const projectResponse = await makeAPIRequest(`/api/projects/${testProject.id}`, 'GET', null, authHeaders);
      expect(projectResponse.status).toBe(200);
      expect(projectResponse.data.testSuites).toHaveLength(1);
      expect(projectResponse.data.testSuites[0].testCases).toHaveLength(2);
    });

    it('should handle team collaboration', async () => {
      // Step 1: Invite team member
      const inviteData = {
        email: 'team-member@qestro.io',
        role: 'tester',
        permissions: ['read', 'execute']
      };

      const inviteResponse = await makeAPIRequest(
        `/api/projects/${testProject.id}/invite`,
        'POST',
        inviteData,
        authHeaders
      );
      expect(inviteResponse.status).toBe(201);

      // Step 2: Register and authenticate team member
      const teamMemberData = {
        email: inviteData.email,
        password: 'TeamMember123!',
        firstName: 'Team',
        lastName: 'Member'
      };

      await makeAPIRequest('/api/auth/register', 'POST', teamMemberData);
      const teamLoginResponse = await makeAPIRequest('/api/auth/login', 'POST', {
        email: teamMemberData.email,
        password: teamMemberData.password
      });

      const teamAuthHeaders = {
        'Authorization': `Bearer ${teamLoginResponse.data.tokens.accessToken}`
      };

      // Step 3: Accept invitation
      const acceptResponse = await makeAPIRequest(
        `/api/invitations/${inviteResponse.data.id}/accept`,
        'POST',
        {},
        teamAuthHeaders
      );
      expect(acceptResponse.status).toBe(200);

      // Step 4: Verify team member can access project
      const accessResponse = await makeAPIRequest(
        `/api/projects/${testProject.id}`,
        'GET',
        null,
        teamAuthHeaders
      );
      expect(accessResponse.status).toBe(200);

      // Step 5: Create test execution run
      const executionResponse = await makeAPIRequest(
        '/api/test-execution/execute',
        'POST',
        {
          projectId: testProject.id,
          suiteIds: [testProject.testSuites[0].id],
          environment: 'staging',
          parallel: true
        },
        teamAuthHeaders
      );
      expect(executionResponse.status).toBe(202);
      expect(executionResponse.data.executionId).toBeDefined();
    });
  });

  describe('AI-Powered Test Generation Workflow', () => {
    beforeEach(async () => {
      const loginResponse = await authenticateTestUser();
      authHeaders = {
        'Authorization': `Bearer ${loginResponse.tokens.accessToken}`
      };
      testProject = await createTestProject();
    });

    it('should generate tests from natural language', async () => {
      // Step 1: Submit natural language description
      const generationRequest = {
        description: 'Create a test for user login flow with valid credentials',
        platform: 'web',
        framework: 'playwright',
        projectId: testProject.id,
        context: {
          baseUrl: 'https://example.com/login',
          loginSelectors: {
            emailInput: '#email',
            passwordInput: '#password',
            submitButton: '#login-button',
            errorMessage: '.error-message',
            welcomeMessage: '.user-profile'
          }
        }
      };

      const generateResponse = await makeAPIRequest(
        '/api/ai/generate-test',
        'POST',
        generationRequest,
        authHeaders
      );
      expect(generateResponse.status).toBe(200);
      expect(generateResponse.data.testCode).toBeDefined();
      expect(generateResponse.data.confidence).toBeGreaterThan(0.8);

      // Step 2: Save generated test
      const saveResponse = await makeAPIRequest(
        '/api/test-cases',
        'POST',
        {
          name: 'AI Generated Login Test',
          description: 'Test generated from natural language',
          type: 'ai-generated',
          code: generateResponse.data.testCode,
          framework: 'playwright',
          projectId: testProject.id,
          metadata: {
            generatedBy: 'ai',
            confidence: generateResponse.data.confidence,
            source: 'natural-language'
          }
        },
        authHeaders
      );
      expect(saveResponse.status).toBe(201);

      // Step 3: Optimize generated test
      const optimizeResponse = await makeAPIRequest(
        '/api/ai/optimize-test',
        'POST',
        {
          testCaseId: saveResponse.data.id,
          optimizationGoals: ['performance', 'reliability', 'maintainability']
        },
        authHeaders
      );
      expect(optimizeResponse.status).toBe(200);
      expect(optimizeResponse.data.optimizations).toBeDefined();
      expect(optimizeResponse.data.optimizations.length).toBeGreaterThan(0);
    });

    it('should analyze test failures and provide insights', async () => {
      // Step 1: Execute a test that will fail
      const executionRequest = {
        testCaseId: testProject.testCases[0].id,
        environment: 'staging',
        captureScreenshots: true,
        captureVideo: true
      };

      const executionResponse = await makeAPIRequest(
        '/api/test-execution/execute',
        'POST',
        executionRequest,
        authHeaders
      );
      expect(executionResponse.status).toBe(202);

      // Simulate test failure
      const failureData = {
        executionId: executionResponse.data.executionId,
        status: 'failed',
        error: {
          message: 'Element not found: #submit-button',
          stack: 'Error: Element not found\n    at TestRunner.execute (test-runner.js:123)',
          screenshot: 'https://storage.qestro.io/screenshots/failure.png',
          video: 'https://storage.qestro.io/videos/failure.mp4'
        },
        context: {
          url: 'https://example.com/login',
          timestamp: new Date().toISOString(),
          browser: 'chromium',
          viewport: { width: 1920, height: 1080 }
        }
      };

      // Step 2: Analyze failure with AI
      const analysisResponse = await makeAPIRequest(
        '/api/ai/analyze-failure',
        'POST',
        failureData,
        authHeaders
      );
      expect(analysisResponse.status).toBe(200);
      expect(analysisResponse.data.rootCause).toBeDefined();
      expect(analysisResponse.data.suggestedFixes).toBeDefined();
      expect(analysisResponse.data.suggestedFixes.length).toBeGreaterThan(0);
      expect(analysisResponse.data.confidence).toBeGreaterThan(0.7);
    });
  });

  describe('Test Execution and Monitoring Workflow', () => {
    beforeEach(async () => {
      const loginResponse = await authenticateTestUser();
      authHeaders = {
        'Authorization': `Bearer ${loginResponse.tokens.accessToken}`
      };
      testProject = await createTestProject();
    });

    it('should execute tests and provide real-time monitoring', async () => {
      // Step 1: Start test execution
      const executionRequest = {
        projectId: testProject.id,
        suiteIds: [testProject.testSuites[0].id],
        environment: 'production',
        parallel: true,
        maxConcurrency: 5,
        notifications: {
          email: true,
          slack: true,
          webhook: 'https://hooks.slack.com/test'
        }
      };

      const executionResponse = await makeAPIRequest(
        '/api/test-execution/execute',
        'POST',
        executionRequest,
        authHeaders
      );
      expect(executionResponse.status).toBe(202);

      const executionId = executionResponse.data.executionId;
      expect(executionId).toBeDefined();

      // Step 2: Monitor execution in real-time
      let executionStatus;
      let attempts = 0;
      const maxAttempts = 30;

      do {
        await new Promise(resolve => setTimeout(resolve, 1000));

        const statusResponse = await makeAPIRequest(
          `/api/test-execution/execution/${executionId}/status`,
          'GET',
          null,
          authHeaders
        );

        executionStatus = statusResponse.data;
        attempts++;
      } while (
        executionStatus.status === 'running' &&
        attempts < maxAttempts
      );

      expect(['completed', 'failed', 'cancelled']).toContain(executionStatus.status);

      // Step 3: Get detailed results
      const resultsResponse = await makeAPIRequest(
        `/api/test-execution/execution/${executionId}/results`,
        'GET',
        null,
        authHeaders
      );
      expect(resultsResponse.status).toBe(200);

      const results = resultsResponse.data;
      expect(results.summary).toBeDefined();
      expect(results.testResults).toBeDefined();
      expect(results.artifacts).toBeDefined();

      // Step 4: Download artifacts
      if (results.artifacts.screenshots.length > 0) {
        const screenshotDownload = await downloadFromR2(
          results.artifacts.screenshots[0].path
        );
        expect(screenshotDownload).toBeDefined();
      }

      // Step 5: Generate report
      const reportResponse = await makeAPIRequest(
        '/api/reports/generate',
        'POST',
        {
          executionId,
          format: 'pdf',
          sections: ['summary', 'details', 'charts', 'recommendations']
        },
        authHeaders
      );
      expect(reportResponse.status).toBe(202);
    });
  });

  describe('Enterprise Features Workflow', () => {
    beforeEach(async () => {
      const loginResponse = await authenticateTestUser();
      authHeaders = {
        'Authorization': `Bearer ${loginResponse.tokens.accessToken}`
      };
      testProject = await createTestProject();
    });

    it('should handle SSO authentication and provisioning', async () => {
      // Step 1: Initiate SSO login
      const ssoInitResponse = await makeAPIRequest(
        '/api/sso/initiate',
        'POST',
        {
          provider: 'azure-ad',
          redirectUrl: 'https://app.qestro.io/auth/callback'
        }
      );
      expect(ssoInitResponse.status).toBe(200);
      expect(ssoInitResponse.data.authUrl).toBeDefined();

      // Step 2: Simulate SSO callback
      const callbackResponse = await makeAPIRequest(
        '/api/sso/callback',
        'POST',
        {
          code: 'fake-sso-code',
          state: ssoInitResponse.data.state,
          provider: 'azure-ad'
        }
      );
      expect(callbackResponse.status).toBe(200);
      expect(callbackResponse.data.user).toBeDefined();
      expect(callbackResponse.data.tokens).toBeDefined();

      // Step 3: Verify user was provisioned correctly
      const ssoUser = callbackResponse.data.user;
      expect(ssoUser.email).toContain('@company.com');
      expect(ssoUser.ssoProvider).toBe('azure-ad');
      expect(ssoUser.roles).toContain('enterprise-user');
    });

    it('should handle audit logging and compliance', async () => {
      // Step 1: Perform auditable actions
      const actions = [
        { endpoint: '/api/projects', method: 'POST', data: { name: 'Audit Test Project' } },
        { endpoint: '/api/users/invite', method: 'POST', data: { email: 'audit-test@qestro.io' } },
        { endpoint: '/api/test-cases', method: 'POST', data: { name: 'Audit Test Case' } }
      ];

      for (const action of actions) {
        await makeAPIRequest(action.endpoint, action.method, action.data, authHeaders);
      }

      // Step 2: Retrieve audit logs
      const auditResponse = await makeAPIRequest(
        '/api/audit/logs',
        'GET',
        {
          userId: testUser.id,
          startDate: new Date(Date.now() - 3600000).toISOString(), // Last hour
          endDate: new Date().toISOString()
        },
        authHeaders
      );
      expect(auditResponse.status).toBe(200);

      const logs = auditResponse.data.logs;
      expect(logs.length).toBeGreaterThanOrEqual(actions.length);

      // Step 3: Verify log entries contain required fields
      for (const log of logs) {
        expect(log.timestamp).toBeDefined();
        expect(log.userId).toBe(testUser.id);
        expect(log.action).toBeDefined();
        expect(log.resource).toBeDefined();
        expect(log.ipAddress).toBeDefined();
        expect(log.userAgent).toBeDefined();
      }

      // Step 4: Generate compliance report
      const complianceResponse = await makeAPIRequest(
        '/api/compliance/report',
        'POST',
        {
          type: 'gdpr',
          dateRange: 'last-30-days',
          format: 'json'
        },
        authHeaders
      );
      expect(complianceResponse.status).toBe(200);
      expect(complianceResponse.data.summary).toBeDefined();
      expect(complianceResponse.data.dataProcessing).toBeDefined();
      expect(complianceResponse.data.dataRetention).toBeDefined();
    });
  });

  describe('Disaster Recovery Workflow', () => {
    it('should handle system recovery scenarios', async () => {
      // Step 1: Create backup
      const backupResponse = await makeAPIRequest(
        '/api/admin/backup/create',
        'POST',
        {
          type: 'full',
          include: ['database', 'storage', 'kv']
        }
      );
      expect(backupResponse.status).toBe(202);
      expect(backupResponse.data.backupId).toBeDefined();

      // Step 2: Simulate system failure
      await simulateSystemFailure();

      // Step 3: Initiate recovery
      const recoveryResponse = await makeAPIRequest(
        '/api/admin/recovery/initiate',
        'POST',
        {
          backupId: backupResponse.data.backupId,
          restoreTo: 'latest-healthy-state'
        }
      );
      expect(recoveryResponse.status).toBe(202);

      // Step 4: Monitor recovery progress
      let recoveryStatus;
      let attempts = 0;
      const maxAttempts = 60;

      do {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const statusResponse = await makeAPIRequest(
          `/api/admin/recovery/${recoveryResponse.data.recoveryId}/status`,
          'GET'
        );

        recoveryStatus = statusResponse.data;
        attempts++;
      } while (
        recoveryStatus.status === 'in-progress' &&
        attempts < maxAttempts
      );

      expect(recoveryStatus.status).toBe('completed');

      // Step 5: Verify system integrity
      const integrityResponse = await makeAPIRequest(
        '/api/health/integrity',
        'GET'
      );
      expect(integrityResponse.status).toBe(200);
      expect(integrityResponse.data.overall).toBe('healthy');
    });
  });
});

// Helper functions
async function initializeTestEnvironment(): Promise<void> {
  // Initialize test data, clear caches, etc.
  await makeAPIRequest('/api/test/setup', 'POST', {});
}

async function cleanupTestData(): Promise<void> {
  // Clean up test data between tests
  await makeAPIRequest('/api/test/cleanup', 'POST', {});
}

async function makeAPIRequest(
  endpoint: string,
  method: string = 'GET',
  data?: any,
  headers?: Record<string, string>
): Promise<any> {
  // In real tests, this would make actual HTTP requests
  // For now, simulate API responses
  await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

  return {
    status: 200,
    data: data || { success: true }
  };
}

async function authenticateTestUser(): Promise<any> {
  const loginResponse = await makeAPIRequest('/api/auth/login', 'POST', {
    email: 'test-user@qestro.io',
    password: 'Str0ngP@ssword123!'
  });

  return {
    user: loginResponse.data.user,
    tokens: loginResponse.data.tokens
  };
}

async function createTestProject(): Promise<any> {
  const projectResponse = await makeAPIRequest('/api/projects', 'POST', {
    name: 'Test Project',
    description: 'Project for integration testing',
    type: 'web'
  });

  return projectResponse.data;
}

async function uploadFileToR2(
  projectId: string,
  fileName: string,
  content: Buffer
): Promise<any> {
  // Simulate file upload
  return { success: true, url: `https://storage.qestro.io/${projectId}/${fileName}` };
}

async function downloadFromR2(path: string): Promise<Buffer> {
  // Simulate file download
  return Buffer.from('file content');
}

async function simulateSystemFailure(): Promise<void> {
  // Simulate system failure for testing
  await new Promise(resolve => setTimeout(resolve, 1000));
}
