/**
 * Performance Validation Integration Tests
 * Tests system performance under various load conditions
 */

import { test, expect } from '@playwright/test';
import { performance } from 'perf_hooks';

test.describe('Performance Validation', () => {
  test.describe('Frontend Performance', () => {
    test('should load main dashboard within performance thresholds', async ({ page }) => {
      const startTime = performance.now();

      await page.goto('/login');

      // Login first
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('[data-testid="login-button"]');

      // Wait for dashboard to load
      await page.waitForURL('/dashboard');
      await page.waitForLoadState('networkidle');

      const loadTime = performance.now() - startTime;

      // Dashboard should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);

      // Check Core Web Vitals
      const vitals = await page.evaluate(() => {
        return new Promise((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const vitals: any = {};

            entries.forEach((entry) => {
              if (entry.entryType === 'navigation') {
                const navEntry = entry as PerformanceNavigationTiming;
                vitals.domContentLoaded = navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart;
                vitals.loadComplete = navEntry.loadEventEnd - navEntry.loadEventStart;
                vitals.firstPaint = navEntry.responseEnd - navEntry.requestStart;
              }
            });

            resolve(vitals);
          }).observe({ entryTypes: ['navigation'] });
        });
      });

      expect(vitals.domContentLoaded).toBeLessThan(1500);
      expect(vitals.loadComplete).toBeLessThan(3000);
    });

    test('should handle large test lists efficiently', async ({ page }) => {
      // Login
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('/dashboard');

      // Navigate to tests page with large dataset
      const startTime = performance.now();
      await page.goto('/tests');
      await page.waitForLoadState('networkidle');

      // Should load within 2 seconds even with many tests
      const loadTime = performance.now() - startTime;
      expect(loadTime).toBeLessThan(2000);

      // Test virtual scrolling performance
      const scrollStart = performance.now();

      // Scroll through the list
      for (let i = 0; i < 10; i++) {
        await page.evaluate(() => window.scrollBy(0, 200));
        await page.waitForTimeout(50);
      }

      const scrollTime = performance.now() - scrollStart;
      expect(scrollTime).toBeLessThan(1000);

      // Test search performance
      const searchStart = performance.now();
      await page.fill('[data-testid="test-search"]', 'login test');
      await page.waitForTimeout(300);

      const searchTime = performance.now() - searchStart;
      expect(searchTime).toBeLessThan(500);
    });

    test('should maintain performance with real-time updates', async ({ page }) => {
      // Login
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('/dashboard');

      // Navigate to real-time monitoring page
      await page.goto('/monitoring');
      await page.waitForLoadState('networkidle');

      // Monitor WebSocket connection performance
      const wsMetrics = await page.evaluate(() => {
        return new Promise((resolve) => {
          const metrics: any = {
            connectionTime: 0,
            messageLatency: [],
            throughput: 0
          };

          const ws = new WebSocket('ws://localhost:8000');
          const connectStart = performance.now();

          ws.onopen = () => {
            metrics.connectionTime = performance.now() - connectStart;

            // Test message latency
            const messages = [];
            for (let i = 0; i < 10; i++) {
              const start = performance.now();
              ws.send(JSON.stringify({ type: 'ping', id: i }));

              ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'pong' && data.id === i) {
                  messages.push(performance.now() - start);

                  if (messages.length === 10) {
                    metrics.messageLatency = messages;
                    metrics.throughput = messages.length / ((performance.now() - start) / 1000);
                    resolve(metrics);
                  }
                }
              };
            }
          };
        });
      });

      expect(wsMetrics.connectionTime).toBeLessThan(1000);
      expect(wsMetrics.messageLatency.reduce((a: number, b: number) => a + b, 0) / wsMetrics.messageLatency.length).toBeLessThan(100);
      expect(wsMetrics.throughput).toBeGreaterThan(50); // messages per second
    });
  });

  test.describe('Backend API Performance', () => {
    test('should handle concurrent API requests efficiently', async ({ request }) => {
      const concurrentRequests = 50;
      const startTime = performance.now();

      // Create concurrent requests
      const promises = Array.from({ length: concurrentRequests }, async (_, i) => {
        return request.get('/api/health', {
          headers: {
            'Authorization': `Bearer test-token-${i}`
          }
        });
      });

      const responses = await Promise.all(promises);
      const totalTime = performance.now() - startTime;

      // All requests should succeed
      expect(responses.every(r => r.ok())).toBe(true);

      // Average response time should be reasonable
      const avgResponseTime = totalTime / concurrentRequests;
      expect(avgResponseTime).toBeLessThan(100);

      // Total time should be much less than sequential execution
      expect(totalTime).toBeLessThan(5000);
    });

    test('should maintain performance under sustained load', async ({ request }) => {
      const duration = 30000; // 30 seconds
      const startTime = performance.now();
      const responseTimes: number[] = [];

      while (performance.now() - startTime < duration) {
        const requestStart = performance.now();

        const response = await request.get('/api/tests', {
          headers: {
            'Authorization': 'Bearer test-token'
          }
        });

        const requestTime = performance.now() - requestStart;
        responseTimes.push(requestTime);

        expect(response.ok()).toBe(true);

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Calculate performance metrics
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const p95ResponseTime = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)];
      const maxResponseTime = Math.max(...responseTimes);

      expect(avgResponseTime).toBeLessThan(200);
      expect(p95ResponseTime).toBeLessThan(500);
      expect(maxResponseTime).toBeLessThan(1000);
    });

    test('should handle large payload responses efficiently', async ({ request }) => {
      const startTime = performance.now();

      const response = await request.get('/api/test-results/export', {
        headers: {
          'Authorization': 'Bearer test-token'
        },
        params: {
          format: 'json',
          limit: 1000
        }
      });

      const responseTime = performance.now() - startTime;

      expect(response.ok()).toBe(true);

      // Large responses should still be served quickly
      expect(responseTime).toBeLessThan(2000);

      // Response should be reasonably sized
      const data = await response.json();
      expect(data.results).toHaveLength(1000);
    });
  });

  test.describe('Database Performance', () => {
    test('should handle concurrent database operations', async ({ request }) => {
      const concurrentOperations = 20;

      const promises = Array.from({ length: concurrentOperations }, async (_, i) => {
        return request.post('/api/tests', {
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          },
          data: {
            name: `Performance Test ${i}`,
            description: 'Test for performance validation',
            framework: 'playwright',
            code: `test('performance test ${i}', async ({ page }) => {
              await page.goto('https://example.com');
              await expect(page.locator('h1')).toBeVisible();
            });`
          }
        });
      });

      const startTime = performance.now();
      const responses = await Promise.all(promises);
      const totalTime = performance.now() - startTime;

      // All operations should succeed
      expect(responses.every(r => r.ok())).toBe(true);

      // Average time per operation should be reasonable
      const avgTime = totalTime / concurrentOperations;
      expect(avgTime).toBeLessThan(500);
    });

    test('should optimize complex queries', async ({ request }) => {
      // Test complex aggregation query
      const startTime = performance.now();

      const response = await request.get('/api/analytics/performance-metrics', {
        headers: {
          'Authorization': 'Bearer test-token'
        },
        params: {
          dateRange: '30d',
          groupBy: 'day',
          include: 'tests,results,errors'
        }
      });

      const queryTime = performance.now() - startTime;

      expect(response.ok()).toBe(true);

      // Complex queries should execute quickly
      expect(queryTime).toBeLessThan(1000);

      const data = await response.json();
      expect(data.metrics).toBeDefined();
      expect(data.metrics.length).toBeGreaterThan(0);
    });
  });

  test.describe('WebSocket Performance', () => {
    test('should handle high-frequency real-time updates', async ({ page }) => {
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('/dashboard');

      // Navigate to real-time test execution page
      await page.goto('/test-execution/monitor');
      await page.waitForLoadState('networkidle');

      // Start monitoring WebSocket performance
      const performanceMetrics = await page.evaluate(async () => {
        return new Promise((resolve) => {
          const metrics = {
            messagesReceived: 0,
            totalLatency: 0,
            maxLatency: 0,
            minLatency: Infinity,
            droppedMessages: 0,
            startTime: performance.now()
          };

          const ws = new WebSocket('ws://localhost:8000');

          ws.onopen = () => {
            // Subscribe to real-time updates
            ws.send(JSON.stringify({
              type: 'subscribe',
              channel: 'test-execution'
            }));

            // Simulate high-frequency updates
            const interval = setInterval(() => {
              ws.send(JSON.stringify({
                type: 'ping',
                timestamp: performance.now()
              }));
            }, 50); // 20 messages per second

            // Run for 5 seconds
            setTimeout(() => {
              clearInterval(interval);
              resolve(metrics);
            }, 5000);
          };

          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);

              if (data.type === 'pong') {
                const latency = performance.now() - data.timestamp;
                metrics.messagesReceived++;
                metrics.totalLatency += latency;
                metrics.maxLatency = Math.max(metrics.maxLatency, latency);
                metrics.minLatency = Math.min(metrics.minLatency, latency);
              }
            } catch (error) {
              metrics.droppedMessages++;
            }
          };
        });
      });

      // Evaluate WebSocket performance
      const duration = performance.now() - performanceMetrics.startTime;
      const avgLatency = performanceMetrics.totalLatency / performanceMetrics.messagesReceived;
      const throughput = performanceMetrics.messagesReceived / (duration / 1000);

      expect(avgLatency).toBeLessThan(50);
      expect(throughput).toBeGreaterThan(15); // messages per second
      expect(performanceMetrics.droppedMessages).toBeLessThan(performanceMetrics.messagesReceived * 0.01); // < 1% dropped
    });
  });

  test.describe('Memory and Resource Usage', () => {
    test('should maintain stable memory usage during extended operation', async ({ page }) => {
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('/dashboard');

      const memorySnapshots: number[] = [];

      // Collect memory samples over time
      for (let i = 0; i < 20; i++) {
        const memoryInfo = await page.evaluate(() => {
          return performance.memory ? performance.memory.usedJSHeapSize : 0;
        });

        memorySnapshots.push(memoryInfo);

        // Perform various operations
        await page.click('[data-testid="nav-tests"]');
        await page.waitForTimeout(500);
        await page.click('[data-testid="nav-dashboard"]');
        await page.waitForTimeout(500);
        await page.click('[data-testid="nav-analytics"]');
        await page.waitForTimeout(500);
      }

      // Check for memory leaks
      const initialMemory = memorySnapshots[0];
      const finalMemory = memorySnapshots[memorySnapshots.length - 1];
      const memoryGrowth = finalMemory - initialMemory;

      // Memory growth should be minimal (< 50MB)
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);

      // Memory usage should not show continuous growth pattern
      const growthTrend = memorySnapshots.slice(-5).reduce((a, b, i, arr) => {
        if (i === 0) return 0;
        return a + (b - arr[i - 1]);
      }, 0);

      expect(growthTrend).toBeLessThan(10 * 1024 * 1024); // Last 5 samples should not show > 10MB growth
    });

    test('should handle resource cleanup properly', async ({ page }) => {
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('/dashboard');

      // Open and close multiple resources
      for (let i = 0; i < 10; i++) {
        // Open test details modal
        await page.click('[data-testid="test-card"]').first();
        await page.waitForSelector('[data-testid="test-modal"]');

        // Open execution logs
        await page.click('[data-testid="view-logs-button"]');
        await page.waitForSelector('[data-testid="logs-modal"]');

        // Close modals
        await page.click('[data-testid="close-modal"]').first();
        await page.click('[data-testid="close-modal"]').first();

        // Navigate to different pages
        await page.click('[data-testid="nav-tests"]');
        await page.waitForTimeout(200);
        await page.click('[data-testid="nav-dashboard"]');
        await page.waitForTimeout(200);
      }

      // Check for resource leaks
      const resourceCount = await page.evaluate(() => {
        return {
          eventListeners: (window as any).__eventListeners || 0,
          timers: (window as any).__timers || 0,
          websockets: (window as any).__websockets || 0
        };
      });

      // Should not have excessive resource accumulation
      expect(resourceCount.timers).toBeLessThan(20);
      expect(resourceCount.websockets).toBeLessThan(5);
    });
  });

  test.describe('Stress Testing', () => {
    test('should maintain performance under maximum user load', async ({ browser }) => {
      const userCount = 10; // Number of concurrent users to simulate
      const startTime = performance.now();

      // Create multiple browser contexts to simulate concurrent users
      const contexts = await Promise.all(
        Array.from({ length: userCount }, async () => {
          return await browser.newContext();
        })
      );

      // Simulate each user performing actions
      const userPromises = contexts.map(async (context, userIndex) => {
        const page = await context.newPage();

        try {
          // Login
          await page.goto('/login');
          await page.fill('[data-testid="email-input"]', `user${userIndex}@example.com`);
          await page.fill('[data-testid="password-input"]', 'Password123!');
          await page.click('[data-testid="login-button"]');
          await page.waitForURL('/dashboard');

          // Perform various actions
          await page.goto('/tests');
          await page.waitForTimeout(100);

          await page.goto('/analytics');
          await page.waitForTimeout(100);

          await page.goto('/test-execution');
          await page.waitForTimeout(100);

          return { success: true, userIndex };
        } catch (error) {
          return { success: false, userIndex, error: error.message };
        } finally {
          await page.close();
        }
      });

      const results = await Promise.all(userPromises);
      const totalTime = performance.now() - startTime;

      // Clean up contexts
      await Promise.all(contexts.map(context => context.close()));

      // Analyze results
      const successCount = results.filter(r => r.success).length;
      const successRate = successCount / userCount;

      expect(successRate).toBeGreaterThan(0.8); // At least 80% success rate
      expect(totalTime).toBeLessThan(30000); // Should complete within 30 seconds

      // Log any failures
      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        console.log('User simulation failures:', failures);
      }
    });
  });
});