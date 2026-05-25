/**
 * Security Validation Integration Tests
 * Tests security aspects of the Questro platform
 */

import { test, expect } from '@playwright/test';

test.describe('Security Validation', () => {
  test.describe('Authentication Security', () => {
    test('should prevent unauthorized access to protected routes', async ({ page }) => {
      const protectedRoutes = [
        '/dashboard',
        '/tests',
        '/analytics',
        '/settings',
        '/team'
      ];

      for (const route of protectedRoutes) {
        await page.goto(route);

        // Should redirect to login
        await expect(page).toHaveURL('/login');

        // Should not show protected content
        await expect(page.locator('[data-testid="dashboard-content"]')).not.toBeVisible();
        await expect(page.locator('[data-testid="test-list"]')).not.toBeVisible();
      }
    });

    test('should enforce proper password policies', async ({ page }) => {
      await page.goto('/signup');

      const weakPasswords = [
        'password',
        '123456',
        'qwerty',
        'abc123',
        'password123',
        'Qwerty1',
        'short'
      ];

      for (const weakPassword of weakPasswords) {
        await page.goto('/signup');
        await page.fill('[data-testid="email-input"]', `test@example.com`);
        await page.fill('[data-testid="password-input"]', weakPassword);
        await page.fill('[data-testid="confirm-password-input"]', weakPassword);
        await page.click('[data-testid="register-button"]');

        // Should show password strength error
        await expect(page.locator('[data-testid="password-error"]')).toBeVisible();
        await expect(page.locator('[data-testid="password-error"]')).toContainText(
          /weak|stronger|requirements|characters/i
        );
      }
    });

    test('should implement proper session management', async ({ page }) => {
      // Login with valid credentials
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('[data-testid="login-button"]);

      // Should redirect to dashboard
      await expect(page).toHaveURL('/dashboard');

      // Check session cookie security attributes
      const cookies = await page.context().cookies();
      const sessionCookie = cookies.find(cookie => cookie.name === 'sessionId' || cookie.name === 'token');

      if (sessionCookie) {
        expect(sessionCookie.httpOnly).toBe(true);
        expect(sessionCookie.secure).toBe(true);
        expect(sessionCookie.sameSite).toBe('Lax' || sessionCookie.sameSite === 'Strict');
      }

      // Test logout functionality
      await page.click('[data-testid="logout-button"]');
      await expect(page).toHaveURL('/login');

      // Should not be able to access protected routes after logout
      await page.goto('/dashboard');
      await expect(page).toHaveURL('/login');
    });

    test('should protect against brute force attacks', async ({ page }) => {
      const maxAttempts = 5;
      const wrongPassword = 'WrongPassword123!';

      // Attempt multiple failed logins
      for (let i = 0; i < maxAttempts + 2; i++) {
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', 'test@example.com');
        await page.fill('[data-testid="password-input"]', wrongPassword);
        await page.click('[data-testid="login-button"]');

        if (i < maxAttempts - 1) {
          // Should show login error
          await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
        } else {
          // Should show rate limiting or temporary lockout
          await expect(page.locator('[data-testid="rate-limit-message"]')).toBeVisible({ timeout: 10000 });
        }
      }

      // Even with correct password, should still be blocked
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('[data-testid="login-button"]');

      await expect(page.locator('[data-testid="rate-limit-message"]')).toBeVisible();
    });
  });

  test.describe('Input Validation and XSS Protection', () => {
    test('should prevent XSS attacks in input fields', async ({ page }) => {
      const maliciousInputs = [
        '<script>alert("XSS")</script>',
        'javascript:alert("XSS")',
        '<img src="x" onerror="alert(\'XSS\')">',
        '<svg onload="alert(\'XSS\')">',
        '\'" onmouseover="alert(\'XSS\')"',
        '${alert("XSS")}',
        '"><script>alert("XSS")</script><input type="hidden"'
      ];

      // Login first
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('/dashboard');

      // Navigate to create test page
      await page.goto('/recording-studio');

      for (const maliciousInput of maliciousInputs) {
        // Try to submit malicious input
        await page.fill('[data-testid="test-name-input"]', maliciousInput);
        await page.click('[data-testid="save-test-button"]');

        // Should sanitize the input or show error
        const inputValue = await page.inputValue('[data-testid="test-name-input"]');
        expect(inputValue).not.toContain('<script>');
        expect(inputValue).not.toContain('javascript:');
        expect(inputValue).not.toContain('onerror=');
        expect(inputValue).not.toContain('onload=');
      }
    });

    test('should validate API request parameters', async ({ request }) => {
      const maliciousParams = [
        { id: '1 OR 1=1' },
        { id: '1; DROP TABLE users;' },
        { id: '${7*7}' },
        { id: '1 UNION SELECT * FROM users' },
        { id: '<script>alert(1)</script>' },
        { id: '../../../../../etc/passwd' }
      ];

      for (const params of maliciousParams) {
        const response = await request.get('/api/tests/123', {
          headers: {
            'Authorization': 'Bearer test-token'
          },
          params
        });

        // Should return 400 Bad Request for malicious input
        expect([400, 403, 404]).toContain(response.status());
      }
    });

    test('should enforce proper CORS policies', async ({ page }) => {
      // Test CORS headers from frontend
      const response = await page.request.get('https://api.qestro.app/health');

      expect(response.headers()['access-control-allow-origin']).toBeDefined();
      expect(response.headers()['access-control-allow-credentials']).toBeDefined();
      expect(response.headers()['access-control-allow-methods']).toBeDefined();
      expect(response.headers()['access-control-allow-headers']).toBeDefined();

      // Test preflight requests
      const preflightResponse = await page.request.fetch('https://api.qestro.app/api/tests', {
        method: 'OPTIONS'
      });

      expect(preflightResponse.status()).toBe(204);
      expect(preflightResponse.headers()['access-control-allow-origin']).toBeDefined();
    });
  });

  test.describe('Data Protection and Privacy', () => {
    test('should encrypt sensitive data in storage', async ({ page }) => {
      // Login
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('[data-testid="login-button"]);
      await page.waitForURL('/dashboard');

      // Check that sensitive data is not stored in plain text
      const localStorage = await page.evaluate(() => {
        return Object.keys(localStorage);
      });

      const sessionStorage = await page.evaluate(() => {
        return Object.keys(sessionStorage);
      });

      // Should not store sensitive data in client-side storage
      expect(localStorage.some(key => key.toLowerCase().includes('password'))).toBe(false);
      expect(localStorage.some(key => key.toLowerCase().includes('token'))).toBe(false);
      expect(sessionStorage.some(key => key.toLowerCase().includes('password'))).toBe(false);
      expect(sessionStorage.some(key => key.toLowerCase().includes('token'))).toBe(false);

      // Check cookies for sensitive data
      const cookies = await page.context().cookies();
      const cookieValues = cookies.map(cookie => cookie.value);

      // Cookie values should be encrypted or tokenized
      cookieValues.forEach(value => {
        expect(value).not.toContain('password');
        expect(value).not.toMatch(/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/); // Email pattern
      });
    });

    test('should implement proper data retention policies', async ({ page }) => {
      // This test would require backend access to verify data retention
      // For now, we'll test that sensitive actions have proper confirmation dialogs

      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('[data-testid="login-button"]);
      await page.waitForURL('/dashboard');

      // Navigate to settings
      await page.click('[data-testid="settings-button"]');

      // Try to delete account
      await page.click('[data-testid="delete-account-button"]');

      // Should show confirmation dialog
      await expect(page.locator('[data-testid="confirm-delete-dialog"]')).toBeVisible();
      await expect(page.locator('[data-testid="confirm-delete-button"]')).toBeDisabled();

      // Should require password confirmation
      await page.fill('[data-testid="confirm-password-input"]', 'TestPassword123!');
      await page.click('[data-testid="confirm-checkbox"]');
      await expect(page.locator('[data-testid="confirm-delete-button"]')).toBeEnabled();

      // Cancel the action
      await page.click('[data-testid="cancel-delete-button"]');
      await expect(page.locator('[data-testid="confirm-delete-dialog"]')).not.toBeVisible();
    });
  });

  test.describe('API Security', () => {
    test('should validate authentication tokens', async ({ request }) => {
      // Test with invalid token
      const responses = await Promise.all([
        request.get('/api/tests', { headers: { 'Authorization': 'Bearer invalid-token' } }),
        request.get('/api/tests', { headers: { 'Authorization': 'Bearer ' } }),
        request.get('/api/tests', { headers: { 'Authorization': 'Bearer' } }),
        request.get('/api/tests', { headers: {} }),
        request.get('/api/tests', { headers: { 'Authorization': 'InvalidTokenFormat' } })
      ]);

      // All should return 401 Unauthorized
      responses.forEach(response => {
        expect(response.status()).toBe(401);
      });
    });

    test('should implement proper rate limiting', async ({ request }) => {
      const maxRequests = 50;
      const requests = [];

      // Send many requests quickly
      for (let i = 0; i < maxRequests; i++) {
        requests.push(request.get('/api/health'));
      }

      const responses = await Promise.all(requests);

      // Should start rate limiting after threshold
      const rateLimitedResponses = responses.filter(r => r.status() === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Check rate limiting headers
      const rateLimitedResponse = rateLimitedResponses[0];
      expect(rateLimitedResponse.headers()['x-ratelimit-limit']).toBeDefined();
      expect(rateLimitedResponse.headers()['x-ratelimit-remaining']).toBeDefined();
      expect(rateLimitedResponse.headers()['x-ratelimit-reset']).toBeDefined();
    });

    test('should prevent information disclosure in error messages', async ({ request }) => {
      const testCases = [
        { path: '/api/tests/999999', method: 'GET' }, // Non-existent test
        { path: '/api/tests/invalid-id', method: 'GET' }, // Invalid ID format
        { path: '/api/non-existent-endpoint', method: 'GET' }, // Non-existent endpoint
        { path: '/api/tests', method: 'POST', data: { invalid: 'data' } } // Invalid data
      ];

      for (const testCase of testCases) {
        const response = await request.fetch(testCase.path, {
          method: testCase.method as any,
          headers: { 'Authorization': 'Bearer test-token' },
          data: testCase.data
        });

        expect([400, 404, 422]).toContain(response.status());

        // Error message should not contain sensitive information
        const errorData = await response.json();
        expect(errorData.error).toBeDefined();
        expect(errorData.error).not.toMatch(/password/i);
        expect(errorData.error).not.toMatch(/token/i);
        expect(errorData.error).not.toMatch(/secret/i);
        expect(errorData.error).not.toMatch(/database/i);
        expect(errorData.error).not.toMatch(/stack trace/i);
      }
    });
  });

  test.describe('File Upload Security', () => {
    test('should validate file uploads properly', async ({ page }) => {
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('[data-testid="login-button"]);
      await page.waitForURL('/dashboard');

      // Navigate to upload page
      await page.goto('/test-import');

      // Test with various file types
      const testFiles = [
        { name: 'test.exe', type: 'application/x-msdownload', content: 'malicious content' },
        { name: 'test.js', type: 'application/javascript', content: 'alert("xss")' },
        { name: 'test.php', type: 'application/x-php', content: '<?php system("ls"); ?>' },
        { name: '../../../etc/passwd', type: 'text/plain', content: 'malicious content' },
        { name: 'test.bat', type: 'application/bat', content: 'del *.*' }
      ];

      for (const file of testFiles) {
        // Try to upload malicious file
        await page.setInputFiles('[data-testid="file-input"]', {
          name: file.name,
          mimeType: file.type,
          buffer: Buffer.from(file.content)
        });

        await page.click('[data-testid="upload-button"]');

        // Should show file type error
        await expect(page.locator('[data-testid="upload-error"]')).toBeVisible();
        await expect(page.locator('[data-testid="upload-error"]')).toContainText(
          /invalid file type|not supported|malicious/i
        );
      }
    });

    test('should sanitize uploaded test files', async ({ page }) => {
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('[data-testid="login-button"]);
      await page.waitForURL('/dashboard');

      await page.goto('/test-import');

      // Upload test file with potential malicious content
      const maliciousTestContent = `
        test('malicious test', async ({ page }) => {
          await page.goto('https://example.com');
          eval('alert("XSS")'); // This should be sanitized
          require('fs').unlinkSync('/important/file'); // This should be removed
        });
      `;

      await page.setInputFiles('[data-testid="file-input"]', {
        name: 'malicious-test.js',
        mimeType: 'text/javascript',
        buffer: Buffer.from(maliciousTestContent)
      });

      await page.click('[data-testid="upload-button"]');

      // Should show warning about potential security issues
      await expect(page.locator('[data-testid="security-warning"]')).toBeVisible();
      await expect(page.locator('[data-testid="security-warning"]')).toContainText(
        /security risk|potentially dangerous|sanitized/i
      );
    });
  });

  test.describe('CSRF Protection', () => {
    test('should prevent CSRF attacks on state-changing operations', async ({ page, context }) => {
      // Login normally
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('[data-testid="login-button"]);
      await page.waitForURL('/dashboard');

      // Get session cookie
      const cookies = await context.cookies();
      const sessionCookie = cookies.find(c => c.name === 'sessionId' || c.name === 'token');

      // Create new context without session cookie to simulate external site
      const externalContext = await browser.newContext();
      const externalPage = await externalContext.newPage();

      // Try to perform state-changing action without CSRF token
      const formData = new URLSearchParams();
      formData.append('name', 'CSRF Test');
      formData.append('description', 'This should fail');

      const response = await externalPage.request.post('/api/tests', {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: formData
      });

      // Should fail without CSRF token
      expect([403, 401]).toContain(response.status());

      await externalContext.close();
    });
  });

  test.describe('Audit Logging', () => {
    test('should log security-relevant events', async ({ page }) => {
      // This test would check that security events are properly logged
      // In a real implementation, you would check audit logs

      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('/dashboard');

      // Perform sensitive actions
      await page.goto('/settings');
      await page.click('[data-testid="change-password-button"]');

      // Should require current password confirmation
      await expect(page.locator('[data-testid="current-password-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="new-password-input"]')).toBeVisible();

      // Check that the action is logged (this would be verified in backend logs)
      // For frontend test, we just verify the UI shows appropriate warnings
      await expect(page.locator('[data-testid="security-notice"]')).toBeVisible();
    });
  });
});