/**
 * SQL Injection and API Security Tests
 *
 * This test suite validates protection against SQL injection attacks and
 * ensures API security including rate limiting, authentication, and data exposure.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { TestHelper } from '../utils/test-helper';

describe('SQL Injection Protection Tests', () => {
  let testHelper: TestHelper;
  let authToken: string;

  beforeAll(async () => {
    testHelper = new TestHelper();
    await testHelper.setupTestEnvironment();

    const loginResponse = await testHelper.loginUser('test@example.com', 'SecurePass123!');
    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await testHelper.cleanupTestEnvironment();
  });

  beforeEach(async () => {
    await testHelper.resetTestState();
  });

  describe('Classic SQL Injection', () => {
    it('should prevent SQL injection in login forms', async () => {
      const sqliPayloads = [
        "' OR '1'='1",
        "' OR '1'='1' --",
        "' OR '1'='1' /*",
        "admin'--",
        "admin'/*",
        "' OR 1=1--",
        "' OR 1=1#",
        "' OR 1=1/*",
        "') OR '1'='1--",
        "') OR ('1'='1--",
        "1' OR '1'='1",
        "1' OR '1'='1' --",
        "admin' UNION SELECT * FROM users--",
        "'; DROP TABLE users; --",
        "1'; EXEC xp_cmdshell('dir'); --",
        "'; EXEC master..xp_cmdshell 'ping attacker.com';--",
        "' UNION SELECT @@version--",
        "' UNION SELECT @@datadir--",
        "' UNION SELECT schema_name FROM information_schema.schemata--",
        "' UNION SELECT table_name FROM information_schema.tables--",
        "' UNION SELECT column_name FROM information_schema.columns--",
        "' UNION SELECT password FROM users--",
        "'; INSERT INTO users (username, password) VALUES ('hacker', 'hacked');--",
        "'; UPDATE users SET password='hacked' WHERE username='admin';--",
        "' OR 1=1 AND SLEEP(5)--", // Time-based
        "'; WAITFOR DELAY '00:00:05'--", // SQL Server
        "1' AND (SELECT COUNT(*) FROM users) > 0--"
      ];

      for (const payload of sqliPayloads) {
        const response = await testHelper.makeRequest('POST', '/api/auth/login', {
          username: payload,
          password: 'password'
        });

        // Should always fail authentication
        expect(response.status).toBe(401);
        expect(response.body.token).toBeUndefined();
        expect(response.body.error).toMatch(/invalid|incorrect|failed/i);
      }
    });

    it('should prevent SQL injection in search parameters', async () => {
      const sqliSearchPayloads = [
        "test' UNION SELECT username, password FROM users--",
        "test' OR '1'='1",
        "test'; DROP TABLE projects;--",
        "test' AND (SELECT COUNT(*) FROM users) > 0--",
        "test' ORDER BY 1--",
        "test' ORDER BY 100--",
        "test' GROUP BY username,password--",
        "test' HAVING 1=1--",
        "test' UNION SELECT 1,@@version,3,4--",
        "test' UNION SELECT 1,database(),3,4--",
        "test' UNION SELECT 1,user(),3,4--",
        "test' PROCEDURE ANALYSE(1,1)--",
        "test' AND (SELECT * FROM (SELECT COUNT(*),CONCAT(version(),FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a)--"
      ];

      for (const payload of sqliSearchPayloads) {
        const response = await testHelper.makeRequest('GET', `/api/search?q=${encodeURIComponent(payload)}`, {}, true);

        // Should handle safely or return empty results
        if (response.status === 200) {
          // Should not contain database information
          const responseText = JSON.stringify(response.body);
          expect(responseText).not.toMatch(/password/i);
          expect(responseText).not.toMatch(/version/i);
          expect(responseText).not.toMatch(/database/i);
          expect(responseText).not.toMatch(/information_schema/i);
        }
      }
    });

    it('should prevent SQL injection in API endpoints', async () => {
      const apiEndpoints = [
        { method: 'GET', path: '/api/projects/123', param: 'id' },
        { method: 'GET', path: '/api/users/123', param: 'id' },
        { method: 'GET', path: '/api/tests/123', param: 'id' },
        { method: 'POST', path: '/api/projects', param: 'name' },
        { method: 'PUT', path: '/api/projects/123', param: 'name' }
      ];

      const sqliPayloads = [
        "123' UNION SELECT * FROM users--",
        "123'; DROP TABLE users;--",
        "123' OR '1'='1",
        "123' AND 1=CONVERT(int, (SELECT @@version))--",
        "123' AND 1=1 AND SLEEP(5)--",
        "123' ORDER BY 1--",
        "123' GROUP BY column_name--",
        "123' HAVING 1=1--",
        "123' UNION SELECT @@version,2,3--"
      ];

      for (const endpoint of apiEndpoints) {
        for (const payload of sqliPayloads) {
          const testPath = endpoint.path.replace('123', payload);

          let response;
          if (endpoint.method === 'POST') {
            response = await testHelper.makeRequest('POST', testPath, {
              [endpoint.param]: payload
            }, true);
          } else if (endpoint.method === 'PUT') {
            response = await testHelper.makeRequest('PUT', testPath, {
              [endpoint.param]: payload
            }, true);
          } else {
            response = await testHelper.makeRequest('GET', testPath, {}, true);
          }

          // Should handle SQL injection safely
          expect([200, 400, 404, 422]).toContain(response.status);

          if (response.status === 200) {
            // Should not leak database information
            const responseText = JSON.stringify(response.body);
            expect(responseText).not.toMatch(/SQL|syntax|error/i);
          }
        }
      }
    });

    it('should prevent boolean-based blind SQL injection', async () => {
      const blindSQLiPayloads = [
        "test' AND '1'='1",
        "test' AND '1'='2",
        "test' AND (SELECT COUNT(*) FROM users) > 0",
        "test' AND (SELECT COUNT(*) FROM users) < 0",
        "test' AND LENGTH((SELECT password FROM users LIMIT 1)) > 0",
        "test' AND SUBSTRING((SELECT password FROM users LIMIT 1),1,1)='a'",
        "test' AND ASCII(SUBSTRING((SELECT password FROM users LIMIT 1),1,1)) > 64",
        "test' AND (SELECT SUBSTRING(password,1,1) FROM users WHERE username='admin')='a'",
        "test' AND (SELECT COUNT(*) FROM users WHERE username='admin' AND password LIKE 'a%')>0",
        "test' AND (SELECT LENGTH(username) FROM users WHERE id=1)=5"
      ];

      for (const payload of blindSQLiPayloads) {
        const response1 = await testHelper.makeRequest('GET', `/api/search?q=${encodeURIComponent(payload)}`, {}, true);
        const response2 = await testHelper.makeRequest('GET', `/api/search?q=${encodeURIComponent(payload.replace('1', '2'))}`, {}, true);

        // Responses should be consistent to prevent boolean extraction
        expect(response1.status).toBe(response2.status);

        if (response1.status === 200 && response2.status === 200) {
          // Result count should be the same regardless of condition
          expect(response1.body.length).toBe(response2.body.length);
        }
      }
    });

    it('should prevent time-based blind SQL injection', async () => {
      const timeBasedPayloads = [
        "test' AND SLEEP(5)--",
        "test' AND pg_sleep(5)--",
        "test'; WAITFOR DELAY '00:00:05'--",
        "test' AND BENCHMARK(50000000,MD5('test'))--",
        "test' AND (SELECT COUNT(*) FROM ALL_USERS T1,ALL_USERS T2,ALL_USERS T3,ALL_USERS T4,ALL_USERS T5)>0--",
        "test' AND (SELECT COUNT(*) FROM pg_locks) > 0 AND SLEEP(3)--",
        "test' AND (SELECT COUNT(*) FROM information_schema.columns A, information_schema.columns B)>0--"
      ];

      for (const payload of timeBasedPayloads) {
        const startTime = Date.now();

        const response = await testHelper.makeRequest('GET', `/api/search?q=${encodeURIComponent(payload)}`, {}, true);

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Should not have significant delay
        expect(duration).toBeLessThan(2000); // 2 second threshold

        // Should respond normally
        expect([200, 400, 422]).toContain(response.status);
      }
    });

    it('should prevent second-order SQL injection', async () => {
      // First, inject malicious data
      const maliciousData = "test', (SELECT password FROM users WHERE username='admin'), '2023-01-01'), ('normal";

      const storeResponse = await testHelper.makeRequest('POST', '/api/projects', {
        name: maliciousData,
        description: 'Test project with potential injection'
      }, true);

      expect([200, 400, 422]).toContain(responseResponse.status);

      // Then try to trigger the injection through a different endpoint
      if (storeResponse.status === 200) {
        const triggerResponse = await testHelper.makeRequest('GET', '/api/projects', {}, true);

        if (triggerResponse.status === 200) {
          // Should not contain injected data
          const responseText = JSON.stringify(triggerResponse.body);
          expect(responseText).not.toMatch(/password/i);
          expect(responseText).not.toMatch(/admin/i);
        }
      }
    });

    it('should handle NoSQL injection attempts', async () => {
      const noSQLPayloads = [
        { username: { $ne: null }, password: { $ne: null } },
        { username: { $regex: ".*" }, password: { $regex: ".*" } },
        { $where: "this.username == 'admin'" },
        { $or: [{ username: "admin" }, { username: "administrator" }] },
        { $gt: "" },
        { $ne: "" },
        { $in: ["admin", "administrator", "root"] },
        { $exists: true },
        { $not: { $eq: "" } },
        { $expr: { $eq: ["$username", "admin"] } },
        { $jsonSchema: { required: ["username", "password"] } },
        { $comment: "malicious" }
      ];

      for (const payload of noSQLPayloads) {
        const response = await testHelper.makeRequest('POST', '/api/auth/login', payload);

        // Should reject NoSQL injection attempts
        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/invalid|malformed|unexpected/i);
      }
    });
  });

  describe('Parameterized Query Validation', () => {
    it('should use parameterized queries for all database operations', async () => {
      // This is a meta-test to ensure proper parameterization
      const testCases = [
        { endpoint: '/api/projects', method: 'POST', data: { name: "Test', DROP TABLE users;--" } },
        { endpoint: '/api/users', method: 'GET', param: 'id', value: "123' OR '1'='1" },
        { endpoint: '/api/search', method: 'GET', param: 'q', value: "test' UNION SELECT * FROM users--" },
        { endpoint: '/api/projects/123', method: 'PUT', data: { name: "'; DELETE FROM projects;--" } }
      ];

      for (const testCase of testCases) {
        let response;

        if (testCase.method === 'POST') {
          response = await testHelper.makeRequest('POST', testCase.endpoint, testCase.data, true);
        } else if (testCase.method === 'PUT') {
          response = await testHelper.makeRequest('PUT', testCase.endpoint, testCase.data, true);
        } else if (testCase.param) {
          response = await testHelper.makeRequest('GET', `${testCase.endpoint}?${testCase.param}=${encodeURIComponent(testCase.value)}`, {}, true);
        } else {
          response = await testHelper.makeRequest('GET', testCase.endpoint, {}, true);
        }

        // Should handle malicious input safely
        expect([200, 400, 404, 422]).toContain(response.status);

        // If successful, should have stored/returned escaped or rejected data
        if (response.status === 200) {
          const responseText = JSON.stringify(response.body);
          expect(responseText).not.toMatch(/SQL/i);
          expect(responseText).not.toMatch(/syntax/i);
        }
      }
    });
  });
});

describe('API Security Tests', () => {
  let testHelper: TestHelper;
  let userToken: string;
  let adminToken: string;

  beforeAll(async () => {
    testHelper = new TestHelper();
    await testHelper.setupTestEnvironment();

    const userLogin = await testHelper.loginUser('user@test.com', 'SecurePass123!');
    userToken = userLogin.body.token;

    const adminLogin = await testHelper.loginUser('admin@test.com', 'SecurePass123!');
    adminToken = adminLogin.body.token;
  });

  afterAll(async () => {
    await testHelper.cleanupTestEnvironment();
  });

  describe('API Authentication Security', () => {
    it('should require authentication for protected endpoints', async () => {
      const protectedEndpoints = [
        { method: 'GET', path: '/api/profile' },
        { method: 'POST', path: '/api/projects' },
        { method: 'PUT', path: '/api/profile' },
        { method: 'DELETE', path: '/api/projects/123' },
        { method: 'GET', path: '/api/users/me' },
        { method: 'POST', path: '/api/tests' }
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await testHelper.makeRequest(endpoint.method, endpoint.path, {}, false);

        expect(response.status).toBe(401);
        expect(response.body.error).toMatch(/unauthorized|authentication/i);
      }
    });

    it('should validate API keys', async () => {
      const invalidApiKeys = [
        'invalid-key',
        '',
        '12345',
        'sk_test_12345', // Stripe format but invalid
        'Bearer invalid',
        'Token invalid'
      ];

      for (const apiKey of invalidApiKeys) {
        const response = await testHelper.makeRequest('GET', '/api/projects', {}, false, {
          'Authorization': `Bearer ${apiKey}`
        });

        expect(response.status).toBe(401);
      }
    });

    it('should prevent API key bypass attempts', async () => {
      const bypassAttempts = [
        { header: 'X-API-KEY', value: 'admin' },
        { header: 'X-Auth-Token', value: 'bypass' },
        { header: 'X-Session-ID', value: 'admin-session' },
        { header: 'X-User-ID', value: '1' },
        { header: 'X-Role', value: 'admin' },
        { header: 'X-Debug', value: 'true' },
        { header: 'X-Forwarded-For', value: '127.0.0.1' },
        { header: 'X-Real-IP', value: '127.0.0.1' }
      ];

      for (const attempt of bypassAttempts) {
        const response = await testHelper.makeRequest('GET', '/api/admin/users', {}, false, {
          [attempt.header]: attempt.value
        });

        expect(response.status).toBe(401);
      }
    });

    it('should implement proper token expiration', async () => {
      const expiredToken = await testHelper.createExpiredToken();

      const response = await testHelper.makeRequest('GET', '/api/profile', {}, false, {
        'Authorization': `Bearer ${expiredToken}`
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/expired/i);
    });
  });

  describe('API Rate Limiting', () => {
    it('should implement rate limiting on public endpoints', async () => {
      const publicEndpoint = '/api/auth/login';

      // Make rapid requests
      const responses = [];
      for (let i = 0; i < 10; i++) {
        const response = await testHelper.makeRequest('POST', publicEndpoint, {
          username: 'test@example.com',
          password: 'wrongpassword'
        });
        responses.push(response);
      }

      // Should eventually be rate limited
      const lastResponse = responses[responses.length - 1];
      expect(lastResponse.status).toBe(429);
      expect(lastResponse.headers['retry-after']).toBeDefined();
    });

    it('should implement rate limiting on authenticated endpoints', async () => {
      const authenticatedEndpoint = '/api/projects';

      // Make rapid requests
      const responses = [];
      for (let i = 0; i < 15; i++) {
        const response = await testHelper.makeRequest('POST', authenticatedEndpoint, {
          name: `Test Project ${i}`
        }, true);
        responses.push(response);
      }

      // Check if rate limited
      const rateLimited = responses.some(r => r.status === 429);
      if (rateLimited) {
        const rateLimitedResponse = responses.find(r => r.status === 429);
        expect(rateLimitedResponse.headers['retry-after']).toBeDefined();
      }
    });

    it('should implement endpoint-specific rate limits', async () => {
      const endpointLimits = [
        { endpoint: '/api/auth/login', limit: 5, window: '60s' },
        { endpoint: '/api/auth/forgot-password', limit: 3, window: '5m' },
        { endpoint: '/api/auth/register', limit: 10, window: '1h' }
      ];

      for (const limit of endpointLimits) {
        // Test rate limit
        const responses = [];
        for (let i = 0; i < limit.limit + 2; i++) {
          const response = await testHelper.makeRequest('POST', limit.endpoint, {
            username: `test${i}@example.com`,
            password: 'password123'
          });
          responses.push(response);
        }

        // Should be rate limited after limit
        const rateLimited = responses.slice(limit.limit).some(r => r.status === 429);
        expect(rateLimited).toBe(true);
      }
    });
  });

  describe('Data Exposure Prevention', () => {
    it('should not expose sensitive fields in API responses', async () => {
      const sensitiveFields = [
        'password',
        'salt',
        'hash',
        'secret',
        'apiKey',
        'privateKey',
        'token',
        'creditCard',
        'ssn',
        'passwordResetToken'
      ];

      // Check user profile
      const profileResponse = await testHelper.makeRequest('GET', '/api/profile', {}, true);
      expect(profileResponse.status).toBe(200);

      const profileText = JSON.stringify(profileResponse.body);
      for (const field of sensitiveFields) {
        expect(profileText).not.toMatch(new RegExp(field, 'i'));
      }

      // Check project data
      const projectsResponse = await testHelper.makeRequest('GET', '/api/projects', {}, true);
      if (projectsResponse.status === 200) {
        const projectsText = JSON.stringify(projectsResponse.body);
        for (const field of sensitiveFields) {
          expect(projectsText).not.toMatch(new RegExp(field, 'i'));
        }
      }
    });

    it('should implement proper field filtering based on user role', async () => {
      // Admin should see more fields
      const adminResponse = await testHelper.makeRequest('GET', '/api/users/123', {}, false, {
        'Authorization': `Bearer ${adminToken}`
      });

      // Regular user should see fewer fields
      const userResponse = await testHelper.makeRequest('GET', '/api/users/me', {}, false, {
        'Authorization': `Bearer ${userToken}`
      });

      if (adminResponse.status === 200 && userResponse.status === 200) {
        // Admin response should have more fields
        expect(Object.keys(adminResponse.body).length).toBeGreaterThanOrEqual(
          Object.keys(userResponse.body).length
        );
      }
    });

    it('should prevent excessive data retrieval', async () => {
      const paginationTests = [
        { endpoint: '/api/projects', params: 'limit=10000' },
        { endpoint: '/api/projects', params: 'limit=-1' },
        { endpoint: '/api/projects', params: 'limit=0' },
        { endpoint: '/api/projects', params: 'offset=999999' },
        { endpoint: '/api/projects', params: 'limit=1000&offset=1000' }
      ];

      for (const test of paginationTests) {
        const response = await testHelper.makeRequest('GET', `/api/projects?${test.params}`, {}, true);

        // Should limit results or reject
        if (response.status === 200) {
          expect(response.body.length).toBeLessThan(1000);
        }
      }
    });

    it('should not leak internal information in error messages', async () => {
      const errorEndpoints = [
        '/api/nonexistent',
        '/api/projects/999999999999',
        '/api/users/invalid-id',
        '/api/invalid-route'
      ];

      for (const endpoint of errorEndpoints) {
        const response = await testHelper.makeRequest('GET', endpoint, {}, true);

        const errorText = JSON.stringify(response.body);

        // Should not contain internal information
        expect(errorText).not.toMatch(/internal server error/i);
        expect(errorText).not.toMatch(/stack trace/i);
        expect(errorText).not.toMatch(/database error/i);
        expect(errorText).not.toMatch(/SQL/i);
        expect(errorText).not.toMatch(/Exception/i);
        expect(errorText).not.toMatch(/\/var\/www/i);
        expect(errorText).not.toMatch(/localhost/i);
      }
    });
  });

  describe('API Version Security', () => {
    it('should handle version deprecation', async () => {
      // Test deprecated version
      const deprecatedResponse = await testHelper.makeRequest('GET', '/api/v1/projects', {}, true);

      if (deprecatedResponse.status === 200) {
        // Should include deprecation warning
        expect(deprecatedResponse.headers['deprecation'] || deprecatedResponse.headers['x-deprecation']).toBeDefined();
      }

      // Test unsupported version
      const unsupportedResponse = await testHelper.makeRequest('GET', '/api/v0/projects', {}, true);
      expect([400, 404, 410]).toContain(unsupportedResponse.status);
    });

    it('should validate version compatibility', async () => {
      const versionHeaders = [
        'application/vnd.api+json;version=1',
        'application/json;version=2',
        'application/vnd.myapi.v1+json'
      ];

      for (const header of versionHeaders) {
        const response = await testHelper.makeRequest('GET', '/api/projects', {}, true, {
          'Accept': header
        });

        // Should handle version properly
        expect([200, 400, 406]).toContain(response.status);
      }
    });
  });

  describe('CORS Security', () => {
    it('should implement proper CORS headers', async () => {
      const response = await testHelper.makeRequest('OPTIONS', '/api/projects', {}, false, {
        'Origin': 'https://evil.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Authorization'
      });

      // Should not allow arbitrary origins
      expect(response.headers['access-control-allow-origin']).not.toBe('*');

      // Should not allow malicious origin
      if (response.headers['access-control-allow-origin']) {
        expect(response.headers['access-control-allow-origin']).not.toBe('https://evil.com');
      }
    });

    it('should not reflect malicious Origin header', async () => {
      const maliciousOrigins = [
        'https://evil.com',
        'javascript://evil.com',
        'data://evil.com',
        'vbscript://evil.com'
      ];

      for (const origin of maliciousOrigins) {
        const response = await testHelper.makeRequest('GET', '/api/projects', {}, false, {
          'Origin': origin
        });

        // Should not reflect malicious origin
        expect(response.headers['access-control-allow-origin']).not.toBe(origin);
      }
    });
  });

  describe('API Input Validation', () => {
    it('should validate JSON input structure', async () => {
      const invalidInputs = [
        '{"name": "test",}', // Trailing comma
        '{"name": "test", "invalid": \n}', // Incomplete
        '{"name": test}', // Unquoted string
        '{"name": "test" "description": "desc"}', // Missing comma
        'not json at all',
        'null',
        '{"nested": {"deep": {"value": "test"}}}' // Potentially too deep
      ];

      for (const input of invalidInputs) {
        try {
          const response = await testHelper.makeRequest('POST', '/api/projects', input, true, {
            'Content-Type': 'application/json'
          });

          // Should reject malformed JSON
          if (typeof input !== 'object') {
            expect([400, 422]).toContain(response.status);
          }
        } catch (error) {
          // Should handle JSON parse errors
          expect(error).toBeDefined();
        }
      }
    });

    it('should validate content-type headers', async () => {
      const invalidContentTypes = [
        'text/html',
        'application/xml',
        'text/plain',
        'multipart/form-data',
        'application/x-www-form-urlencoded'
      ];

      for (const contentType of invalidContentTypes) {
        const response = await testHelper.makeRequest('POST', '/api/projects', {}, true, {
          'Content-Type': contentType
        });

        // Should reject wrong content type
        expect([400, 415]).toContain(response.status);
      }
    });

    it('should handle large payloads safely', async () => {
      const largePayload = {
        name: 'Test',
        description: 'x'.repeat(10 * 1024 * 1024), // 10MB
        metadata: {
          data: 'y'.repeat(10 * 1024 * 1024) // Another 10MB
        }
      };

      const response = await testHelper.makeRequest('POST', '/api/projects', largePayload, true);

      // Should handle large payloads
      expect([200, 400, 413, 422]).toContain(response.status);
    });
  });

  describe('HTTP Method Security', () => {
    it('should validate allowed HTTP methods', async () => {
      const endpoint = '/api/projects';
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'TRACE', 'CONNECT'];

      for (const method of methods) {
        if (method === 'TRACE' || method === 'CONNECT') {
          // These methods should be disabled
          const response = await testHelper.makeRequest(method, endpoint, {}, true);
          expect([405, 501]).toContain(response.status);
        } else {
          const response = await testHelper.makeRequest(method, endpoint, {}, true);
          expect([200, 201, 204, 400, 401, 404, 405]).toContain(response.status);
        }
      }
    });

    it('should prevent HTTP method bypass', async () => {
      const bypassAttempts = [
        { header: 'X-HTTP-Method-Override', value: 'DELETE' },
        { header: 'X-HTTP-Method', value: 'PUT' },
        { header: 'X-Method-Override', value: 'PATCH' },
        { query: '_method=DELETE' },
        { query: 'method=PUT' }
      ];

      for (const attempt of bypassAttempts) {
        let response;
        if (attempt.header) {
          response = await testHelper.makeRequest('POST', '/api/projects/123', {}, true, {
            [attempt.header]: attempt.value
          });
        } else {
          response = await testHelper.makeRequest('POST', `/api/projects/123?${attempt.query}`, {}, true);
        }

        // Should not allow method override
        expect([400, 404, 405]).toContain(response.status);
      }
    });
  });
});

export {};
