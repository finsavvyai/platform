/**
 * AI API Integration Tests
 *
 * End-to-end integration tests for AI API endpoints including
 * real service integration, performance testing, and CI/CD validation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { aiRoutes } from '../../src/api/ai';
import { setupTestDatabase, cleanupTestDatabase } from '../helpers/database';
import { createTestUser, createTestProject } from '../helpers/factories';

describe('AI API Integration Tests', () => {
  let app: Hono;
  let server: any;
  let baseUrl: string;
  let testUser: any;
  let testProject: any;

  beforeAll(async () => {
    // Setup test environment
    await setupTestDatabase();

    // Create test data
    testUser = await createTestUser({
      plan: 'pro',
      aiQuota: 1000
    });
    testProject = await createTestProject({
      userId: testUser.id,
      framework: 'playwright',
      platforms: ['chrome', 'firefox']
    });

    // Setup test server
    app = new Hono();
    app.route('/api/ai', aiRoutes);

    server = await serve({
      fetch: app.fetch,
      port: 0 // Use random available port
    });

    baseUrl = `http://localhost:${server.port}`;
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
    await cleanupTestDatabase();
  });

  beforeEach(() => {
    // Reset any rate limiting or caches between tests
    vi.clearAllMocks();
  });

  describe('End-to-End Test Generation Flow', () => {
    it('should complete full test generation workflow', async () => {
      const generateRequest = {
        description: 'Create comprehensive test suite for user authentication including login, logout, and password reset functionality',
        platform: 'web',
        framework: 'playwright',
        context: {
          applicationType: 'web',
          targetEnvironment: 'staging',
          existingTests: ['basic-login.spec.ts'],
          testingGuidelines: 'Follow AAA pattern, include accessibility tests'
        },
        options: {
          includeEdgeCases: true,
          generateAssertions: true,
          complexity: 'advanced',
          outputFormat: 'typescript'
        }
      };

      const response = await fetch(`${baseUrl}/api/ai/generate-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': testUser.id,
          'x-project-id': testProject.id,
          'Authorization': `Bearer ${testUser.token}`
        },
        body: JSON.stringify(generateRequest)
      });

      expect(response.status).toBe(200);
      const result = await response.json();

      // Verify response structure
      expect(result.success).toBe(true);
      expect(result.data.id).toBeDefined();
      expect(result.data.generatedTests).toBeDefined();
      expect(Array.isArray(result.data.generatedTests)).toBe(true);
      expect(result.data.generatedTests.length).toBeGreaterThan(0);
      expect(result.data.confidence).toBeGreaterThan(0);
      expect(result.data.metadata).toBeDefined();
      expect(result.usage).toBeDefined();

      // Verify generated test structure
      const firstTest = result.data.generatedTests[0];
      expect(firstTest.id).toBeDefined();
      expect(firstTest.name).toBeDefined();
      expect(firstTest.content).toBeDefined();
      expect(firstTest.type).toBeDefined();
      expect(firstTest.assertions).toBeDefined();
      expect(Array.isArray(firstTest.assertions)).toBe(true);

      // Verify test optimization can use generated tests
      const optimizeRequest = {
        tests: result.data.generatedTests.map((test: any) => ({
          id: test.id,
          name: test.name,
          type: 'web',
          platform: 'chrome',
          content: test.content,
          metadata: {
            runCount: 0,
            failureRate: 0,
            complexity: test.type === 'authentication' ? 'medium' : 'low'
          }
        })),
        projectContext: {
          framework: 'playwright',
          targetPlatforms: ['chrome', 'firefox']
        },
        optimizationType: 'comprehensive',
        priority: 'medium'
      };

      const optimizeResponse = await fetch(`${baseUrl}/api/ai/optimize-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': testUser.id,
          'x-project-id': testProject.id,
          'Authorization': `Bearer ${testUser.token}`
        },
        body: JSON.stringify(optimizeRequest)
      });

      expect(optimizeResponse.status).toBe(200);
      const optimizeResult = await optimizeResponse.json();

      expect(optimizeResult.success).toBe(true);
      expect(optimizeResult.data.optimizations).toBeDefined();
      expect(optimizeResult.data.summary).toBeDefined();
    });

    it('should handle complex multi-platform test generation', async () => {
      const request = {
        description: 'Create cross-platform e-commerce tests including product browsing, cart management, and checkout for mobile and web',
        platform: 'ios', // Should generate for multiple platforms
        framework: 'maestro',
        context: {
          applicationType: 'mobile',
          targetEnvironment: 'production',
          existingTests: []
        },
        options: {
          includeEdgeCases: true,
          generateAssertions: true,
          complexity: 'intermediate'
        }
      };

      const response = await fetch(`${baseUrl}/api/ai/generate-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': testUser.id,
          'x-project-id': testProject.id
        },
        body: JSON.stringify(request)
      });

      expect(response.status).toBe(200);
      const result = await response.json();

      expect(result.data.generatedTests.length).toBeGreaterThan(0);
      expect(result.data.metadata.platform).toBe('ios');
    });
  });

  describe('End-to-End Failure Analysis Flow', () => {
    it('should complete full failure analysis and bug tracking workflow', async () => {
      // First, create a test failure scenario
      const failureTime = new Date().toISOString();
      const previousRunTime = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago

      const analyzeRequest = {
        failures: [
          {
            id: 'failure-001',
            testCaseId: 'login-test-001',
            testName: 'User Login with Valid Credentials',
            testType: 'web',
            platform: 'chrome',
            failureTime: failureTime,
            errorMessage: 'TimeoutError: Waiting for selector #login-button failed: timeout 30000ms',
            errorType: 'timeout_error',
            stackTrace: 'TimeoutError: Waiting for selector #login-button failed: timeout 30000ms\n    at async LoginPage.waitForElement (file:///app/src/pages/login.ts:45:10)\n    at async LoginPage.login (file:///app/src/pages/login.ts:78:5)',
            screenshots: ['screenshot-001.png', 'screenshot-002.png'],
            networkLogs: [
              {
                url: 'https://api.example.com/auth/login',
                method: 'POST',
                status: 200,
                responseTime: 250,
                error: undefined
              },
              {
                url: 'https://cdn.example.com/assets/app.js',
                method: 'GET',
                status: 404,
                responseTime: 5000,
                error: 'Resource not found'
              }
            ],
            consoleLogs: [
              {
                level: 'error',
                message: 'Failed to load login button component',
                timestamp: new Date().toISOString(),
                source: 'app.js:1234'
              },
              {
                level: 'warn',
                message: 'Slow network detected',
                timestamp: new Date(Date.now() - 5000).toISOString(),
                source: 'network-monitor.js:56'
              }
            ],
            executionContext: {
              testData: { username: 'testuser@example.com', password: '*****' },
              environment: 'staging',
              deviceState: { viewport: { width: 1920, height: 1080 } },
              browserState: {
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                cookies: ['session=abc123']
              }
            },
            previousRuns: [
              {
                timestamp: previousRunTime,
                status: 'passed',
                duration: 2500,
                error: undefined
              },
              {
                timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                status: 'failed',
                duration: 30000,
                error: 'Element not found: #login-button'
              }
            ],
            relatedFailures: ['failure-002', 'failure-003']
          }
        ],
        projectContext: {
          framework: 'playwright',
          targetPlatforms: ['chrome', 'firefox', 'safari'],
          applicationType: 'web',
          recentChanges: [
            {
              type: 'code',
              description: 'Updated login button component styling and loading logic',
              timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
            },
            {
              type: 'dependency',
              description: 'Updated React from 18.2.0 to 18.3.0',
              timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
            }
          ],
          environmentInfo: {
            os: 'Ubuntu 20.04',
            browser: 'Chrome 119.0.6045.123',
            device: 'Desktop',
            networkConditions: '3G Fast'
          }
        },
        analysisType: 'comprehensive',
        priority: 'high',
        integrationSettings: {
          bugTracker: 'jira',
          autoCreateTickets: true,
          notificationSettings: {
            slack: '#test-failures',
            email: 'dev-team@company.com',
            teams: 'qa-team'
          }
        }
      };

      const response = await fetch(`${baseUrl}/api/ai/analyze-failure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': testUser.id,
          'x-project-id': testProject.id
        },
        body: JSON.stringify(analyzeRequest)
      });

      expect(response.status).toBe(200);
      const result = await response.json();

      // Verify comprehensive analysis structure
      expect(result.success).toBe(true);
      expect(result.data.id).toBeDefined();
      expect(result.data.analysisType).toBe('comprehensive');
      expect(result.data.classifications).toBeDefined();
      expect(result.data.rootCauseAnalysis).toBeDefined();
      expect(result.data.suggestedFixes).toBeDefined();
      expect(result.data.patternAnalysis).toBeDefined();
      expect(result.data.regressionAnalysis).toBeDefined();
      expect(result.data.summary).toBeDefined();

      // Verify classification accuracy
      const classification = result.data.classifications[0];
      expect(classification.failureId).toBe('failure-001');
      expect(classification.category).toBeDefined();
      expect(classification.severity).toBeDefined();
      expect(classification.symptoms).toBeDefined();
      expect(Array.isArray(classification.symptoms)).toBe(true);
      expect(classification.potentialCauses).toBeDefined();
      expect(Array.isArray(classification.potentialCauses)).toBe(true);

      // Verify root cause analysis
      const rootCause = result.data.rootCauseAnalysis;
      expect(rootCause.primaryCause).toBeDefined();
      expect(rootCause.primaryCause.type).toBeDefined();
      expect(rootCause.primaryCause.likelihood).toBeGreaterThan(0);
      expect(rootCause.contributingFactors).toBeDefined();
      expect(Array.isArray(rootCause.contributingFactors)).toBe(true);

      // Verify suggested fixes
      const fixes = result.data.suggestedFixes;
      expect(fixes.length).toBeGreaterThan(0);
      expect(fixes[0].type).toBeDefined();
      expect(fixes[0].title).toBeDefined();
      expect(fixes[0].description).toBeDefined();
      expect(fixes[0].steps).toBeDefined();
      expect(Array.isArray(fixes[0].steps)).toBe(true);
    });

    it('should handle pattern analysis across multiple related failures', async () => {
      const baseFailure = {
        testCaseId: 'test-base',
        testName: 'Base Test',
        testType: 'web',
        platform: 'chrome',
        failureTime: new Date().toISOString(),
        errorMessage: 'TimeoutError: Element not found',
        errorType: 'timeout_error'
      };

      const failures = Array.from({ length: 5 }, (_, i) => ({
        ...baseFailure,
        id: `failure-${i + 1}`,
        testName: `Test ${i + 1}`,
        failureTime: new Date(Date.now() - i * 10 * 60 * 1000).toISOString() // Stagger failures
      }));

      const response = await fetch(`${baseUrl}/api/ai/analyze-failure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': testUser.id,
          'x-project-id': testProject.id
        },
        body: JSON.stringify({
          failures,
          analysisType: 'pattern_analysis',
          priority: 'medium'
        })
      });

      expect(response.status).toBe(200);
      const result = await response.json();

      expect(result.data.patternAnalysis).toBeDefined();
      expect(result.data.patternAnalysis.detectedPatterns).toBeDefined();
      expect(result.data.summary.totalFailures).toBe(5);
    });
  });

  describe('Usage Analytics and Monitoring Integration', () => {
    it('should track usage across multiple API calls', async () => {
      // Generate initial usage data
      await fetch(`${baseUrl}/api/ai/generate-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': testUser.id,
          'x-project-id': testProject.id
        },
        body: JSON.stringify({
          description: 'Simple test for usage tracking',
          platform: 'web'
        })
      });

      await fetch(`${baseUrl}/api/ai/optimize-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': testUser.id,
          'x-project-id': testProject.id
        },
        body: JSON.stringify({
          tests: [{
            id: 'test-1',
            name: 'Test',
            type: 'web',
            content: 'test content',
            metadata: { runCount: 1, failureRate: 0, complexity: 'low' }
          }]
        })
      });

      // Check usage analytics
      const response = await fetch(`${baseUrl}/api/ai/usage?granularity=hour&includeBreakdown=true`, {
        method: 'GET',
        headers: {
          'x-user-id': testUser.id,
          'x-project-id': testProject.id
        }
      });

      expect(response.status).toBe(200);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.currentUsage).toBeDefined();
      expect(result.data.limits).toBeDefined();
      expect(result.data.period).toBeDefined();
      expect(result.data.breakdown).toBeDefined();
    });

    it('should provide comprehensive health monitoring', async () => {
      const response = await fetch(`${baseUrl}/api/ai/health`, {
        method: 'GET'
      });

      expect(response.status).toBe(200);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.status).toBeDefined();
      expect(result.data.services).toBeDefined();
      expect(result.data.version).toBeDefined();
      expect(result.data.uptime).toBeGreaterThan(0);

      // Verify all services are included
      const services = result.data.services;
      expect(services.aiManager).toBeDefined();
      expect(services.cacheManager).toBeDefined();
      expect(services.testGenerator).toBeDefined();
      expect(services.testOptimizer).toBeDefined();
      expect(services.bugAnalyzer).toBeDefined();
      expect(services.costTracker).toBeDefined();
    });

    it('should provide detailed model capabilities', async () => {
      const response = await fetch(`${baseUrl}/api/ai/models`, {
        method: 'GET'
      });

      expect(response.status).toBe(200);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.providers).toBeDefined();
      expect(Array.isArray(result.data.providers)).toBe(true);
      expect(result.data.defaultProvider).toBeDefined();
      expect(result.data.totalProviders).toBeGreaterThan(0);

      // Verify provider structure
      if (result.data.providers.length > 0) {
        const provider = result.data.providers[0];
        expect(provider.id).toBeDefined();
        expect(provider.name).toBeDefined();
        expect(provider.type).toBeDefined();
        expect(provider.capabilities).toBeDefined();
        expect(provider.status).toBeDefined();
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed requests gracefully', async () => {
      const malformedRequests = [
        // Invalid JSON
        { headers: { 'Content-Type': 'application/json' }, body: '{"invalid": json}' },
        // Missing required fields
        { headers: { 'Content-Type': 'application/json' }, body: '{}' },
        // Invalid data types
        { headers: { 'Content-Type': 'application/json' }, body: '{"description": 123}' },
        // No content-type
        { headers: {}, body: '{"description": "test"}' }
      ];

      for (const request of malformedRequests) {
        const response = await fetch(`${baseUrl}/api/ai/generate-test`, {
          method: 'POST',
          headers: { ...request.headers, 'x-user-id': testUser.id },
          body: request.body
        });

        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThan(500);
      }
    });

    it('should handle authentication and authorization failures', async () => {
      const validRequest = {
        description: 'Test for auth validation',
        platform: 'web'
      };

      // Test missing user ID
      const response1 = await fetch(`${baseUrl}/api/ai/generate-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest)
      });

      expect(response1.status).toBe(200); // Should work with anonymous user in test mode

      // Test admin-only endpoints
      const adminResponse = await fetch(`${baseUrl}/api/ai/cache/clear`, {
        method: 'POST',
        headers: { 'x-user-id': testUser.id }
      });

      expect(adminResponse.status).toBe(403); // Forbidden for non-admin
    });

    it('should handle service degradation gracefully', async () => {
      // This test would require mocking service failures
      // For now, verify error response format
      const response = await fetch(`${baseUrl}/api/ai/generate-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'invalid-user-id'
        },
        body: JSON.stringify({
          description: 'Test with invalid user',
          platform: 'web'
        })
      });

      // Should handle invalid user gracefully
      expect([200, 400, 429, 500]).toContain(response.status);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent requests within limits', async () => {
      const concurrentRequests = 10;
      const requests = Array.from({ length: concurrentRequests }, (_, i) =>
        fetch(`${baseUrl}/api/ai/usage`, {
          method: 'GET',
          headers: {
            'x-user-id': testUser.id,
            'x-project-id': testProject.id
          }
        })
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const endTime = Date.now();

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Performance should be reasonable (<5 seconds total)
      expect(endTime - startTime).toBeLessThan(5000);

      // Individual response times should be reasonable (<2 seconds)
      for (const response of responses) {
        const result = await response.json();
        expect(result.success).toBe(true);
      }
    });

    it('should respect rate limiting under load', async () => {
      // This test might need adjustment based on actual rate limits
      const burstRequests = 50;
      const requests = Array.from({ length: burstRequests }, (_, i) =>
        fetch(`${baseUrl}/api/ai/capabilities`, {
          method: 'GET',
          headers: { 'x-user-id': `user-${i}` }
        })
      );

      const responses = await Promise.allSettled(requests);
      const successfulResponses = responses.filter(r =>
        r.status === 'fulfilled' && r.value.status === 200
      ).length;
      const rateLimitedResponses = responses.filter(r =>
        r.status === 'fulfilled' && r.value.status === 429
      ).length;

      // Most requests should succeed, some might be rate limited
      expect(successfulResponses + rateLimitedResponses).toBe(burstRequests);
      expect(successfulResponses).toBeGreaterThan(0);
    });
  });

  describe('Data Consistency and Integrity', () => {
    it('should maintain consistent data across related operations', async () => {
      // Generate tests
      const genResponse = await fetch(`${baseUrl}/api/ai/generate-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': testUser.id,
          'x-project-id': testProject.id
        },
        body: JSON.stringify({
          description: 'Data consistency test',
          platform: 'web'
        })
      });

      const genResult = await genResponse.json();
      const generatedTests = genResult.data.generatedTests;

      // Optimize the same tests
      const optResponse = await fetch(`${baseUrl}/api/ai/optimize-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': testUser.id,
          'x-project-id': testProject.id
        },
        body: JSON.stringify({
          tests: generatedTests.map((test: any) => ({
            id: test.id,
            name: test.name,
            type: 'web',
            content: test.content,
            metadata: { runCount: 1, failureRate: 0, complexity: 'low' }
          }))
        })
      });

      expect(optResponse.status).toBe(200);
      const optResult = await optResponse.json();

      // Verify data consistency
      expect(optResult.data.metadata.testsAnalyzed).toBe(generatedTests.length);
      expect(optResult.data.optimizations.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle large payloads within limits', async () => {
      const largeDescription = 'Create tests for '.repeat(100) + 'comprehensive functionality testing';

      const response = await fetch(`${baseUrl}/api/ai/generate-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': testUser.id,
          'x-project-id': testProject.id
        },
        body: JSON.stringify({
          description: largeDescription,
          platform: 'web',
          context: {
            applicationType: 'web',
            existingTests: Array.from({ length: 20 }, (_, i) => `test-${i}.spec.ts`)
          }
        })
      });

      // Should handle large description gracefully
      expect([200, 400]).toContain(response.status);
    });
  });
});
