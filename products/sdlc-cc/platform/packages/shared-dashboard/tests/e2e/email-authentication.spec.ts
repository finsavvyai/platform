import { test, expect } from '@playwright/test';

/**
 * Email Authentication Tests
 * Tests registration, login, email verification, and password reset
 */

test.describe('User Registration', () => {

  test('Can register with valid email and password', async ({ request }) => {
    const email = `test-${Date.now()}@example.com`;
    const password = 'TestPassword123!';
    const name = 'Test User';

    const response = await request.post('/api/v1/auth/register', {
      data: {
        email,
        password,
        name
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.token).toBeTruthy();
    expect(data.user.email).toBe(email);
    expect(data.user.name).toBe(name);
    expect(data.user.role).toBe('user');
  });

  test('Cannot register with existing email', async ({ request }) => {
    const email = `duplicate-${Date.now()}@example.com`;
    const password = 'TestPassword123!';

    // Register first time
    await request.post('/api/v1/auth/register', {
      data: {
        email,
        password,
        name: 'First User'
      }
    });

    // Try to register again with same email
    const response = await request.post('/api/v1/auth/register', {
      data: {
        email,
        password,
        name: 'Second User'
      }
    });

    expect(response.status()).toBe(409);
    const data = await response.json();
    expect(data.error).toBe('User already exists');
  });

  test('Cannot register with weak password', async ({ request }) => {
    const response = await request.post('/api/v1/auth/register', {
      data: {
        email: `test-${Date.now()}@example.com`,
        password: 'short',
        name: 'Test User'
      }
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Weak password');
    expect(data.message).toContain('at least 8 characters');
  });

  test('Cannot register without required fields', async ({ request }) => {
    const response = await request.post('/api/v1/auth/register', {
      data: {
        email: `test-${Date.now()}@example.com`
        // Missing password and name
      }
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid request');
  });
});

test.describe('User Login', () => {

  test('Can login with valid credentials', async ({ request }) => {
    const email = `login-${Date.now()}@example.com`;
    const password = 'TestPassword123!';

    // Register user first
    await request.post('/api/v1/auth/register', {
      data: {
        email,
        password,
        name: 'Login Test User'
      }
    });

    // Login
    const response = await request.post('/api/v1/auth/login', {
      data: {
        email,
        password
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.token).toBeTruthy();
    expect(data.user.email).toBe(email);
  });

  test('Cannot login with wrong password', async ({ request }) => {
    const email = `wrongpass-${Date.now()}@example.com`;
    const password = 'CorrectPassword123!';

    // Register user
    await request.post('/api/v1/auth/register', {
      data: {
        email,
        password,
        name: 'Test User'
      }
    });

    // Try to login with wrong password
    const response = await request.post('/api/v1/auth/login', {
      data: {
        email,
        password: 'WrongPassword123!'
      }
    });

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Invalid credentials');
  });

  test('Cannot login with non-existent email', async ({ request }) => {
    const response = await request.post('/api/v1/auth/login', {
      data: {
        email: 'nonexistent@example.com',
        password: 'AnyPassword123!'
      }
    });

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Invalid credentials');
  });
});

test.describe('Email Verification', () => {

  test('Can request email verification', async ({ request }) => {
    const email = `verify-${Date.now()}@example.com`;
    const password = 'TestPassword123!';

    // Register user
    const registerResponse = await request.post('/api/v1/auth/register', {
      data: {
        email,
        password,
        name: 'Verification Test'
      }
    });

    const { token } = await registerResponse.json();

    // Request verification email
    const response = await request.post('/api/v1/auth/send-verification-email', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.verificationToken).toBeTruthy();
    expect(data.verifyUrl).toContain('/auth/verify-email?token=');
  });

  test('Can verify email with valid token', async ({ request }) => {
    const email = `verify2-${Date.now()}@example.com`;
    const password = 'TestPassword123!';

    // Register user
    const registerResponse = await request.post('/api/v1/auth/register', {
      data: {
        email,
        password,
        name: 'Verification Test'
      }
    });

    const { token } = await registerResponse.json();

    // Request verification email
    const verifyRequestResponse = await request.post('/api/v1/auth/send-verification-email', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const { verificationToken } = await verifyRequestResponse.json();

    // Verify email
    const response = await request.get(`/api/v1/auth/verify-email?token=${verificationToken}`);

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.message).toContain('verified successfully');
  });

  test('Cannot verify with invalid token', async ({ request }) => {
    const response = await request.get('/api/v1/auth/verify-email?token=invalid-token');

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid token');
  });

  test('Cannot use verification token twice', async ({ request }) => {
    const email = `verify3-${Date.now()}@example.com`;
    const password = 'TestPassword123!';

    // Register user
    const registerResponse = await request.post('/api/v1/auth/register', {
      data: {
        email,
        password,
        name: 'Test User'
      }
    });

    const { token } = await registerResponse.json();

    // Request verification
    const verifyRequestResponse = await request.post('/api/v1/auth/send-verification-email', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const { verificationToken } = await verifyRequestResponse.json();

    // Use token first time
    await request.get(`/api/v1/auth/verify-email?token=${verificationToken}`);

    // Try to use token second time
    const response = await request.get(`/api/v1/auth/verify-email?token=${verificationToken}`);

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid token');
  });
});

test.describe('Password Reset', () => {

  test('Can request password reset', async ({ request }) => {
    const email = `reset-${Date.now()}@example.com`;
    const password = 'OldPassword123!';

    // Register user
    await request.post('/api/v1/auth/register', {
      data: {
        email,
        password,
        name: 'Reset Test'
      }
    });

    // Request password reset
    const response = await request.post('/api/v1/auth/request-password-reset', {
      data: {
        email
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.resetToken).toBeTruthy();
    expect(data.resetUrl).toContain('/auth/reset-password?token=');
  });

  test('Can reset password with valid token', async ({ request }) => {
    const email = `reset2-${Date.now()}@example.com`;
    const oldPassword = 'OldPassword123!';
    const newPassword = 'NewPassword123!';

    // Register user
    await request.post('/api/v1/auth/register', {
      data: {
        email,
        password: oldPassword,
        name: 'Reset Test'
      }
    });

    // Request password reset
    const resetRequestResponse = await request.post('/api/v1/auth/request-password-reset', {
      data: {
        email
      }
    });

    const { resetToken } = await resetRequestResponse.json();

    // Reset password
    const response = await request.post('/api/v1/auth/reset-password', {
      data: {
        token: resetToken,
        newPassword
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.message).toContain('reset successfully');

    // Verify can login with new password
    const loginResponse = await request.post('/api/v1/auth/login', {
      data: {
        email,
        password: newPassword
      }
    });

    expect(loginResponse.ok()).toBeTruthy();
  });

  test('Cannot reset password with invalid token', async ({ request }) => {
    const response = await request.post('/api/v1/auth/reset-password', {
      data: {
        token: 'invalid-token',
        newPassword: 'NewPassword123!'
      }
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid token');
  });

  test('Cannot reset password with weak password', async ({ request }) => {
    const email = `reset3-${Date.now()}@example.com`;

    // Register user
    await request.post('/api/v1/auth/register', {
      data: {
        email,
        password: 'OldPassword123!',
        name: 'Test User'
      }
    });

    // Request reset
    const resetRequestResponse = await request.post('/api/v1/auth/request-password-reset', {
      data: {
        email
      }
    });

    const { resetToken } = await resetRequestResponse.json();

    // Try to reset with weak password
    const response = await request.post('/api/v1/auth/reset-password', {
      data: {
        token: resetToken,
        newPassword: 'short'
      }
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Weak password');
  });

  test('Password reset request does not reveal if email exists', async ({ request }) => {
    // Request reset for non-existent email
    const response = await request.post('/api/v1/auth/request-password-reset', {
      data: {
        email: 'nonexistent@example.com'
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // Should return success even if email doesn't exist (security best practice)
    expect(data.success).toBe(true);
    expect(data.message).toContain('If an account with that email exists');
  });
});

test.describe('Authenticated Endpoints', () => {

  test('Can access /me endpoint with valid token', async ({ request }) => {
    const email = `me-${Date.now()}@example.com`;
    const password = 'TestPassword123!';

    // Register user
    const registerResponse = await request.post('/api/v1/auth/register', {
      data: {
        email,
        password,
        name: 'Me Test User'
      }
    });

    const { token } = await registerResponse.json();

    // Access /me endpoint
    const response = await request.get('/api/v1/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.user.email).toBe(email);
    expect(data.user.name).toBe('Me Test User');
  });

  test('Cannot access /me without token', async ({ request }) => {
    const response = await request.get('/api/v1/auth/me');

    expect(response.status()).toBe(401);
  });

  test('Cannot access /me with invalid token', async ({ request }) => {
    const response = await request.get('/api/v1/auth/me', {
      headers: {
        Authorization: 'Bearer invalid-token'
      }
    });

    expect(response.status()).toBe(401);
  });
});
