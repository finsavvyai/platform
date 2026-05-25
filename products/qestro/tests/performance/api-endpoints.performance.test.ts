/**
 * API Endpoints Performance and Load Testing
 *
 * Comprehensive performance testing for all critical API endpoints including:
 * - Response time validation with SLA compliance
 * - Concurrent user load testing (1000+ users)
 * - Database query optimization validation
 * - Memory usage and resource leak detection
 * - API throughput and scalability testing
 * - Error handling and degradation testing
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { performance } from 'perf_hooks';
import { PerformanceTestDataGenerator, PerformanceMetricsCollector } from '../utils/performance-test-utils';

describe('API Endpoints Performance Tests', () => {
  const perfData = new PerformanceTestDataGenerator();
  const metricsCollector = new PerformanceMetricsCollector();

  const config = {
    baseUrl: process.env.API_BASE_URL || 'http://localhost:8000',
    timeout: 30000,
    concurrentUsers: 100,
    extremeLoadUsers: 1000,
    performanceThresholds: {
      responseTime: {
        critical: 2000,      // 2s for critical endpoints
        standard: 5000,      // 5s for standard endpoints
        background: 15000    // 15s for background processing
      },
      throughput: {
        minimum: 100,        // requests per second
        target: 500          // target requests per second
      },
      errorRate: {
        acceptable: 0.01,    // 1% error rate acceptable
        critical: 0.05       // 5% error rate critical
      },
      resourceUsage: {
        memoryMax: 512,      // MB max memory usage
        cpuMax: 80           // 80% max CPU usage
      }
    }
  };

  beforeAll(async () => {
    console.log('🚀 Starting API Endpoints Performance Tests');
    console.log(`📊 Testing against: ${config.baseUrl}`);
    console.log(`⏱️ Performance thresholds:`, config.performanceThresholds);

    // Initialize performance monitoring
    await metricsCollector.startMonitoring();
  });

  afterAll(async () => {
    console.log('📊 API Performance Tests completed');
    await metricsCollector.stopMonitoring();
    await metricsCollector.generateReport();
  });

  describe('Critical Path API Performance', () => {
    it('should authenticate users within 2 seconds', async () => {
      const testUsers = perfData.generateTestUsers(10);
      const responseTimes = [];

      for (const user of testUsers) {
        const startTime = performance.now();

        const response = await fetch(`${config.baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            password: user.password
          })
        });

        const endTime = performance.now();
        const responseTime = endTime - startTime;
        responseTimes.push(responseTime);

        expect(response.status).toBe(200);
        expect(responseTime).toBeLessThan(config.performanceThresholds.responseTime.critical);
      }

      const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);

      console.log(`Authentication performance:`);
      console.log(`  Average: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`  Max: ${maxResponseTime.toFixed(2)}ms`);
      console.log(`  P95: ${calculatePercentile(responseTimes, 95).toFixed(2)}ms`);

      expect(avgResponseTime).toBeLessThan(1500); // Average under 1.5s
      expect(maxResponseTime).toBeLessThan(config.performanceThresholds.responseTime.critical);
    });

    it('should handle test creation within performance limits', async () => {
      const testProjects = perfData.generateTestProjects(5);
      const testCases = perfData.generateTestCases(20);
      const responseTimes = [];

      for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        const project = testProjects[i % testProjects.length];

        const startTime = performance.now();

        const response = await fetch(`${config.baseUrl}/api/tests`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${perfData.generateTestToken()}`
          },
          body: JSON.stringify({
            name: testCase.name,
            description: testCase.description,
            projectId: project.id,
            type: testCase.type,
            platform: testCase.platform,
            framework: testCase.framework,
            steps: testCase.steps
          })
        });

        const endTime = performance.now();
        const responseTime = endTime - startTime;
        responseTimes.push(responseTime);

        expect(response.status).toBe(201);
        expect(responseTime).toBeLessThan(config.performanceThresholds.responseTime.standard);
      }

      const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      const throughput = (testCases.length / (responseTimes.reduce((sum, time) => sum + time, 0) / 1000)).toFixed(2);

      console.log(`Test creation performance:`);
      console.log(`  Average: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`  Throughput: ${throughput} tests/second`);

      expect(avgResponseTime).toBeLessThan(3000); // Average under 3s
      expect(parseFloat(throughput)).toBeGreaterThan(5); // At least 5 tests/second
    });

    it('should execute tests with acceptable response times', async () => {
      const testExecutions = perfData.generateTestExecutions(10);
      const executionTimes = [];

      for (const execution of testExecutions) {
        const startTime = performance.now();

        const response = await fetch(`${config.baseUrl}/api/test-execution/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${perfData.generateTestToken()}`
          },
          body: JSON.stringify({
            testId: execution.testId,
            environment: execution.environment,
            deviceConfig: execution.deviceConfig,
            options: execution.options
          })
        });

        const endTime = performance.now();
        const responseTime = endTime - startTime;
        executionTimes.push(responseTime);

        // Test execution initiation should be fast (actual execution is async)
        expect(response.status).toBe(202); // Accepted
        expect(responseTime).toBeLessThan(config.performanceThresholds.responseTime.standard);
      }

      const avgInitiationTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;

      console.log(`Test execution initiation performance:`);
      console.log(`  Average: ${avgInitiationTime.toFixed(2)}ms`);
      console.log(`  Max: ${Math.max(...executionTimes).toFixed(2)}ms`);

      expect(avgInitiationTime).toBeLessThan(2000); // Average under 2s
    });

    it('should retrieve analytics data quickly', async () => {
      const analyticsRequests = [
        '/api/analytics/dashboard',
        '/api/analytics/test-performance',
        '/api/analytics/team-productivity',
        '/api/analytics/business-impact'
      ];

      const responseTimes = [];

      for (const endpoint of analyticsRequests) {
        const startTime = performance.now();

        const response = await fetch(`${config.baseUrl}${endpoint}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${perfData.generateTestToken()}`
          }
        });

        const endTime = performance.now();
        const responseTime = endTime - startTime;
        responseTimes.push(responseTime);

        expect(response.status).toBe(200);
        expect(responseTime).toBeLessThan(config.performanceThresholds.responseTime.standard);
      }

      const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;

      console.log(`Analytics API performance:`);
      console.log(`  Average: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`  Fastest: ${Math.min(...responseTimes).toFixed(2)}ms`);
      console.log(`  Slowest: ${Math.max(...responseTimes).toFixed(2)}ms`);

      expect(avgResponseTime).toBeLessThan(3000); // Analytics should be fast
    });
  });

  describe('Concurrent User Load Testing', () => {
    it('should handle 100 concurrent users', async () => {
      const concurrentUsers = config.concurrentUsers;
      const operationsPerUser = 5;

      console.log(`Testing ${concurrentUsers} concurrent users...`);

      // Generate diverse user scenarios
      const userScenarios = perfData.generateUserScenarios(concurrentUsers);

      const startTime = performance.now();

      // Execute all scenarios concurrently
      const promises = userScenarios.map(async (scenario, index) => {
        const userResults = {
          userId: index,
          operations: [],
          totalResponseTime: 0,
          errors: 0
        };

        for (const operation of scenario.operations) {
          try {
            const opStartTime = performance.now();

            const response = await fetch(`${config.baseUrl}${operation.endpoint}`, {
              method: operation.method,
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${operation.token}`,
                'X-User-ID': `user-${index}`
              },
              body: operation.body ? JSON.stringify(operation.body) : undefined
            });

            const opEndTime = performance.now();
            const responseTime = opEndTime - opStartTime;

            userResults.operations.push({
              endpoint: operation.endpoint,
              method: operation.method,
              responseTime,
              status: response.status
            });

            userResults.totalResponseTime += responseTime;

            if (response.status >= 400) {
              userResults.errors++;
            }

          } catch (error) {
            userResults.errors++;
            console.error(`User ${index} operation failed:`, error.message);
          }

          // Small delay between operations for realistic user behavior
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        }

        return userResults;
      });

      const userResults = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Analyze results
      const totalOperations = userResults.reduce((sum, user) => sum + user.operations.length, 0);
      const totalErrors = userResults.reduce((sum, user) => sum + user.errors, 0);
      const errorRate = totalErrors / totalOperations;
      const avgResponseTime = userResults.reduce((sum, user) => sum + user.totalResponseTime, 0) / totalOperations;
      const throughput = (totalOperations / (totalTime / 1000)).toFixed(2);

      console.log(`Concurrent user test results:`);
      console.log(`  Users: ${concurrentUsers}`);
      console.log(`  Total operations: ${totalOperations}`);
      console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`  Throughput: ${throughput} ops/sec`);
      console.log(`  Average response time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`  Error rate: ${(errorRate * 100).toFixed(2)}%`);

      // Performance assertions
      expect(errorRate).toBeLessThan(config.performanceThresholds.errorRate.acceptable);
      expect(avgResponseTime).toBeLessThan(config.performanceThresholds.responseTime.standard);
      expect(parseFloat(throughput)).toBeGreaterThan(config.performanceThresholds.throughput.minimum);

      // Individual user performance
      const slowestUser = Math.max(...userResults.map(user => user.totalResponseTime / user.operations.length));
      expect(slowestUser).toBeLessThan(config.performanceThresholds.responseTime.standard * 1.5);
    });

    it('should maintain performance under sustained load', async () => {
      const duration = 30000; // 30 seconds
      const usersPerBatch = 20;
      const batchInterval = 5000; // 5 seconds

      console.log(`Sustained load test: ${duration}ms duration`);

      const startTime = performance.now();
      const endTime = startTime + duration;
      const batchResults = [];

      let batchCount = 0;
      while (performance.now() < endTime) {
        batchCount++;
        console.log(`Starting batch ${batchCount}...`);

        const batchStartTime = performance.now();
        const batchUsers = perfData.generateUserScenarios(usersPerBatch);

        const batchPromises = batchUsers.map(async (scenario, index) => {
          const batchUserResults = {
            batchId: batchCount,
            userId: index,
            operations: 0,
            errors: 0,
            responseTime: 0
          };

          for (const operation of scenario.operations.slice(0, 3)) { // Fewer ops per batch for sustained load
            try {
              const opStartTime = performance.now();

              const response = await fetch(`${config.baseUrl}${operation.endpoint}`, {
                method: operation.method,
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${operation.token}`,
                  'X-Batch-ID': batchCount.toString()
                },
                body: operation.body ? JSON.stringify(operation.body) : undefined
              });

              const opEndTime = performance.now();
              const responseTime = opEndTime - opStartTime;

              batchUserResults.operations++;
              batchUserResults.responseTime += responseTime;

              if (response.status >= 400) {
                batchUserResults.errors++;
              }

            } catch (error) {
              batchUserResults.errors++;
            }
          }

          return batchUserResults;
        });

        const batchResult = await Promise.all(batchPromises);
        const batchEndTime = performance.now();

        const batchStats = {
          batchId: batchCount,
          duration: batchEndTime - batchStartTime,
          totalOperations: batchResult.reduce((sum, user) => sum + user.operations, 0),
          totalErrors: batchResult.reduce((sum, user) => sum + user.errors, 0),
          avgResponseTime: batchResult.reduce((sum, user) => sum + user.responseTime, 0) /
                          batchResult.reduce((sum, user) => sum + user.operations, 0)
        };

        batchStats.errorRate = batchStats.totalErrors / batchStats.totalOperations;
        batchStats.throughput = batchStats.totalOperations / (batchStats.duration / 1000);

        batchResults.push(batchStats);

        console.log(`Batch ${batchCount}: ${batchStats.totalOperations} ops, ${batchStats.errorRate.toFixed(2)}% error rate, ${batchStats.avgResponseTime.toFixed(2)}ms avg`);

        // Check if we should wait before next batch
        if (performance.now() + batchInterval < endTime) {
          await new Promise(resolve => setTimeout(resolve, batchInterval));
        }
      }

      // Analyze sustained performance
      const errorRates = batchResults.map(batch => batch.errorRate);
      const responseTimes = batchResults.map(batch => batch.avgResponseTime);
      const throughputs = batchResults.map(batch => batch.throughput);

      const maxErrorRate = Math.max(...errorRates);
      const maxResponseTime = Math.max(...responseTimes);
      const minThroughput = Math.min(...throughputs);

      console.log(`Sustained load analysis:`);
      console.log(`  Batches completed: ${batchResults.length}`);
      console.log(`  Max error rate: ${(maxErrorRate * 100).toFixed(2)}%`);
      console.log(`  Max response time: ${maxResponseTime.toFixed(2)}ms`);
      console.log(`  Min throughput: ${minThroughput.toFixed(2)} ops/sec`);

      // Performance should not degrade significantly
      expect(maxErrorRate).toBeLessThan(config.performanceThresholds.errorRate.acceptable * 2);
      expect(maxResponseTime).toBeLessThan(config.performanceThresholds.responseTime.standard * 1.5);
      expect(minThroughput).toBeGreaterThan(config.performanceThresholds.throughput.minimum / 2);
    });

    it('should handle extreme load gracefully (1000+ users)', async () => {
      const extremeUserCount = config.extremeLoadUsers;
      const operationsPerUser = 2; // Simplified operations for extreme load

      console.log(`Extreme load test: ${extremeUserCount} concurrent users`);

      // Generate lightweight scenarios for extreme load
      const extremeScenarios = perfData.generateUserScenarios(extremeUserCount, 'lightweight');

      const startTime = performance.now();

      // Process in chunks to avoid overwhelming the test runner
      const chunkSize = 100;
      const chunks = [];
      for (let i = 0; i < extremeScenarios.length; i += chunkSize) {
        chunks.push(extremeScenarios.slice(i, i + chunkSize));
      }

      const allResults = [];

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        console.log(`Processing chunk ${chunkIndex + 1}/${chunks.length} (${chunk.length} users)`);

        const chunkPromises = chunk.map(async (scenario, index) => {
          const globalIndex = chunkIndex * chunkSize + index;
          const chunkResults = {
            userId: globalIndex,
            success: false,
            responseTime: 0,
            statusCode: 0
          };

          try {
            const operation = scenario.operations[0]; // Only first operation for extreme load
            const opStartTime = performance.now();

            const response = await fetch(`${config.baseUrl}${operation.endpoint}`, {
              method: operation.method,
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${operation.token}`,
                'X-Extreme-Load': 'true',
                'X-User-ID': `extreme-user-${globalIndex}`
              },
              body: operation.body ? JSON.stringify(operation.body) : undefined
            });

            const opEndTime = performance.now();
            const responseTime = opEndTime - opStartTime;

            chunkResults.success = response.status < 400;
            chunkResults.responseTime = responseTime;
            chunkResults.statusCode = response.status;

          } catch (error) {
            chunkResults.success = false;
            chunkResults.statusCode = 0;
          }

          return chunkResults;
        });

        const chunkResults = await Promise.all(chunkPromises);
        allResults.push(...chunkResults);

        // Brief pause between chunks to prevent overwhelming
        if (chunkIndex < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Analyze extreme load results
      const successfulRequests = allResults.filter(r => r.success).length;
      const failedRequests = allResults.length - successfulRequests;
      const successRate = successfulRequests / allResults.length;
      const avgResponseTime = allResults.reduce((sum, r) => sum + r.responseTime, 0) / allResults.length;
      const throughput = (allResults.length / (totalTime / 1000)).toFixed(2);

      console.log(`Extreme load test results:`);
      console.log(`  Total requests: ${allResults.length}`);
      console.log(`  Successful: ${successfulRequests}`);
      console.log(`  Failed: ${failedRequests}`);
      console.log(`  Success rate: ${(successRate * 100).toFixed(2)}%`);
      console.log(`  Average response time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`  Throughput: ${throughput} req/sec`);
      console.log(`  Total time: ${totalTime.toFixed(2)}ms`);

      // System should handle extreme load without complete failure
      expect(successRate).toBeGreaterThan(0.5); // At least 50% success under extreme load
      expect(avgResponseTime).toBeLessThan(config.performanceThresholds.responseTime.standard * 3);
      expect(successfulRequests).toBeGreaterThan(100); // At least 100 successful requests
    });
  });

  describe('Database Performance Testing', () => {
    it('should handle database queries efficiently', async () => {
      const dbOperations = [
        { endpoint: '/api/projects', method: 'GET', description: 'List projects' },
        { endpoint: '/api/tests?limit=100', method: 'GET', description: 'List tests (paginated)' },
        { endpoint: '/api/test-results?limit=100', method: 'GET', description: 'List test results' },
        { endpoint: '/api/users/profile', method: 'GET', description: 'Get user profile' },
        { endpoint: '/api/analytics/dashboard', method: 'GET', description: 'Analytics dashboard' }
      ];

      const queryTimes = [];

      for (const operation of dbOperations) {
        const startTime = performance.now();

        const response = await fetch(`${config.baseUrl}${operation.endpoint}`, {
          method: operation.method,
          headers: {
            'Authorization': `Bearer ${perfData.generateTestToken()}`,
            'X-Performance-Test': 'db-queries'
          }
        });

        const endTime = performance.now();
        const queryTime = endTime - startTime;
        queryTimes.push({
          operation: operation.description,
          endpoint: operation.endpoint,
          responseTime: queryTime,
          status: response.status,
          dataSize: response.headers.get('content-length') || 'unknown'
        });

        expect(response.status).toBe(200);
        expect(queryTime).toBeLessThan(config.performanceThresholds.responseTime.standard);
      }

      // Analyze database performance
      const avgQueryTime = queryTimes.reduce((sum, q) => sum + q.responseTime, 0) / queryTimes.length;
      const slowestQuery = queryTimes.reduce((slowest, current) =>
        current.responseTime > slowest.responseTime ? current : slowest
      );

      console.log(`Database query performance:`);
      console.log(`  Average query time: ${avgQueryTime.toFixed(2)}ms`);
      console.log(`  Slowest query: ${slowestQuery.operation} (${slowestQuery.responseTime.toFixed(2)}ms)`);

      queryTimes.forEach(query => {
        console.log(`    ${query.operation}: ${query.responseTime.toFixed(2)}ms (${query.dataSize} bytes)`);
      });

      expect(avgQueryTime).toBeLessThan(2000); // Average under 2s
      expect(slowestQuery.responseTime).toBeLessThan(config.performanceThresholds.responseTime.standard);
    });

    it('should handle large dataset operations efficiently', async () => {
      const largeDatasetOperations = [
        { endpoint: '/api/tests?limit=1000', method: 'GET', description: 'Large test list' },
        { endpoint: '/api/test-results?limit=1000', method: 'GET', description: 'Large results list' },
        { endpoint: '/api/analytics/export?format=json&period=90d', method: 'GET', description: 'Large analytics export' }
      ];

      const operationResults = [];

      for (const operation of largeDatasetOperations) {
        console.log(`Testing ${operation.description}...`);

        const startTime = performance.now();

        const response = await fetch(`${config.baseUrl}${operation.endpoint}`, {
          method: operation.method,
          headers: {
            'Authorization': `Bearer ${perfData.generateTestToken()}`,
            'X-Performance-Test': 'large-dataset'
          }
        });

        const endTime = performance.now();
        const responseTime = endTime - startTime;

        expect(response.status).toBe(200);

        // For large datasets, response time should scale reasonably
        const data = await response.json();
        const dataSize = JSON.stringify(data).length;
        const dataThroughput = dataSize / (responseTime / 1000); // bytes per second

        operationResults.push({
          operation: operation.description,
          responseTime,
          dataSize,
          throughput: dataThroughput,
          recordCount: Array.isArray(data) ? data.length : (data.items?.length || 1)
        });

        console.log(`  ${operation.description}: ${responseTime.toFixed(2)}ms, ${(dataSize / 1024).toFixed(2)}KB, ${operationResults[operationResults.length - 1].recordCount} records`);

        // Response time should be reasonable for large datasets
        expect(responseTime).toBeLessThan(config.performanceThresholds.responseTime.background);
        expect(dataThroughput).toBeGreaterThan(1000); // At least 1KB/s throughput
      }

      // Verify scaling performance
      const avgThroughput = operationResults.reduce((sum, op) => sum + op.throughput, 0) / operationResults.length;
      console.log(`Average data throughput: ${(avgThroughput / 1024).toFixed(2)}KB/s`);

      expect(avgThroughput).toBeGreaterThan(5000); // At least 5KB/s average throughput
    });
  });

  describe('Memory and Resource Usage Testing', () => {
    it('should not leak memory during repeated operations', async () => {
      const operation = {
        endpoint: '/api/tests',
        method: 'POST',
        body: {
          name: 'Memory test',
          description: 'Testing memory usage',
          type: 'unit',
          platform: 'web'
        }
      };

      const iterations = 50;
      const memorySnapshots = [];

      for (let i = 0; i < iterations; i++) {
        // Capture memory before operation
        const memoryBefore = await metricsCollector.getMemoryUsage();

        // Perform operation
        const response = await fetch(`${config.baseUrl}${operation.endpoint}`, {
          method: operation.method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${perfData.generateTestToken()}`,
            'X-Iteration': i.toString()
          },
          body: JSON.stringify({ ...operation.body, name: `Memory test ${i}` })
        });

        // Capture memory after operation
        const memoryAfter = await metricsCollector.getMemoryUsage();

        memorySnapshots.push({
          iteration: i,
          before: memoryBefore,
          after: memoryAfter,
          delta: memoryAfter.heapUsed - memoryBefore.heapUsed,
          status: response.status
        });

        expect(response.status).toBe(201);

        // Force garbage collection periodically
        if (i % 10 === 0) {
          if (global.gc) {
            global.gc();
          }
        }
      }

      // Analyze memory usage patterns
      const memoryDeltas = memorySnapshots.map(snap => snap.delta);
      const avgMemoryDelta = memoryDeltas.reduce((sum, delta) => sum + delta, 0) / memoryDeltas.length;
      const maxMemoryDelta = Math.max(...memoryDeltas);
      const totalMemoryGrowth = memorySnapshots[memorySnapshots.length - 1].after.heapUsed - memorySnapshots[0].before.heapUsed;

      console.log(`Memory leak test results:`);
      console.log(`  Iterations: ${iterations}`);
      console.log(`  Average memory delta: ${(avgMemoryDelta / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Max memory delta: ${(maxMemoryDelta / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Total memory growth: ${(totalMemoryGrowth / 1024 / 1024).toFixed(2)}MB`);

      // Memory growth should be reasonable
      expect(totalMemoryGrowth).toBeLessThan(100 * 1024 * 1024); // Less than 100MB total growth
      expect(avgMemoryDelta).toBeLessThan(5 * 1024 * 1024); // Average delta under 5MB
    });

    it('should handle resource-intensive operations efficiently', async () => {
      const resourceIntensiveOperations = [
        {
          endpoint: '/api/ai/generate-test',
          method: 'POST',
          body: {
            description: 'Generate a comprehensive test suite for user authentication, registration, profile management, and dashboard navigation with multiple test cases and edge cases',
            platform: 'web',
            framework: 'playwright',
            complexity: 'advanced'
          },
          description: 'AI test generation'
        },
        {
          endpoint: '/api/analytics/comprehensive-report',
          method: 'GET',
          description: 'Comprehensive analytics report'
        },
        {
          endpoint: '/api/test-execution/bulk-status',
          method: 'POST',
          body: {
            executionIds: Array.from({ length: 100 }, (_, i) => `exec-${i}`)
          },
          description: 'Bulk execution status'
        }
      ];

      const resourceUsageResults = [];

      for (const operation of resourceIntensiveOperations) {
        console.log(`Testing resource usage for ${operation.description}...`);

        // Measure resource usage before operation
        const resourcesBefore = await metricsCollector.getResourceUsage();

        const startTime = performance.now();

        const response = await fetch(`${config.baseUrl}${operation.endpoint}`, {
          method: operation.method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${perfData.generateTestToken()}`,
            'X-Resource-Test': 'true'
          },
          body: operation.body ? JSON.stringify(operation.body) : undefined
        });

        const endTime = performance.now();
        const responseTime = endTime - startTime;

        // Measure resource usage after operation
        const resourcesAfter = await metricsCollector.getResourceUsage();

        const resourceResult = {
          operation: operation.description,
          responseTime,
          resourcesBefore,
          resourcesAfter,
          memoryDelta: resourcesAfter.memory.heapUsed - resourcesBefore.memory.heapUsed,
          cpuDelta: resourcesAfter.cpu.usage - resourcesBefore.cpu.usage
        };

        resourceUsageResults.push(resourceResult);

        console.log(`  ${operation.description}:`);
        console.log(`    Response time: ${responseTime.toFixed(2)}ms`);
        console.log(`    Memory delta: ${(resourceResult.memoryDelta / 1024 / 1024).toFixed(2)}MB`);
        console.log(`    CPU delta: ${resourceResult.cpuDelta.toFixed(2)}%`);

        // Resource-intensive operations should complete within reasonable time
        expect(response.status).toBe(200);
        expect(responseTime).toBeLessThan(config.performanceThresholds.responseTime.background);

        // Resource usage should be reasonable
        expect(Math.abs(resourceResult.memoryDelta)).toBeLessThan(50 * 1024 * 1024); // Less than 50MB delta
      }

      // Verify overall resource efficiency
      const avgMemoryDelta = resourceUsageResults.reduce((sum, r) => sum + Math.abs(r.memoryDelta), 0) / resourceUsageResults.length;
      const maxResponseTime = Math.max(...resourceUsageResults.map(r => r.responseTime));

      console.log(`Resource efficiency analysis:`);
      console.log(`  Average memory delta: ${(avgMemoryDelta / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Max response time: ${maxResponseTime.toFixed(2)}ms`);

      expect(avgMemoryDelta).toBeLessThan(20 * 1024 * 1024); // Average under 20MB
      expect(maxResponseTime).toBeLessThan(config.performanceThresholds.responseTime.background);
    });
  });

  describe('API Throughput and Scalability', () => {
    it('should achieve target throughput for mixed workloads', async () => {
      const testDuration = 30000; // 30 seconds
      const targetThroughput = config.performanceThresholds.throughput.target;

      console.log(`Throughput test: target ${targetThroughput} req/sec for ${testDuration}ms`);

      const mixedWorkload = perfData.generateMixedWorkload();
      const startTime = performance.now();
      const endTime = startTime + testDuration;

      let completedRequests = 0;
      let successfulRequests = 0;
      const responseTimes = [];

      // Continuously send requests during test duration
      while (performance.now() < endTime) {
        const operation = mixedWorkload[Math.floor(Math.random() * mixedWorkload.length)];

        const requestStartTime = performance.now();

        try {
          const response = await fetch(`${config.baseUrl}${operation.endpoint}`, {
            method: operation.method,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${operation.token}`,
              'X-Throughput-Test': 'true'
            },
            body: operation.body ? JSON.stringify(operation.body) : undefined
          });

          const requestEndTime = performance.now();
          const responseTime = requestEndTime - requestStartTime;

          completedRequests++;
          responseTimes.push(responseTime);

          if (response.status < 400) {
            successfulRequests++;
          }

        } catch (error) {
          completedRequests++;
          console.error('Request failed:', error.message);
        }

        // Control request rate to target throughput
        const expectedInterval = 1000 / targetThroughput;
        const actualTime = performance.now() - requestStartTime;
        if (actualTime < expectedInterval) {
          await new Promise(resolve => setTimeout(resolve, expectedInterval - actualTime));
        }
      }

      const actualDuration = performance.now() - startTime;
      const actualThroughput = (completedRequests / (actualDuration / 1000)).toFixed(2);
      const successRate = successfulRequests / completedRequests;
      const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;

      console.log(`Throughput test results:`);
      console.log(`  Duration: ${actualDuration.toFixed(2)}ms`);
      console.log(`  Completed requests: ${completedRequests}`);
      console.log(`  Successful requests: ${successfulRequests}`);
      console.log(`  Actual throughput: ${actualThroughput} req/sec`);
      console.log(`  Target throughput: ${targetThroughput} req/sec`);
      console.log(`  Success rate: ${(successRate * 100).toFixed(2)}%`);
      console.log(`  Average response time: ${avgResponseTime.toFixed(2)}ms`);

      // Verify throughput targets
      expect(parseFloat(actualThroughput)).toBeGreaterThan(targetThroughput * 0.8); // At least 80% of target
      expect(successRate).toBeGreaterThan(0.95); // 95% success rate
      expect(avgResponseTime).toBeLessThan(config.performanceThresholds.responseTime.standard);
    });
  });
});

/**
 * Helper function to calculate percentile values
 */
function calculatePercentile(values: number[], percentile: number): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}
