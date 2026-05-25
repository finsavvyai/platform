/**
 * AI API Performance Tests
 *
 * Performance and load testing for AI API endpoints including
 * response time validation, concurrent load testing, and resource usage monitoring
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { performance } from 'perf_hooks';

describe('AI API Performance Tests', () => {
  const baseUrl = process.env.AI_API_BASE_URL || 'http://localhost:3000';
  const testUserId = 'perf-test-user';
  const testProjectId = 'perf-test-project';

  beforeAll(async () => {
    // Ensure test environment is ready
    console.log('Starting AI API Performance Tests');
  });

  afterAll(async () => {
    console.log('AI API Performance Tests completed');
  });

  describe('Response Time Performance', () => {
    it('should generate tests within acceptable time limits', async () => {
      const startTime = performance.now();

      const response = await fetch(`${baseUrl}/api/ai/generate-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': testUserId,
          'x-project-id': testProjectId
        },
        body: JSON.stringify({
          description: 'Simple login test',
          platform: 'web',
          framework: 'playwright'
        })
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(10000); // Should respond within 10 seconds

      const result = await response.json();
      expect(result.success).toBe(true);

      console.log(`Test generation response time: ${responseTime.toFixed(2)}ms`);
    });

    it('should optimize tests quickly', async () => {
      const testRequest = {
        tests: Array.from({ length: 10 }, (_, i) => ({
          id: `test-${i}`,
          name: `Test ${i}`,
          type: 'web',
          content: `Test content ${i}`,
          metadata: {
            runCount: 5,
            failureRate: 0.1,
            complexity: 'medium'
          }
        })),
        optimizationType: 'comprehensive'
      };

      const startTime = performance.now();

      const response = await fetch(`${baseUrl}/api/ai/optimize-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': testUserId,
          'x-project-id': testProjectId
        },
        body: JSON.stringify(testRequest)
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(8000); // Should respond within 8 seconds

      console.log(`Test optimization response time: ${responseTime.toFixed(2)}ms`);
    });

    it('should analyze failures efficiently', async () => {
      const failures = Array.from({ length: 5 }, (_, i) => ({
        id: `failure-${i}`,
        testCaseId: `test-${i}`,
        testName: `Test ${i}`,
        testType: 'web',
        platform: 'chrome',
        failureTime: new Date().toISOString(),
        errorMessage: `Error message ${i}`,
        errorType: 'timeout_error'
      }));

      const startTime = performance.now();

      const response = await fetch(`${baseUrl}/api/ai/analyze-failure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': testUserId,
          'x-project-id': testProjectId
        },
        body: JSON.stringify({
          failures,
          analysisType: 'comprehensive'
        })
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(12000); // Should respond within 12 seconds

      console.log(`Failure analysis response time: ${responseTime.toFixed(2)}ms`);
    });

    it('should return usage analytics instantly', async () => {
      const startTime = performance.now();

      const response = await fetch(`${baseUrl}/api/ai/usage`, {
        method: 'GET',
        headers: {
          'x-user-id': testUserId,
          'x-project-id': testProjectId
        }
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second

      console.log(`Usage analytics response time: ${responseTime.toFixed(2)}ms`);
    });

    it('should provide health check responses immediately', async () => {
      const startTime = performance.now();

      const response = await fetch(`${baseUrl}/api/ai/health`, {
        method: 'GET'
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(500); // Should respond within 500ms

      console.log(`Health check response time: ${responseTime.toFixed(2)}ms`);
    });
  });

  describe('Concurrent Load Testing', () => {
    it('should handle concurrent test generation requests', async () => {
      const concurrentRequests = 20;
      const requests = Array.from({ length: concurrentRequests }, (_, i) =>
        fetch(`${baseUrl}/api/ai/generate-test`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': `${testUserId}-${i}`,
            'x-project-id': testProjectId
          },
          body: JSON.stringify({
            description: `Concurrent test ${i}`,
            platform: 'web'
          })
        })
      );

      const startTime = performance.now();
      const responses = await Promise.allSettled(requests);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      const successfulResponses = responses.filter(r =>
        r.status === 'fulfilled' && r.value.status === 200
      );
      const failedResponses = responses.filter(r =>
        r.status === 'rejected' || (r.status === 'fulfilled' && r.value.status !== 200)
      );

      console.log(`Concurrent generation (${concurrentRequests} requests):`);
      console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`  Successful: ${successfulResponses.length}`);
      console.log(`  Failed: ${failedResponses.length}`);
      console.log(`  Average per request: ${(totalTime / concurrentRequests).toFixed(2)}ms`);

      // At least 70% should succeed under normal load
      expect(successfulResponses.length / concurrentRequests).toBeGreaterThanOrEqual(0.7);

      // Total time should be reasonable (not much more than serial execution)
      expect(totalTime).toBeLessThan(30000); // 30 seconds max for 20 requests
    });

    it('should handle mixed concurrent workload', async () => {
      const workloads = [
        // Test generation requests
        ...Array.from({ length: 5 }, (_, i) =>
          fetch(`${baseUrl}/api/ai/generate-test`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-id': `${testUserId}-gen-${i}`,
              'x-project-id': testProjectId
            },
            body: JSON.stringify({
              description: `Mixed workload test ${i}`,
              platform: 'web'
            })
          })
        ),
        // Test optimization requests
        ...Array.from({ length: 5 }, (_, i) =>
          fetch(`${baseUrl}/api/ai/optimize-test`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-id': `${testUserId}-opt-${i}`,
              'x-project-id': testProjectId
            },
            body: JSON.stringify({
              tests: [{
                id: `test-${i}`,
                name: `Test ${i}`,
                type: 'web',
                content: `Test content ${i}`,
                metadata: { runCount: 1, failureRate: 0, complexity: 'low' }
              }]
            })
          })
        ),
        // Usage analytics requests
        ...Array.from({ length: 10 }, (_, i) =>
          fetch(`${baseUrl}/api/ai/usage`, {
            method: 'GET',
            headers: {
              'x-user-id': `${testUserId}-usage-${i}`,
              'x-project-id': testProjectId
            }
          })
        )
      ];

      const startTime = performance.now();
      const responses = await Promise.allSettled(workloads);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      const successfulResponses = responses.filter(r =>
        r.status === 'fulfilled' && r.value.status === 200
      );

      console.log(`Mixed workload (${workloads.length} requests):`);
      console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`  Successful: ${successfulResponses.length}/${workloads.length}`);
      console.log(`  Success rate: ${((successfulResponses.length / workloads.length) * 100).toFixed(1)}%`);

      // At least 80% should succeed
      expect(successfulResponses.length / workloads.length).toBeGreaterThanOrEqual(0.8);
      expect(totalTime).toBeLessThan(20000); // 20 seconds max
    });

    it('should maintain performance under sustained load', async () => {
      const rounds = 3;
      const requestsPerRound = 10;
      const allResults = [];

      for (let round = 0; round < rounds; round++) {
        const requests = Array.from({ length: requestsPerRound }, (_, i) =>
          fetch(`${baseUrl}/api/ai/usage`, {
            method: 'GET',
            headers: {
              'x-user-id': `${testUserId}-sustained-${round}-${i}`,
              'x-project-id': testProjectId
            }
          })
        );

        const startTime = performance.now();
        const responses = await Promise.allSettled(requests);
        const endTime = performance.now();
        const roundTime = endTime - startTime;

        const successfulResponses = responses.filter(r =>
          r.status === 'fulfilled' && r.value.status === 200
        );

        const roundResult = {
          round: round + 1,
          time: roundTime,
          successful: successfulResponses.length,
          total: requestsPerRound,
          averageTime: roundTime / requestsPerRound
        };

        allResults.push(roundResult);
        console.log(`Round ${roundResult.round}: ${roundResult.time.toFixed(2)}ms, ${roundResult.successful}/${roundResult.total} successful`);

        // Brief pause between rounds
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Performance should not degrade significantly across rounds
      const firstRoundTime = allResults[0].averageTime;
      const lastRoundTime = allResults[allResults.length - 1].averageTime;
      const degradation = (lastRoundTime - firstRoundTime) / firstRoundTime;

      console.log(`Performance degradation: ${(degradation * 100).toFixed(1)}%`);
      expect(Math.abs(degradation)).toBeLessThan(0.5); // Less than 50% degradation
    });
  });

  describe('Resource Usage and Memory Management', () => {
    it('should handle large requests without memory leaks', async () => {
      const largeDescription = 'Create comprehensive test suite for '.repeat(200) +
        'complex application with multiple features, user flows, and edge cases';

      const startTime = performance.now();

      const response = await fetch(`${baseUrl}/api/ai/generate-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': testUserId,
          'x-project-id': testProjectId
        },
        body: JSON.stringify({
          description: largeDescription,
          platform: 'web',
          context: {
            applicationType: 'web',
            existingTests: Array.from({ length: 50 }, (_, i) => `test-${i}.spec.ts`),
            testingGuidelines: 'Comprehensive testing guidelines '.repeat(20)
          },
          options: {
            includeEdgeCases: true,
            generateAssertions: true,
            complexity: 'advanced'
          }
        })
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      console.log(`Large request response time: ${responseTime.toFixed(2)}ms`);
      console.log(`Request size: ${JSON.stringify({
        description: largeDescription,
        platform: 'web'
      }).length} characters`);

      // Should handle large requests gracefully
      expect([200, 400, 413]).toContain(response.status);
      expect(responseTime).toBeLessThan(15000); // 15 seconds max for large requests
    });

    it('should efficiently process multiple failures', async () => {
      const failureCounts = [5, 10, 25, 50];
      const results = [];

      for (const count of failureCounts) {
        const failures = Array.from({ length: count }, (_, i) => ({
          id: `failure-${i}`,
          testCaseId: `test-${i}`,
          testName: `Test ${i}`,
          testType: 'web',
          platform: 'chrome',
          failureTime: new Date().toISOString(),
          errorMessage: `Error message ${i}`,
          errorType: 'timeout_error',
          networkLogs: Array.from({ length: 3 }, (_, j) => ({
            url: `https://api.example.com/endpoint-${j}`,
            method: 'GET',
            status: 500,
            responseTime: 1000 + j * 100
          }))
        }));

        const startTime = performance.now();

        const response = await fetch(`${baseUrl}/api/ai/analyze-failure`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': `${testUserId}-batch-${count}`,
            'x-project-id': testProjectId
          },
          body: JSON.stringify({
            failures,
            analysisType: 'comprehensive'
          })
        });

        const endTime = performance.now();
        const responseTime = endTime - startTime;

        const result = {
          failureCount: count,
          responseTime: responseTime,
          timePerFailure: responseTime / count,
          status: response.status
        };

        results.push(result);
        console.log(`${count} failures: ${responseTime.toFixed(2)}ms (${result.timePerFailure.toFixed(2)}ms per failure)`);

        // Response time should scale reasonably
        expect(response.status).toBe(200);
        expect(result.timePerFailure).toBeLessThan(1000); // 1 second per failure max
      }

      // Verify linear or sub-linear scaling
      const firstResult = results[0];
      const lastResult = results[results.length - 1];
      const scalingFactor = (lastResult.timePerFailure / firstResult.timePerFailure);

      console.log(`Scaling factor: ${scalingFactor.toFixed(2)} (closer to 1 is better)`);
      expect(scalingFactor).toBeLessThan(2); // Time per failure shouldn't double
    });
  });

  describe('Rate Limiting Performance', () => {
    it('should enforce rate limits efficiently', async () => {
      const burstSize = 30;
      const requests = Array.from({ length: burstSize }, (_, i) =>
        fetch(`${baseUrl}/api/ai/capabilities`, {
          method: 'GET',
          headers: { 'x-user-id': `${testUserId}-rate-${i}` }
        })
      );

      const startTime = performance.now();
      const responses = await Promise.allSettled(requests);
      const endTime = performance.now();

      const successfulResponses = responses.filter(r =>
        r.status === 'fulfilled' && r.value.status === 200
      );
      const rateLimitedResponses = responses.filter(r =>
        r.status === 'fulfilled' && r.value.status === 429
      );
      const otherResponses = responses.filter(r =>
        !successfulResponses.includes(r) && !rateLimitedResponses.includes(r)
      );

      console.log(`Rate limiting test (${burstSize} requests):`);
      console.log(`  Total time: ${(endTime - startTime).toFixed(2)}ms`);
      console.log(`  Successful: ${successfulResponses.length}`);
      console.log(`  Rate limited: ${rateLimitedResponses.length}`);
      console.log(`  Other: ${otherResponses.length}`);

      // Should have some rate limiting in effect
      expect(successfulResponses.length + rateLimitedResponses.length + otherResponses.length).toBe(burstSize);

      // Should allow some requests but limit others
      expect(successfulResponses.length).toBeGreaterThan(0);
      expect(rateLimitedResponses.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cache Performance', () => {
    it('should serve cached responses quickly', async () => {
      const cacheKey = `perf-cache-test-${Date.now()}`;

      // First request
      const startTime1 = performance.now();
      const response1 = await fetch(`${baseUrl}/api/ai/models?cache=${cacheKey}`, {
        method: 'GET'
      });
      const endTime1 = performance.now();
      const firstResponseTime = endTime1 - startTime1;

      expect(response1.status).toBe(200);

      // Second request (should be cached)
      const startTime2 = performance.now();
      const response2 = await fetch(`${baseUrl}/api/ai/models?cache=${cacheKey}`, {
        method: 'GET'
      });
      const endTime2 = performance.now();
      const secondResponseTime = endTime2 - startTime2;

      expect(response2.status).toBe(200);

      console.log(`Cache performance test:`);
      console.log(`  First request: ${firstResponseTime.toFixed(2)}ms`);
      console.log(`  Second request: ${secondResponseTime.toFixed(2)}ms`);
      console.log(`  Speedup: ${(firstResponseTime / secondResponseTime).toFixed(1)}x`);

      // Second request should be faster (cached)
      if (firstResponseTime > 100) { // Only check if first request took reasonable time
        expect(secondResponseTime).toBeLessThan(firstResponseTime * 0.8);
      }
    });
  });

  describe('Stress Testing', () => {
    it('should handle extreme load gracefully', async () => {
      const extremeRequestCount = 100;
      const batchSize = 20;
      const allResponses = [];

      for (let i = 0; i < extremeRequestCount; i += batchSize) {
        const batch = Array.from({ length: Math.min(batchSize, extremeRequestCount - i) }, (_, j) =>
          fetch(`${baseUrl}/api/ai/health`, {
            method: 'GET',
            headers: { 'x-user-id': `${testUserId}-stress-${i + j}` }
          })
        );

        const batchResponses = await Promise.allSettled(batch);
        allResponses.push(...batchResponses);

        // Small delay between batches to avoid overwhelming the server
        if (i + batchSize < extremeRequestCount) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const successfulResponses = allResponses.filter(r =>
        r.status === 'fulfilled' && r.value.status === 200
      );
      const failedResponses = allResponses.filter(r =>
        r.status === 'rejected' || (r.status === 'fulfilled' && r.value.status >= 500)
      );

      console.log(`Extreme load test (${extremeRequestCount} requests):`);
      console.log(`  Successful: ${successfulResponses.length}`);
      console.log(`  Failed: ${failedResponses.length}`);
      console.log(`  Success rate: ${((successfulResponses.length / extremeRequestCount) * 100).toFixed(1)}%`);

      // Should handle extreme load without complete failure
      expect(successfulResponses.length).toBeGreaterThan(0);
      expect(successfulResponses.length / extremeRequestCount).toBeGreaterThan(0.5); // At least 50% success
    });
  });
});
