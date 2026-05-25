/**
 * CSRF Protection and Security Headers Tests
 *
 * This test suite validates Cross-Site Request Forgery protection mechanisms
 * and the implementation of security headers.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { TestHelper } from '../utils/test-helper';

describe('CSRF Protection Tests', () => {
  let testHelper: TestHelper;
  let authToken: string;
  let csrfToken: string;

  beforeAll(async () => {
    testHelper = new TestHelper();
    await testHelper.setupTestEnvironment();

    const loginResponse = await testHelper.loginUser('test@example.com', 'SecurePass123!');
    authToken = loginResponse.body.token;
    csrfToken = loginResponse.body.csrfToken || await testHelper.getCSRFToken();
  });

  afterAll(async () => {
    await testHelper.cleanupTestEnvironment();
  });

  beforeEach(async () => {
    await testHelper.resetTestState();
  });

  describe('CSRF Token Validation', () => {
    it('should require CSRF token for state-changing operations', async () => {
      const stateChangingOperations = [
        { method: 'POST', path: '/api/projects', data: { name: 'Test Project' } },
        { method: 'PUT', path: '/api/profile', data: { displayName: 'Test User' } },
        { method: 'DELETE', path: '/api/projects/123' },
        { method: 'POST', path: '/api/payment/methods', data: { type: 'card' } },
        { method: 'POST', path: '/api/auth/change-password', data: { newPassword: 'NewPass123!' } }
      ];

      for (const operation of stateChangingOperations) {
        // Without CSRF token
        const responseWithoutToken = await testHelper.makeRequest(
          operation.method,
          operation.path,
          operation.data || {},
          true,
          {}
        );

        // Should reject without CSRF token
        expect([403, 400, 419]).toContain(responseWithoutToken.status);
        expect(responseWithoutToken.body.error).toMatch(/csrf|token/i);

        // With CSRF token
        const responseWithToken = await testHelper.makeRequest(
          operation.method,
          operation.path,
          operation.data || {},
          true,
          { 'X-CSRF-Token': csrfToken }
        );

        // Should accept with valid CSRF token
        expect([200, 201, 204, 400, 422]).toContain(responseWithToken.status);
        expect([403, 419]).not.toContain(responseWithToken.status);
      }
    });

    it('should validate CSRF token format', async () => {
      const invalidTokens = [
        '',
        'short',
        'invalid-token-format',
        'a'.repeat(1000), // Too long
        '<script>alert("XSS")</script>',
        '../../../etc/passwd',
        null,
        undefined
      ];

      for (const token of invalidTokens) {
        const response = await testHelper.makeRequest('POST', '/api/projects', {
          name: 'Test Project'
        }, true, {
          'X-CSRF-Token': token
        });

        // Should reject invalid tokens
        expect([400, 403, 419]).toContain(response.status);
      }
    });

    it('should reject CSRF token reuse', async () => {
      // Use CSRF token once
      const response1 = await testHelper.makeRequest('POST', '/api/projects', {
        name: 'Test Project 1'
      }, true, {
        'X-CSRF-Token': csrfToken
      });

      // Try to reuse the same token
      const response2 = await testHelper.makeRequest('POST', '/api/projects', {
        name: 'Test Project 2'
      }, true, {
        'X-CSRF-Token': csrfToken
      });

      // Should reject token reuse (if single-use tokens are implemented)
      if (response1.status === 200 || response1.status === 201) {
        expect([403, 419]).toContain(response2.status);
      }
    });

    it('should validate CSRF token expiration', async () => {
      // Create a CSRF token
      const tokenResponse = await testHelper.makeRequest('GET', '/api/auth/csrf-token', {}, true);
      const token = tokenResponse.body.token;

      // Simulate time passing
      await testHelper.simulateTimePassage(61 * 60 * 1000); // 61 minutes

      // Try to use expired token
      const response = await testHelper.makeRequest('POST', '/api/projects', {
        name: 'Test Project'
      }, true, {
        'X-CSRF-Token': token
      });

      // Should reject expired token
      expect([403, 419]).toContain(response.status);
      expect(response.body.error).toMatch(/expired|csrf/i);
    });

    it('should bind CSRF token to user session', async () => {
      // Get CSRF token for user1
      const user1Token = await testHelper.getCSRFToken();

      // Login as different user
      await testHelper.loginUser('user2@test.com', 'SecurePass123!');

      // Try to use user1's token as user2
      const response = await testHelper.makeRequest('POST', '/api/projects', {
        name: 'Test Project'
      }, true, {
        'X-CSRF-Token': user1Token
      });

      // Should reject token from different session
      expect([403, 419]).toContain(response.status);
    });

    it('should handle CSRF token in different locations', async () => {
      const token = await testHelper.getCSRFToken();
      const testData = { name: 'Test Project' };

      // Test in header
      const headerResponse = await testHelper.makeRequest('POST', '/api/projects', testData, true, {
        'X-CSRF-Token': token
      });
      expect([200, 201]).toContain(headerResponse.status);

      // Test in form data
      const formDataResponse = await testHelper.makeRequest('POST', '/api/projects', {
        ...testData,
        _csrf: token
      }, true);
      expect([200, 201]).toContain(formDataResponse.status);

      // Test in query parameter (should be rejected)
      const queryResponse = await testHelper.makeRequest('POST', `/api/projects?_csrf=${token}`, testData, true);
      expect([403, 419]).toContain(queryResponse.status);
    });
  });

  describe('SameSite Cookie Protection', () => {
    it('should set SameSite attribute on session cookies', async () => {
      const loginResponse = await testHelper.makeRequest('POST', '/api/auth/login', {
        username: 'test@example.com',
        password: 'SecurePass123!'
      });

      const setCookieHeader = loginResponse.headers['set-cookie'];
      expect(setCookieHeader).toBeDefined();
      expect(setCookieHeader).toMatch(/SameSite=(Strict|Lax)/i);
    });

    it('should use SameSite=Strict for sensitive cookies', async () => {
      const response = await testHelper.makeRequest('POST', '/api/auth/login', {
        username: 'test@example.com',
        password: 'SecurePass123!'
      });

      const cookies = response.headers['set-cookie'] || [];
      const sessionCookie = cookies.find(cookie =>
        cookie.includes('session') ||
        cookie.includes('token') ||
        cookie.includes('auth')
      );

      if (sessionCookie) {
        expect(sessionCookie).toMatch(/SameSite=Strict/i);
      }
    });

    it('should implement SameSite=Lax for general cookies', async () => {
      const response = await testHelper.makeRequest('GET', '/api/preferences', {}, true);

      const setCookieHeader = response.headers['set-cookie'];
      if (setCookieHeader) {
        expect(setCookieHeader).toMatch(/SameSite=Lax/i);
      }
    });
  });

  describe('Origin Validation', () => {
    it('should validate Origin header for state-changing operations', async () => {
      const maliciousOrigins = [
        'https://evil.com',
        'http://evil.com',
        'https://attacker.evil.com',
        'null',
        'javascript://evil.com'
      ];

      for (const origin of maliciousOrigins) {
        const response = await testHelper.makeRequest('POST', '/api/projects', {
          name: 'Test Project'
        }, true, {
          'Origin': origin,
          'X-CSRF-Token': await testHelper.getCSRFToken()
        });

        // Should reject malicious origins
        expect([400, 403, 419]).toContain(response.status);
      }
    });

    it('should validate Referer header when Origin is missing', async () => {
      const maliciousReferers = [
        'https://evil.com/attack.html',
        'http://evil.com/phishing.html',
        'data:text/html,<script>alert(1)</script>'
      ];

      for (const referer of maliciousReferers) {
        const response = await testHelper.makeRequest('POST', '/api/projects', {
          name: 'Test Project'
        }, true, {
          'Referer': referer,
          'X-CSRF-Token': await testHelper.getCSRFToken()
        });

        // Should reject malicious referers
        expect([400, 403, 419]).toContain(response.status);
      }
    });

    it('should allow same-origin requests', async () => {
      const sameOrigin = 'https://localhost:8000';

      const response = await testHelper.makeRequest('POST', '/api/projects', {
        name: 'Test Project'
      }, true, {
        'Origin': sameOrigin,
        'X-CSRF-Token': await testHelper.getCSRFToken()
      });

      // Should allow same-origin requests
      expect([200, 201]).toContain(response.status);
    });
  });

  describe('Double Submit Cookie Pattern', () => {
    it('should implement double submit cookie pattern', async () => {
      // Get CSRF token
      const tokenResponse = await testHelper.makeRequest('GET', '/api/auth/csrf-token', {}, true);
      const token = tokenResponse.body.token;

      // Should set CSRF cookie
      const setCookieHeader = tokenResponse.headers['set-cookie'];
      expect(setCookieHeader).toBeDefined();
      expect(setCookieHeader).toMatch(/csrf/i);

      // Cookie value should match token value
      const cookieValue = testHelper.extractCookieValue(setCookieHeader, 'csrf');
      expect(cookieValue).toBe(token);
    });

    it('should validate double submit cookie', async () => {
      const token = await testHelper.getCSRFToken();

      // Tamper with CSRF cookie
      testHelper.setCookie('csrf-token', 'tampered-value');

      // Request with valid header but tampered cookie
      const response = await testHelper.makeRequest('POST', '/api/projects', {
        name: 'Test Project'
      }, true, {
        'X-CSRF-Token': token
      });

      // Should reject mismatched token and cookie
      expect([403, 419]).toContain(response.status);
    });
  });
});

describe('Security Headers Tests', () => {
  let testHelper: TestHelper;

  beforeAll(async () => {
    testHelper = new TestHelper();
    await testHelper.setupTestEnvironment();
  });

  afterAll(async () => {
    await testHelper.cleanupTestEnvironment();
  });

  describe('Content Security Policy', () => {
    it('should implement Content-Security-Policy header', async () => {
      const response = await testHelper.makeRequest('GET', '/', {});

      const cspHeader = response.headers['content-security-policy'];
      expect(cspHeader).toBeDefined();
    });

    it('should restrict script sources', async () => {
      const response = await testHelper.makeRequest('GET', '/', {});

      const cspHeader = response.headers['content-security-policy'];
      if (cspHeader) {
        // Should not allow unsafe-inline scripts
        expect(cspHeader).not.toMatch(/script-src[^']*'unsafe-inline'/);

        // Should not allow unsafe-eval
        expect(cspHeader).not.toMatch(/script-src[^']*'unsafe-eval'/);

        // Should define allowed script sources
        expect(cspHeader).toMatch(/script-src\s+[^']+'self'/);
      }
    });

    it('should restrict object sources', async () => {
      const response = await testHelper.makeRequest('GET', '/', {});

      const cspHeader = response.headers['content-security-policy'];
      if (cspHeader) {
        // Should not allow plugins
        expect(cspHeader).toMatch(/object-src\s+'none'/);
      }
    });

    it('should enforce HTTPS', async () => {
      const response = await testHelper.makeRequest('GET', 'https://localhost/', {});

      const cspHeader = response.headers['content-security-policy'];
      if (cspHeader) {
        // Should upgrade HTTP to HTTPS
        expect(cspHeader).toMatch(/upgrade-insecure-requests/);
      }
    });

    it('should restrict frame ancestors', async () => {
      const response = await testHelper.makeRequest('GET', '/', {});

      const cspHeader = response.headers['content-security-policy'];
      if (cspHeader) {
        // Should prevent clickjacking
        expect(cspHeader).toMatch(/frame-ancestors\s+'self'/);
      }
    });

    it('should implement report-uri or report-to for CSP violations', async () => {
      const response = await testHelper.makeRequest('GET', '/', {});

      const cspHeader = response.headers['content-security-policy'];
      if (cspHeader) {
        // Should have reporting mechanism
        expect(cspHeader).toMatch(/report-to|report-uri/i);
      }
    });
  });

  describe('X-Frame-Options', () => {
    it('should set X-Frame-Options header', async () => {
      const response = await testHelper.makeRequest('GET', '/', {});

      const xFrameOptions = response.headers['x-frame-options'];
      expect(xFrameOptions).toBeDefined();
    });

    it('should use DENY or SAMEORIGIN', async () => {
      const response = await testHelper.makeRequest('GET', '/', {});

      const xFrameOptions = response.headers['x-frame-options'];
      expect(['DENY', 'SAMEORIGIN']).toContain(xFrameOptions);
    });

    it('should use DENY for sensitive pages', async () => {
      const response = await testHelper.makeRequest('GET', '/api/profile', {}, true);

      const xFrameOptions = response.headers['x-frame-options'];
      expect(xFrameOptions).toBe('DENY');
    });
  });

  describe('X-Content-Type-Options', () => {
    it('should set X-Content-Type-Options header', async () => {
      const response = await testHelper.makeRequest('GET', '/', {});

      const xContentTypeOptions = response.headers['x-content-type-options'];
      expect(xContentTypeOptions).toBe('nosniff');
    });
  });

  describe('X-XSS-Protection', () => {
    it('should set X-XSS-Protection header', async () => {
      const response = await testHelper.makeRequest('GET', '/', {});

      const xXssProtection = response.headers['x-xss-protection'];
      expect(xXssProtection).toBeDefined();
    });

    it('should enable XSS protection with block mode', async () => {
      const response = await testHelper.makeRequest('GET', '/', {});

      const xXssProtection = response.headers['x-xss-protection'];
      expect(xXssProtection).toBe('1; mode=block');
    });
  });

  describe('Strict-Transport-Security', () => {
    it('should set HSTS header on HTTPS responses', async () => {
      const response = await testHelper.makeRequest('GET', 'https://localhost/', {});

      const hstsHeader = response.headers['strict-transport-security'];
      expect(hstsHeader).toBeDefined();
    });

    it('should include max-age directive', async () => {
      const response = await testHelper.makeRequest('GET', 'https://localhost/', {});

      const hstsHeader = response.headers['strict-transport-security'];
      expect(hstsHeader).toMatch(/max-age=\d+/);

      const maxAge = parseInt(hstsHeader.match(/max-age=(\d+)/)?.[1] || '0');
      expect(maxAge).toBeGreaterThan(31536000); // At least 1 year
    });

    it('should include includeSubDomains directive', async () => {
      const response = await testHelper.makeRequest('GET', 'https://localhost/', {});

      const hstsHeader = response.headers['strict-transport-security'];
      expect(hstsHeader).toMatch(/includeSubDomains/);
    });

    it('should include preload directive for production', async () => {
      const response = await testHelper.makeRequest('GET', 'https://questro.com/', {});

      const hstsHeader = response.headers['strict-transport-security'];
      if (hstsHeader) {
        expect(hstsHeader).toMatch(/preload/);
      }
    });
  });

  describe('Referrer-Policy', () => {
    it('should set Referrer-Policy header', async () => {
      const response = await testHelper.makeRequest('GET', '/', {});

      const referrerPolicy = response.headers['referrer-policy'];
      expect(referrerPolicy).toBeDefined();
    });

    it('should use strict referrer policy', async () => {
      const response = await testHelper.makeRequest('GET', '/', {});

      const referrerPolicy = response.headers['referrer-policy'];
      const strictPolicies = [
        'strict-origin-when-cross-origin',
        'strict-origin',
        'no-referrer',
        'same-origin'
      ];

      expect(strictPolicies).toContain(referrerPolicy);
    });
  });

  describe('Permissions-Policy', () => {
    it('should set Permissions-Policy header', async () => {
      const response = await testHelper.makeRequest('GET', '/', {});

      const permissionsPolicy = response.headers['permissions-policy'];
      expect(permissionsPolicy).toBeDefined();
    });

    it('should disable dangerous features', async () => {
      const response = await testHelper.makeRequest('GET', '/', {});

      const permissionsPolicy = response.headers['permissions-policy'];
      if (permissionsPolicy) {
        // Should disable geolocation
        expect(permissionsPolicy).toMatch(/geography=\(\)/);

        // Should disable camera
        expect(permissionsPolicy).toMatch(/camera=\(\)/);

        // Should disable microphone
        expect(permissionsPolicy).toMatch(/microphone=\(\)/);

        // Should disable payment
        expect(permissionsPolicy).toMatch(/payment=\(\)/);
      }
    });
  });

  describe('Additional Security Headers', () => {
    it('should set Cache-Control for sensitive responses', async () => {
      const response = await testHelper.makeRequest('GET', '/api/profile', {}, true);

      const cacheControl = response.headers['cache-control'];
      expect(cacheControl).toBeDefined();
      expect(cacheControl).toMatch(/no-cache|no-store|private/i);
    });

    it('should set Pragma: no-cache for sensitive responses', async () => {
      const response = await testHelper.makeRequest('GET', '/api/profile', {}, true);

      const pragma = response.headers['pragma'];
      expect(pragma).toBe('no-cache');
    });

    it('should set Expires to past date for sensitive responses', async () => {
      const response = await testHelper.makeRequest('GET', '/api/profile', {}, true);

      const expires = response.headers['expires'];
      if (expires) {
        const expiresDate = new Date(expires);
        const now = new Date();
        expect(expiresDate.getTime()).toBeLessThan(now.getTime());
      }
    });

    it('should remove server header or use generic value', async () => {
      const response = await testHelper.makeRequest('GET', '/', {});

      const serverHeader = response.headers['server'];
      if (serverHeader) {
        // Should not reveal detailed server information
        expect(serverHeader).not.toMatch(/nginx\/[\d.]+/i);
        expect(serverHeader).not.toMatch(/Apache\/[\d.]+/i);
        expect(serverHeader).not.toMatch(/Express\/[\d.]+/i);
      }
    });

    it('should set X-Powered-By header removal', async () => {
      const response = await testHelper.makeRequest('GET', '/', {});

      const poweredBy = response.headers['x-powered-by'];
      expect(poweredBy).toBeUndefined();
    });
  });

  describe('Cross-Origin Headers', () => {
    it('should implement proper CORS headers', async () => {
      const response = await testHelper.makeRequest('OPTIONS', '/api/projects', {}, false, {
        'Origin': 'https://app.questro.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Authorization, Content-Type'
      });

      // Should set allowed origins
      const allowOrigin = response.headers['access-control-allow-origin'];
      expect(allowOrigin).toBeDefined();
      expect(allowOrigin).not.toBe('*');

      // Should set allowed methods
      const allowMethods = response.headers['access-control-allow-methods'];
      expect(allowMethods).toBeDefined();
      expect(allowMethods).toMatch(/GET|POST|PUT|DELETE/);

      // Should set allowed headers
      const allowHeaders = response.headers['access-control-allow-headers'];
      expect(allowHeaders).toBeDefined();

      // Should set max age
      const maxAge = response.headers['access-control-max-age'];
      expect(maxAge).toBeDefined();
      expect(parseInt(maxAge)).toBeGreaterThan(0);
    });

    it('should set Access-Control-Allow-Credentials appropriately', async () => {
      const response = await testHelper.makeRequest('OPTIONS', '/api/projects', {}, false, {
        'Origin': 'https://app.questro.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Authorization'
      });

      const allowCredentials = response.headers['access-control-allow-credentials'];
      if (allowOrigin !== '*') {
        expect(allowCredentials).toBe('true');
      }
    });

    it('should set Access-Control-Expose-Headers for safe headers', async () => {
      const response = await testHelper.makeRequest('GET', '/api/projects', {}, true);

      const exposeHeaders = response.headers['access-control-expose-headers'];
      if (exposeHeaders) {
        // Should not expose sensitive headers
        expect(exposeHeaders).not.toMatch(/set-cookie/i);
        expect(exposeHeaders).not.toMatch(/x-api-key/i);
      }
    });
  });
});

export {};
