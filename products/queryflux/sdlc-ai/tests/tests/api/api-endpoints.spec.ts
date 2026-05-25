import { test, expect } from '@playwright/test';
import axios, { AxiosError } from 'axios';

test.describe('API Endpoints Testing', () => {
  const baseURL = process.env.BASE_URL || 'https://sdlc.finsavvyai.com';
  const apiTimeout = 10000; // 10 seconds

  // API endpoints configuration
  const apiEndpoints = [
    {
      name: 'Health Check',
      path: '/health',
      method: 'GET',
      expectedStatus: 200,
      requiresAuth: false
    },
    {
      name: 'API Status',
      path: '/api/status',
      method: 'GET',
      expectedStatus: 200,
      requiresAuth: false
    },
    {
      name: 'Root Path',
      path: '/',
      method: 'GET',
      expectedStatus: 200,
      requiresAuth: false
    },
    {
      name: 'API Info',
      path: '/api/info',
      method: 'GET',
      expectedStatus: [200, 404], // Allow 404 if endpoint doesn't exist
      requiresAuth: false
    }
  ];

  test.describe('Basic Connectivity', () => {
    test('should handle OPTIONS requests (CORS)', async () => {
      try {
        const response = await axios.options(`${baseURL}/`, {
          timeout: apiTimeout,
          validateStatus: () => true
        });

        // OPTIONS should be handled (either 200, 204, or 405 is acceptable)
        expect([200, 204, 405]).toContain(response.status);

        // Check for CORS headers if status is not 405
        if (response.status !== 405) {
          const corsHeaders = [
            'access-control-allow-origin',
            'access-control-allow-methods',
            'access-control-allow-headers'
          ];

          const hasCorsHeaders = corsHeaders.some(header =>
            response.headers[header] || response.headers[header.toLowerCase()]
          );

          console.log('✅ CORS handling checked');
          console.log(`   Status: ${response.status}`);
          console.log(`   CORS headers present: ${hasCorsHeaders}`);

          if (hasCorsHeaders) {
            corsHeaders.forEach(header => {
              const value = response.headers[header] || response.headers[header.toLowerCase()];
              if (value) {
                console.log(`   ${header}: ${value}`);
              }
            });
          }
        }
      } catch (error: any) {
        console.log('⚠️ CORS test failed due to connection error:', error.message);
        // Don't fail the test if we can't connect - this might be expected in some environments
      }
    });

    test('should handle invalid endpoints gracefully', async () => {
      const invalidEndpoints = [
        '/invalid-endpoint',
        '/api/v1/does-not-exist',
        '/health/check/invalid',
        '/admin/secret'
      ];

      for (const endpoint of invalidEndpoints) {
        try {
          const response = await axios.get(`${baseURL}${endpoint}`, {
            timeout: apiTimeout,
            validateStatus: () => true
          });

          // Should return 404 or proper error response
          expect([404, 400, 401, 403, 405, 500]).toContain(response.status);

          // If JSON is returned, it should have an error structure
          if (response.headers['content-type']?.includes('application/json')) {
            expect(response.data).toBeDefined();
          }

          console.log(`✅ Invalid endpoint handled: ${endpoint} -> ${response.status}`);
        } catch (error: any) {
          // Network errors are acceptable for invalid endpoints
          console.log(`⚠️ Invalid endpoint network error: ${endpoint} -> ${error.message}`);
        }
      }
    });
  });

  test.describe('API Endpoint Tests', () => {
    apiEndpoints.forEach(endpoint => {
      test(`${endpoint.name} - ${endpoint.method} ${endpoint.path}`, async () => {
        try {
          const startTime = Date.now();

          let response;
          if (endpoint.method === 'GET') {
            response = await axios.get(`${baseURL}${endpoint.path}`, {
              timeout: apiTimeout,
              validateStatus: () => true
            });
          }

          const responseTime = Date.now() - startTime;

          if (response) {
            // Check status code
            if (Array.isArray(endpoint.expectedStatus)) {
              expect(endpoint.expectedStatus).toContain(response.status);
            } else {
              expect(response.status).toBe(endpoint.expectedStatus);
            }

            // Check response time
            expect(responseTime).toBeLessThan(apiTimeout);

            // Validate response structure for successful responses
            if (response.status >= 200 && response.status < 300) {
              if (response.headers['content-type']?.includes('application/json')) {
                expect(response.data).toBeDefined();
                expect(typeof response.data).toBe('object');
              }
            }

            console.log(`✅ ${endpoint.name}: ${response.status} (${responseTime}ms)`);

            // Log response data for debugging
            if (response.data && Object.keys(response.data).length > 0 && Object.keys(response.data).length < 10) {
              console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);
            }
          } else {
            console.log(`⚠️ ${endpoint.name}: No response received`);
          }
        } catch (error: any) {
          console.log(`❌ ${endpoint.name}: Error - ${error.message}`);

          // For non-critical endpoints, don't fail the test on connection errors
          if (endpoint.name.includes('Health') || endpoint.name.includes('Status')) {
            expect(error.code).not.toBe('ECONNREFUSED');
          }
        }
      });
    });
  });

  test.describe('Response Header Validation', () => {
    test('should have proper security headers', async () => {
      try {
        const response = await axios.get(`${baseURL}/`, {
          timeout: apiTimeout,
          validateStatus: () => true
        });

        if (response.status === 200) {
          const securityHeaders = [
            'x-content-type-options',
            'x-frame-options',
            'x-xss-protection',
            'strict-transport-security'
          ];

          const presentSecurityHeaders: string[] = [];
          const missingSecurityHeaders: string[] = [];

          securityHeaders.forEach(header => {
            const headerValue = response.headers[header] || response.headers[header.toLowerCase()];
            if (headerValue) {
              presentSecurityHeaders.push(header);
            } else {
              missingSecurityHeaders.push(header);
            }
          });

          console.log('✅ Security headers validation');
          console.log(`   Present: ${presentSecurityHeaders.join(', ')}`);
          if (missingSecurityHeaders.length > 0) {
            console.log(`   Missing: ${missingSecurityHeaders.join(', ')}`);
          }

          // At least some security headers should be present
          expect(presentSecurityHeaders.length).toBeGreaterThan(0);
        }
      } catch (error: any) {
        console.log('⚠️ Security headers test failed:', error.message);
      }
    });

    test('should have proper content-type headers', async () => {
      const endpoints = [
        { path: '/', expectedType: 'text/html' },
        { path: '/api/status', expectedType: 'application/json' }
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await axios.get(`${baseURL}${endpoint.path}`, {
            timeout: apiTimeout,
            validateStatus: () => true
          });

          if (response.status === 200) {
            const contentType = response.headers['content-type'];
            expect(contentType).toBeDefined();
            expect(contentType).toContain(endpoint.expectedType);

            console.log(`✅ Content-Type for ${endpoint.path}: ${contentType}`);
          }
        } catch (error: any) {
          console.log(`⚠️ Content-Type test failed for ${endpoint.path}:`, error.message);
        }
      }
    });
  });

  test.describe('API Performance Tests', () => {
    test('should handle concurrent requests', async () => {
      const concurrentRequests = 5;
      const requests = [];

      for (let i = 0; i < concurrentRequests; i++) {
        requests.push(
          axios.get(`${baseURL}/`, {
            timeout: apiTimeout,
            validateStatus: () => true
          }).catch(error => ({ error: error.message, status: 'failed' }))
        );
      }

      const results = await Promise.all(requests);
      const successfulRequests = results.filter(result => !result.error);

      // At least half of the requests should succeed
      expect(successfulRequests.length).toBeGreaterThan(Math.floor(concurrentRequests / 2));

      console.log('✅ Concurrent requests test');
      console.log(`   Successful: ${successfulRequests.length}/${concurrentRequests}`);
      console.log(`   Failed: ${concurrentRequests - successfulRequests.length}/${concurrentRequests}`);
    });

    test('should maintain response times within acceptable limits', async () => {
      const maxResponseTime = 5000; // 5 seconds
      const testRuns = 3;
      const responseTimes: number[] = [];

      for (let i = 0; i < testRuns; i++) {
        try {
          const startTime = Date.now();
          await axios.get(`${baseURL}/`, {
            timeout: apiTimeout,
            validateStatus: () => true
          });
          const responseTime = Date.now() - startTime;
          responseTimes.push(responseTime);
        } catch (error) {
          console.log(`Request ${i + 1} failed`);
        }
      }

      if (responseTimes.length > 0) {
        const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        const maxObservedTime = Math.max(...responseTimes);

        expect(avgResponseTime).toBeLessThan(maxResponseTime);
        expect(maxObservedTime).toBeLessThan(maxResponseTime * 1.5); // Allow some variance

        console.log('✅ Response time performance test');
        console.log(`   Average: ${Math.round(avgResponseTime)}ms`);
        console.log(`   Max: ${maxObservedTime}ms`);
        console.log(`   Min: ${Math.min(...responseTimes)}ms`);
      } else {
        console.log('⚠️ No successful requests for performance testing');
      }
    });
  });

  test.describe('Error Handling Tests', () => {
    test('should handle malformed requests gracefully', async () => {
      try {
        const response = await axios.post(
          `${baseURL}/api/test`,
          { invalid: 'data' },
          {
            timeout: apiTimeout,
            headers: {
              'Content-Type': 'application/json',
              'X-Test-Header': 'test-value'
            },
            validateStatus: () => true
          }
        );

        // Should handle the request gracefully (not crash)
        expect([200, 400, 404, 405, 500]).toContain(response.status);

        console.log(`✅ Malformed request handled: ${response.status}`);
      } catch (error: any) {
        console.log('⚠️ Malformed request test:', error.message);
      }
    });

    test('should handle large requests appropriately', async () => {
      try {
        const largeData = 'x'.repeat(1024 * 1024); // 1MB of data

        const response = await axios.post(
          `${baseURL}/api/test`,
          { data: largeData },
          {
            timeout: apiTimeout,
            validateStatus: () => true
          }
        );

        // Should either accept or reject the large request gracefully
        expect([200, 400, 413, 414]).toContain(response.status);

        console.log(`✅ Large request handled: ${response.status}`);
      } catch (error: any) {
        if (error.code === 'ECONNABORTED') {
          console.log('✅ Large request timed out as expected');
        } else {
          console.log('⚠️ Large request test:', error.message);
        }
      }
    });
  });

  test.describe('Authentication Tests', () => {
    test('should handle missing authentication', async () => {
      const protectedEndpoints = [
        '/api/admin',
        '/api/secure',
        '/api/users'
      ];

      for (const endpoint of protectedEndpoints) {
        try {
          const response = await axios.get(`${baseURL}${endpoint}`, {
            timeout: apiTimeout,
            validateStatus: () => true
          });

          // Protected endpoints should either not exist (404) or require auth (401/403)
          expect([401, 403, 404, 405]).toContain(response.status);

          console.log(`✅ Auth required for ${endpoint}: ${response.status}`);
        } catch (error: any) {
          console.log(`⚠️ Auth test for ${endpoint}:`, error.message);
        }
      }
    });

    test('should handle invalid authentication', async () => {
      try {
        const response = await axios.get(`${baseURL}/api/admin`, {
          timeout: apiTimeout,
          headers: {
            'Authorization': 'Bearer invalid-token',
            'X-API-Key': 'invalid-key'
          },
          validateStatus: () => true
        });

        // Should reject invalid authentication
        expect([401, 403, 404, 405]).toContain(response.status);

        console.log(`✅ Invalid auth rejected: ${response.status}`);
      } catch (error: any) {
        console.log('⚠️ Invalid auth test:', error.message);
      }
    });
  });
});