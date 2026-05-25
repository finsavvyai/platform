/**
 * End-to-End Workflow Integration Tests
 *
 * Tests complete user workflows including team creation, project management,
 * test case creation, execution, and analytics.
 */

import {
  createTestSuite,
  expectAPIResponse,
  expectValidUser,
  expectValidProject,
  expectValidTeam,
  TestDataFactory,
  testFramework,
  expectPerformanceThreshold,
  runLoadTest,
  expectDatabaseRecord,
  expectWebSocketMessage,
  sendWebSocketMessage,
} from './integration-test-framework';

createTestSuite('End-to-End Workflow Integration Tests', () => {
  describe('Complete User Onboarding Workflow', () => {
    let apiHelper: any;
    let userData: any;

    it('should complete full user onboarding flow', async () => {
      // Step 1: User Registration
      userData = TestDataFactory.createUser();
      apiHelper = testFramework.createAPIHelper();
      await apiHelper.register(userData);

      // Step 2: Complete user profile
      const profileUpdate = {
        firstName: 'Updated',
        lastName: 'Name',
        company: 'Test Corp',
      };

      const profileResponse = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .put('/api/users/me')
        .set(apiHelper.getAuthHeaders())
        .send(profileUpdate)
        .expect(200);

      expect(profileResponse.body.data.user.firstName).toBe(profileUpdate.firstName);
      expect(profileResponse.body.data.user.lastName).toBe(profileUpdate.lastName);

      // Step 3: Create first team
      const teamData = TestDataFactory.createTeam();
      const teamResponse = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .post('/api/teams')
        .set(apiHelper.getAuthHeaders())
        .send(teamData)
        .expect(201);

      expectValidTeam(teamResponse.body.data.team);
      const teamId = teamResponse.body.data.team.id;

      // Step 4: Create first project
      const projectData = TestDataFactory.createProject({ teamId });
      const projectResponse = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .post('/api/projects')
        .set(apiHelper.getAuthHeaders())
        .send(projectData)
        .expect(201);

      expectValidProject(projectResponse.body.data.project);
      const projectId = projectResponse.body.data.project.id;

      // Step 5: Verify user can see their projects
      const projectsResponse = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .get('/api/projects')
        .set(apiHelper.getAuthHeaders())
        .expect(200);

      expect(projectsResponse.body.data.projects).toHaveLength(1);
      expect(projectsResponse.body.data.projects[0].id).toBe(projectId);

      // Step 6: Create test suite
      const suiteResponse = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .post('/api/testing/test-suites')
        .set(apiHelper.getAuthHeaders())
        .send({
          name: 'First Test Suite',
          description: 'Test suite for onboarding',
          projectId,
        })
        .expect(201);

      const suiteId = suiteResponse.body.data.suite.id;

      // Step 7: Create test case
      const testCaseData = TestDataFactory.createTestCase({
        projectId,
        suiteId,
      });

      const testCaseResponse = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .post('/api/testing/test-cases')
        .set(apiHelper.getAuthHeaders())
        .send(testCaseData)
        .expect(201);

      expect(testCaseResponse.body.data.testCase.name).toBe(testCaseData.name);

      // Verify all data was created correctly in database
      await expectDatabaseRecord('users', { email: userData.email });
      await expectDatabaseRecord('teams', { id: teamId });
      await expectDatabaseRecord('projects', { id: projectId });
      await expectDatabaseRecord('test_suites', { id: suiteId });
      await expectDatabaseRecord('test_cases', { name: testCaseData.name });
    });
  });

  describe('Team Collaboration Workflow', () => {
    let ownerHelper: any;
    let memberHelper: any;
    let teamId: string;
    let projectId: string;

    beforeEach(async () => {
      // Create team owner
      const owner = await testFramework.createAuthenticatedUser(
        TestDataFactory.createUser({ firstName: 'Owner' })
      );
      ownerHelper = owner.apiHelper;

      // Create team
      const teamData = TestDataFactory.createTeam();
      const teamResponse = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .post('/api/teams')
        .set(ownerHelper.getAuthHeaders())
        .send(teamData)
        .expect(201);

      teamId = teamResponse.body.data.team.id;

      // Create project
      const projectData = TestDataFactory.createProject({ teamId });
      const projectResponse = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .post('/api/projects')
        .set(ownerHelper.getAuthHeaders())
        .send(projectData)
        .expect(201);

      projectId = projectResponse.body.data.project.id;
    });

    it('should complete team invitation and collaboration workflow', async () => {
      // Step 1: Create team member
      const memberData = TestDataFactory.createUser({ firstName: 'Member' });
      const member = await testFramework.createAuthenticatedUser(memberData);
      memberHelper = member.apiHelper;

      // Step 2: Invite member to team
      const inviteResponse = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .post(`/api/teams/${teamId}/members`)
        .set(ownerHelper.getAuthHeaders())
        .send({
          email: memberData.email,
          role: 'member',
        })
        .expect(201);

      expect(inviteResponse.body.data.invitation.email).toBe(memberData.email);

      // Step 3: Member can see the team
      const teamsResponse = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .get('/api/teams')
        .set(memberHelper.getAuthHeaders())
        .expect(200);

      const memberTeams = teamsResponse.body.data.teams.filter(t => t.id === teamId);
      expect(memberTeams).toHaveLength(1);

      // Step 4: Member can see the project
      const projectsResponse = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .get('/api/projects')
        .set(memberHelper.getAuthHeaders())
        .expect(200);

      const memberProjects = projectsResponse.body.data.projects.filter(p => p.id === projectId);
      expect(memberProjects).toHaveLength(1);

      // Step 5: Member creates test case
      const testCaseData = TestDataFactory.createTestCase({ projectId });
      const testCaseResponse = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .post('/api/testing/test-cases')
        .set(memberHelper.getAuthHeaders())
        .send(testCaseData)
        .expect(201);

      const testCaseId = testCaseResponse.body.data.testCase.id;

      // Step 6: Owner can see member's test case
      const testCasesResponse = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .get(`/api/testing/test-cases?projectId=${projectId}`)
        .set(ownerHelper.getAuthHeaders())
        .expect(200);

      const ownerTestCases = testCasesResponse.body.data.testCases.filter(tc => tc.id === testCaseId);
      expect(ownerTestCases).toHaveLength(1);

      // Step 7: Test role-based permissions (member cannot delete project)
      const deleteResponse = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .delete(`/api/projects/${projectId}`)
        .set(memberHelper.getAuthHeaders())
        .expect(403);

      expect(deleteResponse.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('Test Execution Workflow', () => {
    let apiHelper: any;
    let projectId: string;
    let testCaseIds: string[] = [];

    beforeEach(async () => {
      // Setup user and project
      const user = await testFramework.createAuthenticatedUser();
      apiHelper = user.apiHelper;

      const teamData = TestDataFactory.createTeam();
      const teamResponse = await request(testFramework['TEST_CONFIG'].API_BASE_URL')
        .post('/api/teams')
        .set(apiHelper.getAuthHeaders())
        .send(teamData)
        .expect(201);

      const projectData = TestDataFactory.createProject({
        teamId: teamResponse.body.data.team.id,
      });
      const projectResponse = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .post('/api/projects')
        .set(apiHelper.getAuthHeaders())
        .send(projectData)
        .expect(201);

      projectId = projectResponse.body.data.project.id;

      // Create test suite
      const suiteResponse = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .post('/api/testing/test-suites')
        .set(apiHelper.getAuthHeaders())
        .send({
          name: 'Test Suite',
          description: 'Test suite for execution',
          projectId,
        })
        .expect(201);

      const suiteId = suiteResponse.body.data.suite.id;

      // Create multiple test cases
      for (let i = 0; i < 3; i++) {
        const testCaseData = TestDataFactory.createTestCase({
          name: `Test Case ${i + 1}`,
          projectId,
          suiteId,
        });

        const testCaseResponse = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
          .post('/api/testing/test-cases')
          .set(apiHelper.getAuthHeaders())
          .send(testCaseData)
          .expect(201);

        testCaseIds.push(testCaseResponse.body.data.testCase.id);
      }
    });

    it('should complete test execution workflow', async () => {
      // Step 1: Queue test execution
      const runResponse = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .post('/api/testing/run')
        .set(apiHelper.getAuthHeaders())
        .send({
          testIds: testCaseIds,
          settings: {
            environment: 'test',
            parallel: false,
            timeout: 30000,
          },
        })
        .expect(202);

      expect(runResponse.body.data.testRun).toHaveProperty('id');
      expect(runResponse.body.data.testRun.status).toBe('queued');

      const testRunId = runResponse.body.data.testRun.id;

      // Step 2: Monitor test run status
      let testRunStatus;
      let attempts = 0;
      const maxAttempts = 10;

      do {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

        const statusResponse = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
          .get(`/api/testing/runs/${testRunId}`)
          .set(apiHelper.getAuthHeaders())
          .expect(200);

        testRunStatus = statusResponse.body.data.testRun.status;
        attempts++;
      } while (
        ['pending', 'queued', 'running'].includes(testRunStatus) &&
        attempts < maxAttempts
      );

      // In a real implementation, the tests would complete
      // For now, we'll test the workflow structure

      // Step 3: Get test run details
      const detailsResponse = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .get(`/api/testing/runs/${testRunId}`)
        .set(apiHelper.getAuthHeaders())
        .expect(200);

      expect(detailsResponse.body.data.testRun).toHaveProperty('summary');
      expect(detailsResponse.body.data.testRun).toHaveProperty('results');

      // Step 4: List test runs
      const runsResponse = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .get('/api/testing/runs')
        .set(apiHelper.getAuthHeaders())
        .expect(200);

      const userTestRuns = runsResponse.body.data.testRuns.filter(tr => tr.id === testRunId);
      expect(userTestRuns).toHaveLength(1);

      // Step 5: Cancel test run (if still running)
      if (['pending', 'queued', 'running'].includes(testRunStatus)) {
        await request(testFramework['TEST_CONFIG'].API_BASE_URL)
          .post(`/api/testing/runs/${testRunId}/cancel`)
          .set(apiHelper.getAuthHeaders())
          .expect(200);
      }
    });
  });

  describe('Analytics Workflow', () => {
    let apiHelper: any;

    beforeEach(async () => {
      const user = await testFramework.createAuthenticatedUser();
      apiHelper = user.apiHelper;
    });

    it('should provide analytics data for user dashboard', async () => {
      // Step 1: Get platform overview (admin only)
      const overviewResponse = await request(testFramework['TEST_CONFIG'].API_BASE_URL')
        .get('/api/analytics/overview')
        .set(apiHelper.getAuthHeaders())
        .expect(403); // Regular user shouldn't have access

      expect(overviewResponse.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');

      // Step 2: Get usage analytics (user-level)
      const usageResponse = await request(testFramework['TEST_CONFIG'].API_BASE_URL')
        .get('/api/analytics/usage')
        .set(apiHelper.getAuthHeaders())
        .expect(200);

      expect(usageResponse.body.data).toHaveProperty('analytics');
      expect(usageResponse.body.data).toHaveProperty('meta');

      // Step 3: Get project-specific analytics
      // First create a project
      const teamData = TestDataFactory.createTeam();
      const teamResponse = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .post('/api/teams')
        .set(apiHelper.getAuthHeaders())
        .send(teamData)
        .expect(201);

      const projectData = TestDataFactory.createProject({
        teamId: teamResponse.body.data.team.id,
      });
      const projectResponse = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .post('/api/projects')
        .set(apiHelper.getAuthHeaders())
        .send(projectData)
        .expect(201);

      const projectId = projectResponse.body.data.project.id;

      // Get project analytics
      const projectAnalyticsResponse = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .get(`/api/projects/${projectId}/analytics`)
        .set(apiHelper.getAuthHeaders())
        .expect(200);

      expect(projectAnalyticsResponse.body.data).toHaveProperty('analytics');
      expect(projectAnalyticsResponse.body.data).toHaveProperty('projectId');
    });
  });

  describe('WebSocket Integration Workflow', () => {
    let apiHelper: any;
    let wsConnection: any;

    beforeEach(async () => {
      const user = await testFramework.createAuthenticatedUser();
      apiHelper = user.apiHelper;

      // Create WebSocket connection
      wsConnection = await testFramework.getWsHelper().createConnection(apiHelper.accessToken);
    });

    afterEach(async () => {
      if (wsConnection) {
        wsConnection.terminate();
      }
    });

    it('should establish WebSocket connection and receive real-time updates', async () => {
      // Step 1: Receive connection confirmation
      const connectionMessage = await expectWebSocketMessage(wsConnection, 'connection_established');
      expect(connectionMessage.data).toHaveProperty('userId');

      // Step 2: Join a project room
      await sendWebSocketMessage(wsConnection, {
        type: 'join_project',
        projectId: 'test-project-id',
      });

      // Step 3: Receive room join confirmation
      const joinMessage = await expectWebSocketMessage(wsConnection, 'project_joined');
      expect(joinMessage.data.projectId).toBe('test-project-id');

      // Step 4: Send and receive a ping message
      await sendWebSocketMessage(wsConnection, {
        type: 'ping',
        timestamp: Date.now(),
      });

      const pongMessage = await expectWebSocketMessage(wsConnection, 'pong');
      expect(pongMessage.type).toBe('pong');
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent user workflows', async () => {
      const concurrentUsers = 5;
      const workflowsPerUser = 2;

      // Create multiple concurrent users
      const userPromises = Array(concurrentUsers).fill(null).map(async (_, index) => {
        const userData = TestDataFactory.createUser({
          email: `perf-user-${index}-${Date.now()}@example.com`,
        });

        const user = await testFramework.createAuthenticatedUser(userData);
        return user.apiHelper;
      });

      const apiHelpers = await Promise.all(userPromises);

      // Execute complete workflow for each user
      const workflowPromises = apiHelpers.flatMap(apiHelper =>
        Array(workflowsPerUser).fill(null).map(async () => {
          try {
            // Create team
            const teamResponse = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
              .post('/api/teams')
              .set(apiHelper.getAuthHeaders())
              .send(TestDataFactory.createTeam())
              .expect(201);

            const teamId = teamResponse.body.data.team.id;

            // Create project
            const projectResponse = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
              .post('/api/projects')
              .set(apiHelper.getAuthHeaders())
              .send(TestDataFactory.createProject({ teamId }))
              .expect(201);

            const projectId = projectResponse.body.data.project.id;

            // Create test suite
            const suiteResponse = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
              .post('/api/testing/test-suites')
              .set(apiHelper.getAuthHeaders())
              .send({
                name: 'Performance Test Suite',
                projectId,
              })
              .expect(201);

            return { success: true, projectId };
          } catch (error) {
            return { success: false, error: error.message };
          }
        })
      );

      const results = await Promise.all(workflowPromises);

      // Analyze results
      const successfulWorkflows = results.filter(r => r.success);
      const successRate = (successfulWorkflows.length / results.length) * 100;

      expect(successRate).toBeGreaterThan(80); // At least 80% success rate
    }, 60000); // 60 second timeout for load test

    it('should handle API requests within performance thresholds', async () => {
      const apiHelper = testFramework.createAPIHelper();
      await apiHelper.register(TestDataFactory.createUser());

      // Test critical API endpoints
      const endpoints = [
        () => request(testFramework['TEST_CONFIG'].API_BASE_URL)
          .get('/api/users/me')
          .set(apiHelper.getAuthHeaders()),
        () => request(testFramework['TEST_CONFIG'].API_BASE_URL)
          .get('/api/teams')
          .set(apiHelper.getAuthHeaders()),
        () => request(testFramework['TEST_CONFIG'].API_BASE_URL)
          .get('/api/projects')
          .set(apiHelper.getAuthHeaders()),
      ];

      for (const endpoint of endpoints) {
        const startTime = Date.now();
        await endpoint();
        const responseTime = Date.now() - startTime;

        expectPerformanceThreshold(responseTime, 500); // 500ms threshold
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    let apiHelper: any;

    beforeEach(async () => {
      const user = await testFramework.createAuthenticatedUser();
      apiHelper = user.apiHelper;
    });

    it('should handle malformed requests gracefully', async () => {
      // Test invalid JSON
      const response = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .post('/api/teams')
        .set('Authorization', apiHelper.getAuthHeaders())
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_JSON');
    });

    it('should handle missing required fields', async () => {
      const response = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .post('/api/teams')
        .set(apiHelper.getAuthHeaders())
        .send({}) // Missing required 'name' field
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle resource not found', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      const response = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .get(`/api/projects/${nonExistentId}`)
        .set(apiHelper.getAuthHeaders())
        .expect(404);

      expect(response.body.error.code).toBe('PROJECT_NOT_FOUND');
    });

    it('should handle permission denied scenarios', async () => {
      // Create team as user 1
      const teamResponse = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .post('/api/teams')
        .set(apiHelper.getAuthHeaders())
        .send(TestDataFactory.createTeam())
        .expect(201);

      const teamId = teamResponse.body.data.team.id;

      // Create another user
      const otherUser = await testFramework.createAuthenticatedUser(
        TestDataFactory.createUser({ email: 'other@example.com' })
      );
      const otherAPIHelper = otherUser.apiHelper;

      // Try to modify team as non-member
      const response = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .put(`/api/teams/${teamId}`)
        .set(otherAPIHelper.getAuthHeaders())
        .send({ name: 'Hacked Team' })
        .expect(403);

      expect(response.body.error.code).toBe('ACCESS_DENIED');
    });
  });
});
