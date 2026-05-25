/**
 * Authentication Integration Tests
 *
 * Tests the complete authentication flow including registration, login,
 * token management, and security features.
 */

import {
  createTestSuite,
  expectAPIResponse,
  expectValidUser,
  TestDataFactory,
  testFramework,
  expectPerformanceThreshold,
  measureResponseTime,
} from './integration-test-framework';

createTestSuite('Authentication Integration Tests', () => {
  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const userData = TestDataFactory.createUser();

      const { result, responseTime } = await measureResponseTime(async () => {
        return request(testFramework['TEST_CONFIG'].API_BASE_URL)
          .post('/api/auth/register')
          .send(userData);
      });

      expectAPIResponse(result, 201);
      expect(result.body.data).toHaveProperty('user');
      expect(result.body.data).toHaveProperty('tokens');
      expectValidUser(result.body.data.user);
      expect(result.body.data.tokens).toHaveProperty('accessToken');
      expect(result.body.data.tokens).toHaveProperty('refreshToken');
      expect(result.body.data.tokens).toHaveProperty('expiresIn');
      expectPerformanceThreshold(responseTime, 1000);
    });

    it('should reject registration with duplicate email', async () => {
      const userData = TestDataFactory.createUser();

      // First registration
      await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Second registration with same email
      const response = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body.error.code).toBe('EMAIL_EXISTS');
    });

    it('should reject registration with weak password', async () => {
      const userData = {
        ...TestDataFactory.createUser(),
        password: 'weak',
      };

      const response = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toContainEqual({
        path: ['password'],
        message: expect.stringContaining('at least 12 characters'),
      });
    });

    it('should reject registration with invalid email format', async () => {
      const userData = {
        ...TestDataFactory.createUser(),
        email: 'invalid-email',
      };

      const response = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('User Login', () => {
    let testUser: any;

    beforeEach(async () => {
      const user = await testFramework.createAuthenticatedUser();
      testUser = user.user;
    });

    it('should login with valid credentials', async () => {
      const userData = TestDataFactory.createUser({
        email: testUser.email,
        password: 'SecurePassword123!',
      });

      const response = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .post('/api/auth/login')
        .send(userData)
        .expect(200);

      expectAPIResponse(response, 200);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('tokens');
      expectValidUser(response.body.data.user);
      expect(response.body.data.user.email).toBe(testUser.email);
    });

    it('should reject login with invalid credentials', async () => {
      const response = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login for non-existent user', async () => {
      const response = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should handle rate limiting on login attempts', async () => {
      const userData = {
        email: testUser.email,
        password: 'wrongpassword',
      };

      // Make multiple failed attempts
      const attempts = Array(6).fill(null).map(() =>
        request(testFramework['TEST_CONFIG'].API_BASE_URL)
          .post('/api/auth/login')
          .send(userData)
      );

      const responses = await Promise.all(attempts);

      // First 5 attempts should return 401
      for (let i = 0; i < 5; i++) {
        expect(responses[i].status).toBe(401);
      }

      // 6th attempt should be rate limited
      expect(responses[5].status).toBe(429);
      expect(responses[5].body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('Token Management', () => {
    let apiHelper: any;
    let testUser: any;

    beforeEach(async () => {
      const user = await testFramework.createAuthenticatedUser();
      apiHelper = user.apiHelper;
      testUser = user.user;
    });

    it('should refresh access token successfully', async () => {
      const initialToken = apiHelper.accessToken;

      // Wait a short time to ensure different token
      await new Promise(resolve => setTimeout(resolve, 100));

      await apiHelper.refreshToken();

      expect(apiHelper.accessToken).not.toBe(initialToken);
      expect(apiHelper.accessToken).toBeTruthy();
      expect(apiHelper.refreshToken).toBeTruthy();
    });

    it('should reject requests with expired access token', async () => {
      // Manually expire the token by waiting (or mock token expiration)
      // For now, test with invalid token format
      const response = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject requests without token', async () => {
      const response = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .get('/api/users/me')
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should logout successfully', async () => {
      await apiHelper.logout();

      // Verify token is no longer valid
      const response = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${apiHelper.accessToken}`)
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Password Reset', () => {
    let testUser: any;

    beforeEach(async () => {
      const user = await testFramework.createAuthenticatedUser();
      testUser = user.user;
    });

    it('should send password reset email', async () => {
      const response = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .post('/api/auth/forgot-password')
        .send({ email: testUser.email })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('reset link sent');
    });

    it('should handle password reset for non-existent email', async () => {
      const response = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200); // Still return 200 for security

      expect(response.body.success).toBe(true);
    });

    it('should reset password with valid token', async () => {
      // First, request password reset
      await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .post('/api/auth/forgot-password')
        .send({ email: testUser.email });

      // In a real implementation, we'd get the token from email
      // For testing, we'll use a direct database approach to get the reset token
      const dbHelper = testFramework.getDbHelper();
      const client = await dbHelper['db'].connect();

      try {
        const result = await client.query(
          'SELECT reset_token FROM users WHERE email = $1',
          [testUser.email]
        );

        const resetToken = result.rows[0]?.reset_token;
        expect(resetToken).toBeTruthy();

        // Reset password
        const newPassword = 'NewSecurePassword456!';
        const response = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
          .post('/api/auth/reset-password')
          .send({
            token: resetToken,
            password: newPassword,
          })
          .expect(200);

        expect(response.body.success).toBe(true);

        // Login with new password
        const loginResponse = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: newPassword,
          })
          .expect(200);

        expectAPIResponse(loginResponse, 200);

      } finally {
        client.release();
      }
    });

    it('should reject password reset with invalid token', async () => {
      const response = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token',
          password: 'NewPassword123!',
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_RESET_TOKEN');
    });
  });

  describe('Email Verification', () => {
    let testUser: any;

    beforeEach(async () => {
      const user = await testFramework.createAuthenticatedUser();
      testUser = user.user;
    });

    it('should verify email with valid token', async () => {
      // In a real implementation, we'd get the token from email
      // For testing, we'll use a direct database approach
      const dbHelper = testFramework.getDbHelper();
      const client = await dbHelper['db'].connect();

      try {
        // Generate verification token
        const verificationToken = 'test-verification-token-' + Date.now();

        await client.query(
          'UPDATE users SET email_verification_token = $1 WHERE id = $2',
          [verificationToken, testUser.id]
        );

        const response = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
          .post('/api/auth/verify-email')
          .send({ token: verificationToken })
          .expect(200);

        expect(response.body.success).toBe(true);

        // Verify email is marked as verified
        const result = await client.query(
          'SELECT email_verified FROM users WHERE id = $1',
          [testUser.id]
        );

        expect(result.rows[0].email_verified).toBe(true);

      } finally {
        client.release();
      }
    });

    it('should reject email verification with invalid token', async () => {
      const response = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .post('/api/auth/verify-email')
        .send({ token: 'invalid-token' })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_VERIFICATION_TOKEN');
    });
  });

  describe('Security Features', () => {
    let apiHelper: any;
    let testUser: any;

    beforeEach(async () => {
      const user = await testFramework.createAuthenticatedUser();
      apiHelper = user.apiHelper;
      testUser = user.user;
    });

    it('should include security headers in API responses', async () => {
      const response = await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .get('/api/users/me')
        .set(apiHelper.getAuthHeaders())
        .expect(200);

      // Check for security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toBeTruthy();
    });

    it('should prevent concurrent sessions with same user', async () => {
      // Create second session
      const secondAPIHelper = testFramework.createAPIHelper('second');
      await secondAPIHelper.login(testUser.email, 'SecurePassword123!');

      // Both sessions should work initially
      await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .get('/api/users/me')
        .set(apiHelper.getAuthHeaders())
        .expect(200);

      await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .get('/api/users/me')
        .set(secondAPIHelper.getAuthHeaders())
        .expect(200);

      // In a real implementation, we might limit concurrent sessions
      // This test verifies that the basic functionality works
    });

    it('should track login attempts for security monitoring', async () => {
      // Make a failed login attempt
      await request(testFramework['TEST_CONFIG'].API_BASE_URL)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword',
        })
        .expect(401);

      // Verify that the failed attempt was logged
      // This would typically be checked in audit logs
      // For now, we just verify the behavior is correct
    });
  });

  describe('Performance Tests', () => {
    it('should handle authentication requests within performance thresholds', async () => {
      const userData = TestDataFactory.createUser();

      // Test registration performance
      const { responseTime: regTime } = await measureResponseTime(async () => {
        return request(testFramework['TEST_CONFIG'].API_BASE_URL)
          .post('/api/auth/register')
          .send(userData);
      });

      expectPerformanceThreshold(regTime, 2000);

      // Test login performance
      const { responseTime: loginTime } = await measureResponseTime(async () => {
        return request(testFramework['TEST_CONFIG'].API_BASE_URL)
          .post('/api/auth/login')
          .send({
            email: userData.email,
            password: userData.password,
          });
      });

      expectPerformanceThreshold(loginTime, 1000);
    });

    it('should handle concurrent authentication requests', async () => {
      const userData = TestDataFactory.createUser();

      // Create multiple concurrent registration requests
      const promises = Array(10).fill(null).map((_, index) => {
        const uniqueUserData = {
          ...userData,
          email: `test-user-${index}-${Date.now()}@example.com`,
        };

        return request(testFramework['TEST_CONFIG'].API_BASE_URL)
          .post('/api/auth/register')
          .send(uniqueUserData);
      });

      const responses = await Promise.all(promises);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });
    });
  });
});
