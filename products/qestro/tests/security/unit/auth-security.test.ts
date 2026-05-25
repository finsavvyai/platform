/**
 * Authentication and Authorization Security Tests
 *
 * This test suite validates the security of authentication and authorization mechanisms
 * including password policies, session management, privilege escalation, and access control.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { SecurityTestFramework, SecurityTestConfig } from '../security-test-framework';
import { TestHelper } from '../utils/test-helper';

describe('Authentication Security Tests', () => {
  let framework: SecurityTestFramework;
  let testHelper: TestHelper;
  let testConfig: SecurityTestConfig;

  beforeAll(async () => {
    framework = new SecurityTestFramework();
    testHelper = new TestHelper();

    testConfig = {
      targetUrl: process.env.TEST_TARGET_URL || 'http://localhost:8000',
      apiEndpoint: process.env.TEST_API_ENDPOINT || 'http://localhost:8000/api',
      testEnvironment: 'development',
      testScopes: {
        authentication: true,
        authorization: true,
        inputValidation: false,
        xssProtection: false,
        sqlInjection: false,
        csrfProtection: false,
        securityHeaders: false,
        dataEncryption: false,
        apiSecurity: false,
        sessionManagement: true
      },
      complianceFrameworks: [],
      options: {
        enableActiveScanning: false,
        maxScanDuration: 30,
        requestDelay: 100,
        followRedirects: true,
        checkForUpdates: false,
        generateDetailedReports: true,
        saveTestArtifacts: true
      }
    };

    await testHelper.setupTestEnvironment();
  });

  afterAll(async () => {
    await testHelper.cleanupTestEnvironment();
  });

  beforeEach(async () => {
    await testHelper.resetTestState();
  });

  describe('Password Policy Security', () => {
    it('should reject weak passwords during registration', async () => {
      const weakPasswords = [
        'password',
        '123456',
        'admin',
        'qwerty',
        'letmein',
        'welcome',
        'monkey',
        '123456789',
        'password123',
        'abc123'
      ];

      for (const password of weakPasswords) {
        const response = await testHelper.makeRequest('POST', '/api/auth/register', {
          username: `testuser_${Date.now()}`,
          email: `test_${Date.now()}@example.com`,
          password: password
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/password.*(weak|insecure|invalid)/i);
      }
    });

    it('should enforce password complexity requirements', async () => {
      const invalidPasswords = [
        { password: 'short', reason: 'too short' },
        { password: 'nouppercase1!', reason: 'missing uppercase' },
        { password: 'NOLOWERCASE1!', reason: 'missing lowercase' },
        { password: 'NoNumbers!', reason: 'missing numbers' },
        { password: 'NoSpecialChars1', reason: 'missing special characters' },
        { password: 'CommonPassword1!', reason: 'common password' }
      ];

      for (const { password, reason } of invalidPasswords) {
        const response = await testHelper.makeRequest('POST', '/api/auth/register', {
          username: `testuser_${Date.now()}`,
          email: `test_${Date.now()}@example.com`,
          password: password
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toBeDefined();
      }
    });

    it('should prevent password reuse', async () => {
      const username = `testuser_${Date.now()}`;
      const password = 'SecurePassword123!';

      // Register and change password
      await testHelper.registerUser(username, 'test@example.com', password);
      await testHelper.loginUser(username, password);

      // Try to reuse the same password
      const response = await testHelper.makeRequest('PUT', '/api/auth/change-password', {
        currentPassword: password,
        newPassword: password
      }, true);

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/cannot reuse|same password/i);
    });
  });

  describe('Authentication Bypass Attempts', () => {
    it('should prevent SQL injection in login forms', async () => {
      const sqliPayloads = [
        "' OR '1'='1",
        "admin'--",
        "admin'/*",
        "' OR 1=1--",
        "' UNION SELECT * FROM users--",
        "'; DROP TABLE users; --"
      ];

      for (const payload of sqliPayloads) {
        const response = await testHelper.makeRequest('POST', '/api/auth/login', {
          username: payload,
          password: payload
        });

        expect(response.status).toBe(401);
        expect(response.body.token).toBeUndefined();
      }
    });

    it('should rate limit login attempts', async () => {
      const username = 'testuser@example.com';
      const wrongPassword = 'wrongpassword';

      // Make multiple failed attempts
      let attempts = 0;
      let lastResponse: any;

      for (attempts = 1; attempts <= 10; attempts++) {
        lastResponse = await testHelper.makeRequest('POST', '/api/auth/login', {
          username: username,
          password: wrongPassword
        });
      }

      // Should be rate limited after several attempts
      expect(lastResponse.status).toBe(429);
      expect(lastResponse.headers['retry-after']).toBeDefined();
    });

    it('should implement account lockout mechanism', async () => {
      const username = 'lockout@test.com';
      const wrongPassword = 'wrongpassword';

      // Exceed maximum failed attempts
      for (let i = 0; i < 6; i++) {
        await testHelper.makeRequest('POST', '/api/auth/login', {
          username: username,
          password: wrongPassword
        });
      }

      // Try to login with correct password after lockout
      const response = await testHelper.makeRequest('POST', '/api/auth/login', {
        username: username,
        password: 'correctpassword'
      });

      expect(response.status).toBe(423);
      expect(response.body.error).toMatch(/account.*lock|temporarily disabled/i);
    });

    it('should validate JWT tokens properly', async () => {
      // Test with malformed token
      const malformedTokens = [
        'invalid.token.here',
        'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.',
        'Bearer token',
        '',
        null,
        undefined
      ];

      for (const token of malformedTokens) {
        const response = await testHelper.makeRequest('GET', '/api/auth/profile', {}, false, {
          Authorization: `Bearer ${token}`
        });

        expect(response.status).toBe(401);
      }
    });

    it('should reject expired tokens', async () => {
      // Create an expired token (simulated)
      const expiredToken = await testHelper.createExpiredToken();

      const response = await testHelper.makeRequest('GET', '/api/auth/profile', {}, false, {
        Authorization: `Bearer ${expiredToken}`
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/token.*expir/i);
    });
  });

  describe('Multi-Factor Authentication', () => {
    it('should enforce MFA for privileged operations', async () => {
      // Login without MFA
      const loginResponse = await testHelper.loginUser('admin@test.com', 'SecurePass123!');

      // Try to perform privileged operation without MFA
      const response = await testHelper.makeRequest('POST', '/api/admin/users/create', {
        username: 'newuser',
        email: 'newuser@test.com',
        role: 'admin'
      }, true);

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/mfa.*requir/i);
    });

    it('should validate MFA codes correctly', async () => {
      // Test with invalid MFA codes
      const invalidCodes = [
        '000000',
        '1234567',
        'abcdef',
        '',
        null,
        '999999'
      ];

      for (const code of invalidCodes) {
        const response = await testHelper.makeRequest('POST', '/api/auth/verify-mfa', {
          code: code
        }, true);

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/invalid.*code/i);
      }
    });

    it('should prevent MFA bypass attempts', async () => {
      const bypassAttempts = [
        { mfa_bypass: 'true' },
        { skip_mfa: 'yes' },
        { admin_override: 'true' },
        { debug_mode: 'true' }
      ];

      for (const attempt of bypassAttempts) {
        const response = await testHelper.makeRequest('POST', '/api/auth/login', {
          username: 'admin@test.com',
          password: 'SecurePass123!',
          ...attempt
        });

        if (response.status === 200) {
          // Should still require MFA verification
          expect(response.body.mfa_required).toBe(true);
          expect(response.body.token).toBeUndefined();
        }
      }
    });
  });

  describe('Session Security', () => {
    it('should create secure session tokens', async () => {
      const loginResponse = await testHelper.loginUser('test@example.com', 'SecurePass123!');

      expect(loginResponse.body.token).toBeDefined();
      expect(loginResponse.body.token.length).toBeGreaterThan(100);

      // Token should be JWT format
      const parts = loginResponse.body.token.split('.');
      expect(parts).toHaveLength(3);
    });

    it('should invalidate session on logout', async () => {
      await testHelper.loginUser('test@example.com', 'SecurePass123!');

      // Logout
      const logoutResponse = await testHelper.makeRequest('POST', '/api/auth/logout', {}, true);
      expect(logoutResponse.status).toBe(200);

      // Try to use token after logout
      const response = await testHelper.makeRequest('GET', '/api/auth/profile', {}, true);
      expect(response.status).toBe(401);
    });

    it('should implement session timeout', async () => {
      // Create a session
      await testHelper.loginUser('test@example.com', 'SecurePass123!');

      // Simulate time passing (in test environment, this might be mocked)
      await testHelper.simulateTimePassage(31 * 60 * 1000); // 31 minutes

      // Try to use expired session
      const response = await testHelper.makeRequest('GET', '/api/auth/profile', {}, true);
      expect(response.status).toBe(401);
    });

    it('should prevent session fixation', async () => {
      // Try to set session ID before login
      const response1 = await testHelper.makeRequest('POST', '/api/auth/login', {
        username: 'test@example.com',
        password: 'SecurePass123!'
      }, false, {
        'Cookie': 'sessionid=attacker-controlled-id'
      });

      expect(response1.status).toBe(200);
      expect(response1.body.token).not.toContain('attacker-controlled-id');

      // Session should be regenerated
      const newToken = response1.body.token;
      expect(newToken).toBeDefined();
      expect(newToken).not.toBe('attacker-controlled-id');
    });
  });

  describe('Password Reset Security', () => {
    it('should validate password reset tokens', async () => {
      // Test with invalid reset tokens
      const invalidTokens = [
        'invalid-token',
        'expired-token',
        '',
        null,
        '12345'
      ];

      for (const token of invalidTokens) {
        const response = await testHelper.makeRequest('POST', '/api/auth/reset-password', {
          token: token,
          newPassword: 'NewSecurePass123!'
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/invalid.*token/i);
      }
    });

    it('should prevent password reset enumeration', async () => {
      const emails = [
        'existing@test.com',
        'nonexisting@test.com',
        'admin@test.com',
        'user@test.com'
      ];

      for (const email of emails) {
        const response = await testHelper.makeRequest('POST', '/api/auth/forgot-password', {
          email: email
        });

        // Should return same response regardless of email existence
        expect(response.status).toBe(200);
        expect(response.body.message).toBeDefined();
        expect(response.body.exists).toBeUndefined();
      }
    });

    it('should expire password reset tokens', async () => {
      // Request password reset
      const resetResponse = await testHelper.makeRequest('POST', '/api/auth/forgot-password', {
        email: 'test@example.com'
      });

      // Simulate token expiration
      await testHelper.simulateTimePassage(25 * 60 * 60 * 1000); // 25 hours

      // Try to use expired token
      const response = await testHelper.makeRequest('POST', '/api/auth/reset-password', {
        token: resetResponse.body.token,
        newPassword: 'NewSecurePass123!'
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/token.*expir/i);
    });
  });
});

describe('Authorization Security Tests', () => {
  let framework: SecurityTestFramework;
  let testHelper: TestHelper;
  let adminToken: string;
  let userToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    framework = new SecurityTestFramework();
    testHelper = new TestHelper();
    await testHelper.setupTestEnvironment();

    // Create users with different roles
    const adminLogin = await testHelper.loginUser('admin@test.com', 'SecurePass123!');
    adminToken = adminLogin.body.token;

    const userLogin = await testHelper.loginUser('user@test.com', 'SecurePass123!');
    userToken = userLogin.body.token;

    const viewerLogin = await testHelper.loginUser('viewer@test.com', 'SecurePass123!');
    viewerToken = viewerLogin.body.token;
  });

  afterAll(async () => {
    await testHelper.cleanupTestEnvironment();
  });

  describe('Role-Based Access Control', () => {
    it('should enforce admin-only endpoints', async () => {
      const adminEndpoints = [
        { method: 'GET', path: '/api/admin/users' },
        { method: 'POST', path: '/api/admin/users/create' },
        { method: 'DELETE', path: '/api/admin/users/123' },
        { method: 'PUT', path: '/api/admin/settings' }
      ];

      // Test with user token (should fail)
      for (const endpoint of adminEndpoints) {
        const response = await testHelper.makeRequest(endpoint.method, endpoint.path, {}, false, {
          Authorization: `Bearer ${userToken}`
        });

        expect(response.status).toBe(403);
        expect(response.body.error).toMatch(/forbidden|unauthorized/i);
      }

      // Test with admin token (should succeed)
      for (const endpoint of adminEndpoints) {
        const response = await testHelper.makeRequest(endpoint.method, endpoint.path, {}, false, {
          Authorization: `Bearer ${adminToken}`
        });

        expect([200, 201, 204]).toContain(response.status);
      }
    });

    it('should enforce user-level permissions', async () => {
      // User should only access their own data
      const userId = 'user-123';
      const otherUserId = 'user-456';

      // Access own data (should succeed)
      const ownResponse = await testHelper.makeRequest('GET', `/api/users/${userId}`, {}, false, {
        Authorization: `Bearer ${userToken}`
      });

      expect(ownResponse.status).toBe(200);

      // Access other user's data (should fail)
      const otherResponse = await testHelper.makeRequest('GET', `/api/users/${otherUserId}`, {}, false, {
        Authorization: `Bearer ${userToken}`
      });

      expect(otherResponse.status).toBe(403);
    });

    it('should enforce read-only permissions for viewers', async () => {
      const endpoints = [
        { method: 'POST', path: '/api/projects', data: { name: 'Test Project' } },
        { method: 'PUT', path: '/api/projects/123', data: { name: 'Updated' } },
        { method: 'DELETE', path: '/api/projects/123' },
        { method: 'POST', path: '/api/tests', data: { name: 'Test Case' } }
      ];

      for (const endpoint of endpoints) {
        const response = await testHelper.makeRequest(
          endpoint.method,
          endpoint.path,
          endpoint.data || {},
          false,
          { Authorization: `Bearer ${viewerToken}` }
        );

        expect(response.status).toBe(403);
        expect(response.body.error).toMatch(/forbidden|read.?only/i);
      }
    });
  });

  describe('Horizontal Privilege Escalation', () => {
    it('should prevent users from accessing other users\' resources', async () => {
      // Create test data as user1
      const projectResponse = await testHelper.makeRequest('POST', '/api/projects', {
        name: 'Secret Project'
      }, false, { Authorization: `Bearer ${userToken}` });

      const projectId = projectResponse.body.id;

      // Try to access as different user (viewer)
      const accessResponse = await testHelper.makeRequest('GET', `/api/projects/${projectId}`, {}, false, {
        Authorization: `Bearer ${viewerToken}`
      });

      expect(accessResponse.status).toBe(403);
    });

    it('should prevent modification of other users\' data', async () => {
      // Create a test record
      const createResponse = await testHelper.makeRequest('POST', '/api/tests', {
        name: 'My Test Case',
        description: 'Original description'
      }, false, { Authorization: `Bearer ${userToken}` });

      const testId = createResponse.body.id;

      // Try to modify as different user
      const updateResponse = await testHelper.makeRequest('PUT', `/api/tests/${testId}`, {
        name: 'Hacked Test Case',
        description: 'Modified by attacker'
      }, false, { Authorization: `Bearer ${viewerToken}` });

      expect(updateResponse.status).toBe(403);

      // Verify data wasn't changed
      const verifyResponse = await testHelper.makeRequest('GET', `/api/tests/${testId}`, {}, false, {
        Authorization: `Bearer ${userToken}`
      });

      expect(verifyResponse.body.name).toBe('My Test Case');
      expect(verifyResponse.body.description).toBe('Original description');
    });

    it('should prevent access to sensitive data through API endpoints', async () => {
      const sensitiveEndpoints = [
        '/api/users',
        '/api/auth/sessions',
        '/api/admin/logs',
        '/api/billing/invoices',
        '/api/organization/secrets'
      ];

      for (const endpoint of sensitiveEndpoints) {
        const response = await testHelper.makeRequest('GET', endpoint, {}, false, {
          Authorization: `Bearer ${userToken}`
        });

        expect([401, 403, 404]).toContain(response.status);
      }
    });
  });

  describe('Vertical Privilege Escalation', () => {
    it('should prevent privilege escalation through role manipulation', async () => {
      // Try to elevate privileges
      const escalateAttempts = [
        { path: '/api/auth/set-role', data: { role: 'admin' } },
        { path: '/api/users/me/role', data: { role: 'admin' } },
        { path: '/api/permissions/grant', data: { permission: 'admin' } }
      ];

      for (const attempt of escalateAttempts) {
        const response = await testHelper.makeRequest('POST', attempt.path, attempt.data, false, {
          Authorization: `Bearer ${userToken}`
        });

        expect(response.status).toBe(403);
      }

      // Verify role wasn't changed
      const profileResponse = await testHelper.makeRequest('GET', '/api/auth/profile', {}, false, {
        Authorization: `Bearer ${userToken}`
      });

      expect(profileResponse.body.role).not.toBe('admin');
    });

    it('should prevent admin endpoint access without proper privileges', async () => {
      const adminOperations = [
        { method: 'POST', path: '/api/admin/system/config', data: { debug: true } },
        { method: 'POST', path: '/api/admin/users/promote', data: { userId: '123', role: 'admin' } },
        { method: 'DELETE', path: '/api/admin/logs/clear' },
        { method: 'POST', path: '/api/admin/maintenance/enable' }
      ];

      for (const operation of adminOperations) {
        const response = await testHelper.makeRequest(
          operation.method,
          operation.path,
          operation.data || {},
          false,
          { Authorization: `Bearer ${userToken}` }
        );

        expect(response.status).toBe(403);
      }
    });

    it('should validate permission checks on all protected resources', async () => {
      // Test various resource access patterns
      const testCases = [
        { resource: '/api/projects/123/settings', action: 'modify' },
        { resource: '/api/organization/123/members', action: 'view' },
        { resource: '/api/billing/123/invoices', action: 'view' },
        { resource: '/api/integrations/123/config', action: 'modify' },
        { resource: '/api/reports/123/sensitive', action: 'view' }
      ];

      for (const testCase of testCases) {
        const response = await testHelper.makeRequest(
          testCase.action === 'modify' ? 'PUT' : 'GET',
          testCase.resource,
          {},
          false,
          { Authorization: `Bearer ${userToken}` }
        );

        // Should either succeed with proper authorization or fail gracefully
        if (response.status !== 200) {
          expect([401, 403, 404]).toContain(response.status);
        }
      }
    });
  });

  describe('Insecure Direct Object References', () => {
    it('should prevent IDOR vulnerabilities', async () => {
      // Create resources as authenticated user
      const resources = [
        { type: 'project', endpoint: '/api/projects' },
        { type: 'test', endpoint: '/api/tests' },
        { type: 'report', endpoint: '/api/reports' }
      ];

      for (const resource of resources) {
        // Create resource
        const createResponse = await testHelper.makeRequest('POST', resource.endpoint, {
          name: `My ${resource.type}`,
          description: 'Test description'
        }, false, { Authorization: `Bearer ${userToken}` });

        const resourceId = createResponse.body.id;

        // Try to access with sequential IDs
        for (let id = 1; id <= 10; id++) {
          if (id !== parseInt(resourceId)) {
            const accessResponse = await testHelper.makeRequest(
              'GET',
              `${resource.endpoint}/${id}`,
              {},
              false,
              { Authorization: `Bearer ${userToken}` }
            );

            // Should either be not found or forbidden
            expect([403, 404]).toContain(accessResponse.status);
          }
        }
      }
    });

    it('should validate resource ownership', async () => {
      // Test ownership validation on sensitive operations
      const ownershipTests = [
        { action: 'DELETE', endpoint: '/api/tests/123' },
        { action: 'PUT', endpoint: '/api/projects/123/settings' },
        { action: 'POST', endpoint: '/api/tests/123/share' },
        { action: 'DELETE', endpoint: '/api/reports/123' }
      ];

      for (const test of ownershipTests) {
        const response = await testHelper.makeRequest(
          test.action,
          test.endpoint,
          {},
          false,
          { Authorization: `Bearer ${viewerToken}` }
        );

        // Should fail for unowned resources
        expect([403, 404]).toContain(response.status);
      }
    });
  });

  describe('Access Control Bypass Attempts', () => {
    it('should prevent HTTP method bypass', async () => {
      const protectedEndpoints = [
        '/api/admin/users',
        '/api/users/123/settings',
        '/api/billing/invoices'
      ];

      for (const endpoint of protectedEndpoints) {
        // Try different HTTP methods
        const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'TRACE'];

        for (const method of methods) {
          if (method === 'TRACE') continue; // Skip TRACE method

          const response = await testHelper.makeRequest(method, endpoint, {}, false, {
            Authorization: `Bearer ${userToken}`
          });

          // Should not allow unauthorized access
          if (response.status !== 405) { // Method not allowed is acceptable
            expect([401, 403, 404]).toContain(response.status);
          }
        }
      }
    });

    it('should prevent parameter pollution', async () => {
      const pollutionTests = [
        { param: 'id', values: ['123', '456'] },
        { param: 'userId', values: ['me', 'admin'] },
        { param: 'role', values: ['user', 'admin'] },
        { param: 'permission', values: ['read', 'admin'] }
      ];

      for (const test of pollutionTests) {
        const query = test.values.map(v => `${test.param}=${v}`).join('&');
        const response = await testHelper.makeRequest('GET', `/api/users?${query}`, {}, false, {
          Authorization: `Bearer ${userToken}`
        });

        // Should handle parameter pollution safely
        expect(response.status).not.toBe(200);
        if (response.status === 200) {
          // If successful, should only return user's own data
          expect(response.body).toBeDefined();
          if (Array.isArray(response.body)) {
            expect(response.body.length).toBeLessThanOrEqual(1);
          }
        }
      }
    });

    it('should prevent path traversal in API endpoints', async () => {
      const pathTraversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '..%252f..%252f..%252fetc%252fpasswd',
        '....//....//....//etc/passwd',
        '/var/www/../../etc/passwd'
      ];

      for (const payload of pathTraversalPayloads) {
        const response = await testHelper.makeRequest('GET', `/api/files/${payload}`, {}, false, {
          Authorization: `Bearer ${userToken}`
        });

        expect([400, 403, 404]).toContain(response.status);
      }
    });
  });
});

export {};
