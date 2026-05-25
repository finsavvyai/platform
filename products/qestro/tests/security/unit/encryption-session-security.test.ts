/**
 * Data Encryption and Session Management Security Tests
 *
 * This test suite validates encryption mechanisms, secure communication,
 * session management, and token security.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { TestHelper } from '../utils/test-helper';

describe('Data Encryption Security Tests', () => {
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

  describe('TLS/SSL Configuration', () => {
    it('should enforce HTTPS in production', async () => {
      // Test HTTP to HTTPS redirection
      const httpResponse = await testHelper.makeRequest('GET', 'http://localhost/api/profile', {}, true);

      // Should redirect to HTTPS or reject
      expect([301, 302, 307, 308, 400, 403]).toContain(httpResponse.status);

      if ([301, 302, 307, 308].includes(httpResponse.status)) {
        expect(httpResponse.headers.location).toMatch(/^https:\/\//);
      }
    });

    it('should use strong TLS protocols', async () => {
      const tlsConfig = await testHelper.checkTLSConfiguration();

      // Should not allow weak protocols
      expect(tlsConfig.protocols).not.toContain('SSLv2');
      expect(tlsConfig.protocols).not.toContain('SSLv3');
      expect(tlsConfig.protocols).not.toContain('TLSv1.0');
      expect(tlsConfig.protocols).not.toContain('TLSv1.1');

      // Should support strong protocols
      expect(tlsConfig.protocols).toContain('TLSv1.2');
      expect(tlsConfig.protocols).toContain('TLSv1.3');
    });

    it('should use strong cipher suites', async () => {
      const cipherSuites = await testHelper.getCipherSuites();

      // Should not use weak ciphers
      const weakCiphers = [
        /RC4/,
        /DES/,
        /MD5/,
        /NULL/,
        /EXPORT/,
        /ADH/,
        /AECDH/,
        /PSK/
      ];

      for (const weakCipher of weakCiphers) {
        cipherSuites.forEach(cipher => {
          expect(cipher).not.toMatch(weakCipher);
        });
      }

      // Should use strong ciphers
      const hasStrongCiphers = cipherSuites.some(cipher =>
        cipher.includes('AES_256_GCM') ||
        cipher.includes('AES_128_GCM') ||
        cipher.includes('CHACHA20_POLY1305') ||
        cipher.includes('AES_256_CBC')
      );
      expect(hasStrongCiphers).toBe(true);
    });

    it('should implement HSTS', async () => {
      const response = await testHelper.makeRequest('GET', 'https://localhost/api/profile', {}, true);

      const hstsHeader = response.headers['strict-transport-security'];
      expect(hstsHeader).toBeDefined();
      expect(hstsHeader).toMatch(/max-age=\d+/);
      expect(hstsHeader).toMatch(/includeSubDomains/);
    });
  });

  describe('Data at Rest Encryption', () => {
    it('should encrypt sensitive data in database', async () => {
      // Store sensitive information
      const sensitiveData = {
        creditCard: '4111-1111-1111-1111',
        ssn: '123-45-6789',
        apiKey: 'sk_live_1234567890',
        password: 'SuperSecretPassword123!'
      };

      const response = await testHelper.makeRequest('POST', '/api/payment/methods', sensitiveData, true);

      if (response.status === 200 || response.status === 201) {
        // Retrieve from database (should be encrypted)
        const dbResponse = await testHelper.makeDirectDatabaseQuery(
          'SELECT * FROM payment_methods WHERE id = ?',
          [response.body.id]
        );

        // Should not be stored in plaintext
        expect(dbResponse.creditCard).not.toBe(sensitiveData.creditCard);
        expect(dbResponse.ssn).not.toBe(sensitiveData.ssn);
        expect(dbResponse.apiKey).not.toBe(sensitiveData.apiKey);
        expect(dbResponse.password).not.toBe(sensitiveData.password);

        // Should be encrypted (different length or format)
        expect(dbResponse.creditCard).not.toMatch(/^\d{4}-\d{4}-\d{4}-\d{4}$/);
      }
    });

    it('should use strong encryption algorithms', async () => {
      const encryptionInfo = await testHelper.getEncryptionConfiguration();

      // Should use strong encryption
      expect(encryptionInfo.algorithm).toMatch(/AES-256/);
      expect(encryptionInfo.mode).toMatch(/GCM|CBC|CTR/);
      expect(encryptionInfo.keySize).toBeGreaterThanOrEqual(256);
      expect(encryptionInfo.ivSize).toBeGreaterThanOrEqual(96);
    });

    it('should implement proper key management', async () => {
      const keyManagement = await testHelper.getKeyManagementInfo();

      // Should have proper key rotation
      expect(keyManagement.rotationEnabled).toBe(true);
      expect(keyManagement.rotationPeriod).toBeLessThan(365); // days

      // Should store keys securely
      expect(keyManagement.storage).toMatch(/HSM|KMS|Vault/i);

      // Should not hardcode keys
      expect(keyManagement.hardcodedKeys).toBe(false);
    });
  });

  describe('Data in Transit Encryption', () => {
    it('should encrypt all API communications', async () => {
      // Test API over HTTPS
      const response = await testHelper.makeRequest('GET', 'https://localhost/api/profile', {}, true);

      // Should require HTTPS
      expect(response.status).toBe(200);

      // Should have secure headers
      expect(response.headers['strict-transport-security']).toBeDefined();
    });

    it('should use secure cookies', async () => {
      const loginResponse = await testHelper.makeRequest('POST', 'https://localhost/api/auth/login', {
        username: 'test@example.com',
        password: 'SecurePass123!'
      });

      const setCookieHeader = loginResponse.headers['set-cookie'];
      if (setCookieHeader) {
        expect(setCookieHeader).toMatch(/Secure/i);
        expect(setCookieHeader).toMatch(/HttpOnly/i);
        expect(setCookieHeader).toMatch(/SameSite=Strict|SameSite=Lax/i);
      }
    });

    it('should prevent mixed content', async () => {
      // Should not load HTTP resources on HTTPS pages
      const response = await testHelper.makeRequest('GET', 'https://localhost/', {});

      if (response.headers['content-security-policy']) {
        const csp = response.headers['content-security-policy'];
        expect(csp).toMatch(/upgrade-insecure-requests/);
      }
    });
  });

  describe('Sensitive Data Handling', () => {
    it('should not log sensitive information', async () => {
      // Make request with sensitive data
      await testHelper.makeRequest('POST', '/api/auth/login', {
        username: 'test@example.com',
        password: 'SuperSecretPassword123!',
        creditCard: '4111-1111-1111-1111'
      });

      // Check logs
      const logs = await testHelper.getApplicationLogs();
      const logsText = logs.join('\n');

      // Should not contain sensitive data
      expect(logsText).not.toMatch(/SuperSecretPassword123/);
      expect(logsText).not.toMatch(/4111-1111-1111-1111/);
      expect(logsText).not.toMatch(/password.*=.*\w+/i);
    });

    it('should mask sensitive data in responses', async () => {
      const response = await testHelper.makeRequest('GET', '/api/profile', {}, true);

      if (response.status === 200) {
        // Should not contain sensitive fields
        expect(response.body.password).toBeUndefined();
        expect(response.body.passwordHash).toBeUndefined();
        expect(response.body.salt).toBeUndefined();
        expect(response.body.creditCard).toBeUndefined();
        expect(response.body.ssn).toBeUndefined();
      }
    });

    it('should encrypt sensitive email communications', async () => {
      // Send password reset email
      await testHelper.makeRequest('POST', '/api/auth/forgot-password', {
        email: 'test@example.com'
      });

      // Check email content
      const emails = await testHelper.getSentEmails();
      const resetEmail = emails.find(e => e.to === 'test@example.com');

      if (resetEmail) {
        // Reset token should be encrypted or have limited lifetime
        expect(resetEmail.body).not.toMatch(/token=.*[A-Za-z0-9]{50,}/);
      }
    });
  });
});

describe('Session Management Security Tests', () => {
  let testHelper: TestHelper;
  let userToken: string;

  beforeAll(async () => {
    testHelper = new TestHelper();
    await testHelper.setupTestEnvironment();

    const loginResponse = await testHelper.loginUser('test@example.com', 'SecurePass123!');
    userToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await testHelper.cleanupTestEnvironment();
  });

  beforeEach(async () => {
    await testHelper.resetTestState();
  });

  describe('Session Token Security', () => {
    it('should use cryptographically strong session tokens', async () => {
      const loginResponse = await testHelper.makeRequest('POST', '/api/auth/login', {
        username: 'test@example.com',
        password: 'SecurePass123!'
      });

      const token = loginResponse.body.token;

      // Should be long enough
      expect(token.length).toBeGreaterThan(128);

      // Should use sufficient entropy
      const entropy = token.length * Math.log2(64); // Assuming base64
      expect(entropy).toBeGreaterThan(128);

      // Should be unpredictable
      const tokens = [];
      for (let i = 0; i < 5; i++) {
        const response = await testHelper.makeRequest('POST', '/api/auth/login', {
          username: `user${i}@example.com`,
          password: 'SecurePass123!'
        });
        tokens.push(response.body.token);
      }

      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(tokens.length);
    });

    it('should validate JWT signature', async () => {
      // Test with manipulated token
      const malformedToken = userToken.slice(0, -10) + 'X'.repeat(10);

      const response = await testHelper.makeRequest('GET', '/api/profile', {}, false, {
        'Authorization': `Bearer ${malformedToken}`
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/invalid.*token|signature/i);
    });

    it('should validate token claims', async () => {
      // Test with expired token
      const expiredToken = await testHelper.createExpiredToken();

      const response = await testHelper.makeRequest('GET', '/api/profile', {}, false, {
        'Authorization': `Bearer ${expiredToken}`
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/expired/i);
    });

    it('should implement token refresh mechanism', async () => {
      // Use refresh token to get new access token
      const refreshResponse = await testHelper.makeRequest('POST', '/api/auth/refresh', {
        refreshToken: testHelper.getRefreshToken()
      });

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.token).toBeDefined();
      expect(refreshResponse.body.token).not.toBe(userToken);
    });
  });

  describe('Session Fixation Prevention', () => {
    it('should regenerate session ID on login', async () => {
      // Get initial session
      const session1 = await testHelper.getSessionId();

      // Login
      await testHelper.makeRequest('POST', '/api/auth/login', {
        username: 'test@example.com',
        password: 'SecurePass123!'
      });

      // Session should be different
      const session2 = await testHelper.getSessionId();
      expect(session2).not.toBe(session1);
    });

    it('should regenerate session ID on privilege escalation', async () => {
      // Login as regular user
      await testHelper.loginUser('user@test.com', 'SecurePass123!');
      const session1 = await testHelper.getSessionId();

      // Escalate privileges (if possible)
      const escalateResponse = await testHelper.makeRequest('POST', '/api/auth/assume-admin', {}, true);

      if (escalateResponse.status === 200) {
        const session2 = await testHelper.getSessionId();
        expect(session2).not.toBe(session1);
      }
    });

    it('should reject session ID from URL', async () => {
      const response = await testHelper.makeRequest('GET', '/api/profile?sessionId=attacker-controlled', {}, true);

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/session.*url/i);
    });
  });

  describe('Session Timeout', () => {
    it('should implement absolute session timeout', async () => {
      // Create session
      await testHelper.loginUser('test@example.com', 'SecurePass123!');

      // Simulate time passing beyond absolute timeout
      await testHelper.simulateTimePassage(25 * 60 * 60 * 1000); // 25 hours

      // Session should be invalid
      const response = await testHelper.makeRequest('GET', '/api/profile', {}, true);
      expect(response.status).toBe(401);
    });

    it('should implement sliding session timeout', async () => {
      // Create session
      await testHelper.loginUser('test@example.com', 'SecurePass123!');

      // Use session before timeout
      await testHelper.simulateTimePassage(25 * 60 * 1000); // 25 minutes
      const response1 = await testHelper.makeRequest('GET', '/api/profile', {}, true);
      expect(response1.status).toBe(200);

      // Continue using session
      await testHelper.simulateTimePassage(25 * 60 * 1000); // Another 25 minutes
      const response2 = await testHelper.makeRequest('GET', '/api/profile', {}, true);
      expect(response2.status).toBe(200);

      // Let session expire
      await testHelper.simulateTimePassage(35 * 60 * 1000); // 35 minutes
      const response3 = await testHelper.makeRequest('GET', '/api/profile', {}, true);
      expect(response3.status).toBe(401);
    });

    it('should warn before session expiration', async () => {
      // Create session
      await testHelper.loginUser('test@example.com', 'SecurePass123!');

      // Get close to expiration
      await testHelper.simulateTimePassage(28 * 60 * 1000); // 28 minutes

      const response = await testHelper.makeRequest('GET', '/api/profile', {}, true);

      if (response.status === 200) {
        // Should include expiration warning
        expect(response.headers['x-session-expires-soon']).toBeDefined();
        expect(parseInt(response.headers['x-session-expires-soon'])).toBeLessThan(5 * 60); // 5 minutes
      }
    });
  });

  describe('Concurrent Session Management', () => {
    it('should limit concurrent sessions per user', async () => {
      const tokens = [];

      // Create multiple sessions
      for (let i = 0; i < 6; i++) {
        const response = await testHelper.makeRequest('POST', '/api/auth/login', {
          username: 'test@example.com',
          password: 'SecurePass123!'
        });
        tokens.push(response.body.token);
      }

      // Should limit to 5 concurrent sessions
      const lastResponse = await testHelper.makeRequest('GET', '/api/profile', {}, false, {
        'Authorization': `Bearer ${tokens[0]}`
      });

      if (lastResponse.status === 401) {
        // Oldest session should be invalidated
        expect(lastResponse.body.error).toMatch(/session.*invalid/i);
      }
    });

    it('should allow session termination', async () => {
      // Create multiple sessions
      const session1 = await testHelper.makeRequest('POST', '/api/auth/login', {
        username: 'test@example.com',
        password: 'SecurePass123!'
      });

      const session2 = await testHelper.makeRequest('POST', '/api/auth/login', {
        username: 'test@example.com',
        password: 'SecurePass123!'
      });

      // Terminate first session
      const terminateResponse = await testHelper.makeRequest('POST', '/api/auth/terminate-session', {
        sessionId: session1.body.sessionId
      }, true);

      expect(terminateResponse.status).toBe(200);

      // First session should be invalid
      const response1 = await testHelper.makeRequest('GET', '/api/profile', {}, false, {
        'Authorization': `Bearer ${session1.body.token}`
      });
      expect(response1.status).toBe(401);

      // Second session should still be valid
      const response2 = await testHelper.makeRequest('GET', '/api/profile', {}, false, {
        'Authorization': `Bearer ${session2.body.token}`
      });
      expect(response2.status).toBe(200);
    });

    it('should notify users of new sessions', async () => {
      // Create initial session
      await testHelper.loginUser('test@example.com', 'SecurePass123!');

      // Create new session from different IP
      const newSessionResponse = await testHelper.makeRequest('POST', '/api/auth/login', {
        username: 'test@example.com',
        password: 'SecurePass123!'
      }, false, {
        'X-Forwarded-For': '192.168.1.100'
      });

      // Should send notification
      const notifications = await testHelper.getNotifications();
      const newSessionNotification = notifications.find(n =>
        n.type === 'new_session' &&
        n.ip === '192.168.1.100'
      );

      expect(newSessionNotification).toBeDefined();
    });
  });

  describe('Session Storage Security', () => {
    it('should not store sensitive data in session', async () => {
      const sessionData = await testHelper.getSessionData(userToken);

      // Should not contain sensitive information
      expect(sessionData.password).toBeUndefined();
      expect(sessionData.creditCard).toBeUndefined();
      expect(sessionData.ssn).toBeUndefined();
    });

    it('should encrypt session data', async () => {
      // Session should be encrypted at rest
      const sessionStore = await testHelper.getSessionStoreData();

      // Should not be plaintext
      expect(sessionStore.data).not.toContain(userToken);
      expect(sessionStore.data).not.toContain('test@example.com');
    });

    it('should sign session cookies', async () => {
      const loginResponse = await testHelper.makeRequest('POST', '/api/auth/login', {
        username: 'test@example.com',
        password: 'SecurePass123!'
      });

      const setCookieHeader = loginResponse.headers['set-cookie'];
      if (setCookieHeader) {
        // Should have signature
        expect(setCookieHeader).toMatch(/Signature|sig/i);
      }
    });
  });

  describe('Session Revocation', () => {
    it('should revoke all sessions on password change', async () => {
      // Create session
      const session1 = await testHelper.makeRequest('POST', '/api/auth/login', {
        username: 'test@example.com',
        password: 'SecurePass123!'
      });

      // Change password
      await testHelper.makeRequest('POST', '/api/auth/change-password', {
        currentPassword: 'SecurePass123!',
        newPassword: 'NewSecurePass456!'
      }, true);

      // Old session should be invalid
      const response = await testHelper.makeRequest('GET', '/api/profile', {}, false, {
        'Authorization': `Bearer ${session1.body.token}`
      });
      expect(response.status).toBe(401);
    });

    it('should revoke session on logout', async () => {
      // Create session
      const loginResponse = await testHelper.makeRequest('POST', '/api/auth/login', {
        username: 'test@example.com',
        password: 'SecurePass123!'
      });

      // Logout
      await testHelper.makeRequest('POST', '/api/auth/logout', {}, true);

      // Session should be invalid
      const response = await testHelper.makeRequest('GET', '/api/profile', {}, false, {
        'Authorization': `Bearer ${loginResponse.body.token}`
      });
      expect(response.status).toBe(401);
    });

    it('should support emergency session revocation', async () => {
      // Admin can revoke all user sessions
      const adminResponse = await testHelper.makeRequest('POST', '/api/admin/revoke-all-sessions', {
        userId: 'user123'
      }, false, {
        'Authorization': `Bearer ${adminToken}`
      });

      expect(adminResponse.status).toBe(200);

      // All user sessions should be invalid
      const userResponse = await testHelper.makeRequest('GET', '/api/profile', {}, true);
      expect(userResponse.status).toBe(401);
    });
  });
});

export {};
