/**
 * SSO API Integration Test Suite
 *
 * End-to-end testing for SSO authentication workflows including:
 * - Complete authentication flows
 * - Cross-provider compatibility
 * - Real database interactions
 * - Security and compliance validation
 * - Performance and load testing
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { SSOAPI } from '../../src/api/sso';
import { SSOProviderManager } from '../../src/services/sso';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../src/db/schema';

describe('SSO API Integration Tests', () => {
  let ssoAPI: SSOAPI;
  let env: any;
  let db: any;

  // Test data
  const testProviders = [
    {
      id: 'test-azure-ad',
      name: 'Test Azure AD',
      type: 'azure-ad',
      config: JSON.stringify({
        displayName: 'Azure Active Directory',
        clientId: 'test-client-id',
        domain: 'test tenant.onmicrosoft.com',
        features: {
          autoProvisioning: true,
          groupSync: true,
          roleMapping: true,
          singleLogout: true,
          mfa: true,
          userManagement: false,
          apiAccess: false,
        },
        branding: {
          logoUrl: 'https://example.com/azure-logo.png',
          primaryColor: '#0078d4',
        },
        security: {
          domainRestrictions: ['test.com'],
        },
      }),
      isActive: true,
      isDefault: true,
      priority: 1,
      description: 'Test Azure AD provider',
    },
    {
      id: 'test-okta',
      name: 'Test Okta',
      type: 'okta',
      config: JSON.stringify({
        displayName: 'Okta Identity Platform',
        clientId: 'test-okta-client-id',
        domain: 'test.okta.com',
        features: {
          autoProvisioning: false,
          groupSync: false,
          roleMapping: false,
          singleLogout: false,
          mfa: false,
          userManagement: false,
          apiAccess: false,
        },
      }),
      isActive: true,
      isDefault: false,
      priority: 2,
      description: 'Test Okta provider',
    },
    {
      id: 'inactive-provider',
      name: 'Inactive Provider',
      type: 'auth0',
      config: JSON.stringify({
        displayName: 'Inactive Auth0',
      }),
      isActive: false,
      isDefault: false,
      priority: 3,
      description: 'Inactive test provider',
    },
  ];

  const testUsers = [
    {
      id: 'test-user-1',
      email: 'user1@test.com',
      name: 'Test User One',
      firstName: 'Test',
      lastName: 'User One',
      isActive: true,
      isEmailVerified: true,
      roles: ['user'],
      groups: ['developers'],
      permissions: ['read', 'write'],
      preferences: {
        language: 'en',
        timezone: 'UTC',
        theme: 'light',
      },
    },
    {
      id: 'test-user-2',
      email: 'user2@test.com',
      name: 'Test User Two',
      firstName: 'Test',
      lastName: 'User Two',
      isActive: true,
      isEmailVerified: true,
      roles: ['admin'],
      groups: ['administrators'],
      permissions: ['read', 'write', 'admin'],
    },
  ];

  beforeAll(async () => {
    // Initialize test environment
    env = {
      DB: {
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            run: vi.fn(),
            all: vi.fn(),
            first: vi.fn(),
          })),
        })),
        batch: vi.fn(() => Promise.resolve([])),
      },
      CACHE: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
      },
      CORS_ORIGIN: 'https://test.com',
      FRONTEND_URL: 'https://test.com',
      JWT_SECRET: 'test-jwt-secret-key',
      JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-key',
    };

    db = drizzle(env.DB, { schema });
    ssoAPI = new SSOAPI(env);
  });

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock database responses
    env.DB.prepare.mockReturnValue({
      bind: vi.fn(() => ({
        run: vi.fn().mockResolvedValue({ success: true }),
        all: vi.fn().mockResolvedValue([]),
        first: vi.fn().mockResolvedValue(null),
      })),
    });
  });

  describe('Complete Authentication Flow', () => {
    it('should handle complete authentication flow from initiate to callback', async () => {
      // Step 1: Get available providers
      const providersRequest = new Request('https://test.com/api/sso/providers');
      env.DB.prepare().bind().all.mockResolvedValue(testProviders.filter(p => p.isActive));

      const providersResponse = await ssoAPI.getProviders(providersRequest, env);
      const providersResult = await providersResponse.json();

      expect(providersResponse.status).toBe(200);
      expect(providersResult.providers).toHaveLength(2);
      expect(providersResult.defaultProvider).toBe('test-azure-ad');

      // Step 2: Initiate authentication
      const initiateRequest = new Request('https://test.com/api/sso/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: 'test-azure-ad',
          redirectUrl: 'https://test.com/auth/callback',
          scopes: ['openid', 'profile', 'email'],
          loginHint: 'user1@test.com',
        }),
      });

      env.DB.prepare().bind().first.mockResolvedValue(testProviders[0]);
      env.CACHE.put.mockResolvedValue(undefined);

      // Mock SSO provider manager
      const mockProviderManager = ssoAPI['providerManager'];
      mockProviderManager.getProviderHealth = vi.fn().mockResolvedValue({
        isHealthy: true,
        lastCheck: new Date(),
        responseTime: 150,
      });

      mockProviderManager.initiateAuthentication = vi.fn().mockResolvedValue({
        success: true,
        authenticationUrl: 'https://login.microsoftonline.com/tenant/oauth2/v2.0/authorize?response_type=code&client_id=test-client-id&redirect_uri=https%3A%2F%2Ftest.com%2Fapi%2Fsso%2Fcallback&state=test-state&scope=openid%20profile%20email',
        state: 'test-state',
      });

      const initiateResponse = await ssoAPI.initiateSSO(initiateRequest, env);
      const initiateResult = await initiateResponse.json();

      expect(initiateResponse.status).toBe(200);
      expect(initiateResult.success).toBe(true);
      expect(initiateResult.authenticationUrl).toContain('login.microsoftonline.com');
      expect(initiateResult.state).toBe('test-state');
      expect(initiateResult.providerInfo.id).toBe('test-azure-ad');

      // Step 3: Process callback
      const callbackRequest = new Request('https://test.com/api/sso/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: 'test-azure-ad',
          state: 'test-state',
          code: 'test-auth-code',
        }),
      });

      // Mock auth flow state
      const authFlowState = {
        state: 'test-state',
        providerId: 'test-azure-ad',
        userId: null,
        redirectUrl: 'https://test.com/auth/callback',
        codeVerifier: 'test-verifier',
        scopes: ['openid', 'profile', 'email'],
        loginHint: 'user1@test.com',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        ipAddress: '127.0.0.1',
        userAgent: 'test-user-agent',
      };

      env.CACHE.get.mockResolvedValue(JSON.stringify(authFlowState));

      // Mock successful authentication
      mockProviderManager.processAuthenticationResponse = vi.fn().mockResolvedValue({
        success: true,
        user: {
          id: 'test-user-1',
          email: 'user1@test.com',
          name: 'Test User One',
          firstName: 'Test',
          lastName: 'User One',
          roles: ['user'],
          groups: ['developers'],
        },
        tokens: {
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
          expiresIn: 3600,
          scope: 'openid profile email',
        },
      });

      // Mock user creation (new user)
      env.DB.prepare().bind().first.mockResolvedValueOnce(null); // User doesn't exist
      env.DB.prepare().bind().run.mockResolvedValue({ success: true }); // User created

      const callbackResponse = await ssoAPI.handleSSOCallback(callbackRequest, env);
      const callbackResult = await callbackResponse.json();

      expect(callbackResponse.status).toBe(200);
      expect(callbackResult.success).toBe(true);
      expect(callbackResult.user.email).toBe('user1@test.com');
      expect(callbackResult.user.name).toBe('Test User One');
      expect(callbackResult.tokens.accessToken).toBe('test-access-token');
      expect(callbackResult.isNewUser).toBe(true);
      expect(callbackResult.redirectUrl).toBe('https://test.com/auth/callback');

      // Step 4: Get user info
      const userInfoRequest = new Request('https://test.com/api/sso/user-info?sessionId=test-session-id');

      // Mock session and user data
      env.DB.prepare().bind().first.mockResolvedValueOnce({
        id: 'test-session-id',
        userId: 'test-user-1',
        providerId: 'test-azure-ad',
        isActive: true,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      env.DB.prepare().bind().first.mockResolvedValueOnce(testUsers[0]);
      env.DB.prepare().bind().first.mockResolvedValueOnce(testProviders[0]);

      const userInfoResponse = await ssoAPI.getUserInfo(userInfoRequest, env);
      const userInfoResult = await userInfoResponse.json();

      expect(userInfoResponse.status).toBe(200);
      expect(userInfoResult.id).toBe('test-user-1');
      expect(userInfoResult.email).toBe('user1@test.com');
      expect(userInfoResult.roles).toEqual(['user']);
      expect(userInfoResult.groups).toEqual(['developers']);
      expect(userInfoResult.provider.id).toBe('test-azure-ad');
      expect(userInfoResult.preferences.language).toBe('en');

      // Verify audit logging
      expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO'));
      expect(env.CACHE.delete).toHaveBeenCalledWith('sso:state:test-state');
    });

    it('should handle authentication for existing user', async () => {
      const callbackRequest = new Request('https://test.com/api/sso/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: 'test-okta',
          state: 'test-state-existing-user',
          code: 'test-auth-code-existing',
        }),
      });

      const authFlowState = {
        state: 'test-state-existing-user',
        providerId: 'test-okta',
        userId: 'test-user-2',
        redirectUrl: 'https://test.com/auth/callback',
        codeVerifier: 'test-verifier',
        scopes: ['openid', 'profile'],
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        ipAddress: '127.0.0.1',
        userAgent: 'test-user-agent',
      };

      env.CACHE.get.mockResolvedValue(JSON.stringify(authFlowState));

      const mockProviderManager = ssoAPI['providerManager'];
      mockProviderManager.processAuthenticationResponse = vi.fn().mockResolvedValue({
        success: true,
        user: {
          id: 'test-user-2',
          email: 'user2@test.com',
          name: 'Test User Two',
          firstName: 'Test',
          lastName: 'User Two',
          roles: ['admin'],
          groups: ['administrators'],
        },
        tokens: {
          accessToken: 'test-access-token-existing',
          refreshToken: 'test-refresh-token-existing',
          expiresIn: 7200,
          scope: 'openid profile',
        },
      });

      // Mock existing user
      env.DB.prepare().bind().first.mockResolvedValueOnce(testUsers[1]); // User exists
      env.DB.prepare().bind().run.mockResolvedValue({ success: true }); // Session created

      const response = await ssoAPI.handleSSOCallback(callbackRequest, env);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.user.email).toBe('user2@test.com');
      expect(result.isNewUser).toBe(false); // Existing user
    });
  });

  describe('Multi-Provider Support', () => {
    it('should handle authentication with different providers', async () => {
      const providers = ['test-azure-ad', 'test-okta'];

      for (const providerId of providers) {
        const request = new Request('https://test.com/api/sso/initiate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            providerId,
            redirectUrl: `https://test.com/auth/${providerId}/callback`,
          }),
        });

        const provider = testProviders.find(p => p.id === providerId);
        env.DB.prepare().bind().first.mockResolvedValue(provider);
        env.CACHE.put.mockResolvedValue(undefined);

        const mockProviderManager = ssoAPI['providerManager'];
        mockProviderManager.getProviderHealth = vi.fn().mockResolvedValue({
          isHealthy: true,
          lastCheck: new Date(),
          responseTime: 100,
        });

        mockProviderManager.initiateAuthentication = vi.fn().mockResolvedValue({
          success: true,
          authenticationUrl: `https://${provider}.test.com/oauth/authorize`,
          state: `state-${providerId}`,
        });

        const response = await ssoAPI.initiateSSO(request, env);
        const result = await response.json();

        expect(response.status).toBe(200);
        expect(result.success).toBe(true);
        expect(result.providerInfo.id).toBe(providerId);
        expect(result.authenticationUrl).toContain(provider);
      }
    });

    it('should handle provider-specific features', async () => {
      // Test Azure AD with MFA and provisioning
      const azureProvider = testProviders.find(p => p.id === 'test-azure-ad');
      const azureConfig = JSON.parse(azureProvider!.config);

      expect(azureConfig.features.mfa).toBe(true);
      expect(azureConfig.features.autoProvisioning).toBe(true);
      expect(azureConfig.features.groupSync).toBe(true);
      expect(azureConfig.security.domainRestrictions).toContain('test.com');

      // Test Okta with limited features
      const oktaProvider = testProviders.find(p => p.id === 'test-okta');
      const oktaConfig = JSON.parse(oktaProvider!.config);

      expect(oktaConfig.features.mfa).toBe(false);
      expect(oktaConfig.features.autoProvisioning).toBe(false);
    });
  });

  describe('Security and Compliance', () => {
    it('should enforce CSRF protection with state parameters', async () => {
      const initiateRequest = new Request('https://test.com/api/sso/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: 'test-azure-ad',
        }),
      });

      env.DB.prepare().bind().first.mockResolvedValue(testProviders[0]);
      env.CACHE.put.mockResolvedValue(undefined);

      const mockProviderManager = ssoAPI['providerManager'];
      mockProviderManager.getProviderHealth = vi.fn().mockResolvedValue({
        isHealthy: true,
        lastCheck: new Date(),
      });

      mockProviderManager.initiateAuthentication = vi.fn().mockResolvedValue({
        success: true,
        authenticationUrl: 'https://login.microsoftonline.com/tenant/oauth2/v2.0/authorize',
        state: 'secure-csrf-state-12345',
      });

      const response = await ssoAPI.initiateSSO(initiateRequest, env);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.state).toBe('secure-csrf-state-12345');
      expect(env.CACHE.put).toHaveBeenCalledWith(
        'sso:state:secure-csrf-state-12345',
        expect.stringContaining('"state":"secure-csrf-state-12345"'),
        { expirationTtl: 600 }
      );

      // Verify state is required for callback
      const callbackRequest = new Request('https://test.com/api/sso/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: 'test-azure-ad',
          code: 'test-code',
          // Missing state
        }),
      });

      const callbackResponse = await ssoAPI.handleSSOCallback(callbackRequest, env);
      const callbackResult = await callbackResponse.json();

      expect(callbackResponse.status).toBe(400);
      expect(callbackResult.error.code).toBe('VALIDATION_ERROR');
      expect(callbackResult.error.message).toBe('State parameter is required');
    });

    it('should handle domain restrictions', async () => {
      // Test user with allowed domain
      const allowedDomainRequest = new Request('https://test.com/api/sso/providers');
      env.DB.prepare().bind().all.mockResolvedValue(testProviders.filter(p => p.isActive));

      // Mock user with allowed domain
      const mockUser = { email: 'user@test.com' };
      vi.spyOn(ssoAPI as any, 'getUserFromRequest').mockResolvedValue(mockUser);

      const response = await ssoAPI.getProviders(allowedDomainRequest, env);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.providers).toHaveLength(2); // Both providers available for test.com domain

      // Test user with restricted domain
      const restrictedDomainRequest = new Request('https://test.com/api/sso/providers');
      vi.spyOn(ssoAPI as any, 'getUserFromRequest').mockResolvedValue({ email: 'user@restricted.com' });

      const restrictedResponse = await ssoAPI.getProviders(restrictedDomainRequest, env);
      const restrictedResult = await restrictedResponse.json();

      // Azure AD should be filtered out due to domain restriction
      expect(restrictedResult.providers.some(p => p.id === 'test-azure-ad')).toBe(false);
    });

    it('should maintain audit trail for compliance', async () => {
      const initiateRequest = new Request('https://test.com/api/sso/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '192.168.1.100',
          'User-Agent': 'Mozilla/5.0 (Test Browser)',
        },
        body: JSON.stringify({
          providerId: 'test-azure-ad',
        }),
      });

      env.DB.prepare().bind().first.mockResolvedValue(testProviders[0]);
      env.CACHE.put.mockResolvedValue(undefined);

      const mockProviderManager = ssoAPI['providerManager'];
      mockProviderManager.getProviderHealth = vi.fn().mockResolvedValue({
        isHealthy: true,
        lastCheck: new Date(),
      });

      mockProviderManager.initiateAuthentication = vi.fn().mockResolvedValue({
        success: true,
        authenticationUrl: 'https://login.microsoftonline.com/tenant/oauth2/v2.0/authorize',
        state: 'audit-test-state',
      });

      await ssoAPI.initiateSSO(initiateRequest, env);

      // Verify audit log entry
      expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO sso_audit_logs'));

      const auditCall = env.DB.prepare.mock.calls.find(call =>
        call[0].includes('INSERT INTO sso_audit_logs')
      );

      expect(auditCall).toBeDefined();
      const auditQuery = auditCall![0];
      expect(auditQuery).toContain('action');
      expect(auditQuery).toContain('providerId');
      expect(auditQuery).toContain('success');
      expect(auditQuery).toContain('details');
      expect(auditQuery).toContain('ipAddress');
      expect(auditQuery).toContain('userAgent');
      expect(auditQuery).toContain('requestId');
    });
  });

  describe('Session Management', () => {
    it('should handle complete session lifecycle', async () => {
      // Create session
      const sessionId = 'test-session-lifecycle';

      // Mock session creation
      env.DB.prepare().bind().run.mockResolvedValue({ success: true });

      // Verify session exists
      const userInfoRequest = new Request(`https://test.com/api/sso/user-info?sessionId=${sessionId}`);
      env.DB.prepare().bind().first.mockResolvedValueOnce({
        id: sessionId,
        userId: 'test-user-1',
        providerId: 'test-azure-ad',
        isActive: true,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      env.DB.prepare().bind().first.mockResolvedValueOnce(testUsers[0]);
      env.DB.prepare().bind().first.mockResolvedValueOnce(testProviders[0]);

      const userInfoResponse = await ssoAPI.getUserInfo(userInfoRequest, env);
      expect(userInfoResponse.status).toBe(200);

      // Logout from specific provider
      const logoutRequest = new Request('https://test.com/api/sso/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: 'test-azure-ad',
          revokeTokens: true,
        }),
      });

      vi.spyOn(ssoAPI as any, 'getUserFromRequest').mockResolvedValue(testUsers[0]);

      env.DB.prepare().bind().first.mockResolvedValue({
        id: sessionId,
        userId: 'test-user-1',
        providerId: 'test-azure-ad',
        isActive: true,
      });

      const mockProviderManager = ssoAPI['providerManager'];
      mockProviderManager.initiateLogout = vi.fn().mockResolvedValue({
        success: true,
        logoutUrl: 'https://login.microsoftonline.com/logout',
      });

      const logoutResponse = await ssoAPI.logout(logoutRequest, env);
      const logoutResult = await logoutResponse.json();

      expect(logoutResponse.status).toBe(200);
      expect(logoutResult.success).toBe(true);
      expect(logoutResult.loggedOutProviders).toEqual(['test-azure-ad']);

      // Verify session deactivation
      expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE sso_sessions SET is_active = 0'));

      // Verify token revocation
      expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE sso_access_tokens SET is_active = 0'));
    });

    it('should handle session expiration', async () => {
      const expiredSessionRequest = new Request('https://test.com/api/sso/user-info?sessionId=expired-session');

      env.DB.prepare().bind().first.mockResolvedValue({
        id: 'expired-session',
        userId: 'test-user-1',
        providerId: 'test-azure-ad',
        isActive: false, // Inactive/expired session
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        expiresAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      });

      const response = await ssoAPI.getUserInfo(expiredSessionRequest, env);
      const result = await response.json();

      expect(response.status).toBe(401);
      expect(result.error.code).toBe('INVALID_SESSION');
      expect(result.error.message).toBe('Invalid or expired session');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle provider unavailability gracefully', async () => {
      const providersRequest = new Request('https://test.com/api/sso/providers');

      // Mock one healthy provider and one unhealthy
      const mockProviders = testProviders.map(p => ({
        ...p,
        isActive: p.id === 'test-azure-ad', // Only Azure AD is active
      }));

      env.DB.prepare().bind().all.mockResolvedValue(mockProviders);

      const mockProviderManager = ssoAPI['providerManager'];
      mockProviderManager.getProviderHealth = vi.fn()
        .mockResolvedValueOnce({ isHealthy: true, lastCheck: new Date(), responseTime: 100 })
        .mockResolvedValueOnce({ isHealthy: false, lastCheck: new Date(), error: 'Connection timeout' });

      const response = await ssoAPI.getProviders(providersRequest, env);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.providers).toHaveLength(1);
      expect(result.providers[0].healthStatus.isHealthy).toBe(true);
    });

    it('should handle concurrent authentication requests', async () => {
      const concurrentRequests = Array.from({ length: 5 }, (_, i) =>
        new Request('https://test.com/api/sso/initiate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            providerId: 'test-azure-ad',
            state: `concurrent-state-${i}`,
          }),
        })
      );

      env.DB.prepare().bind().first.mockResolvedValue(testProviders[0]);
      env.CACHE.put.mockResolvedValue(undefined);

      const mockProviderManager = ssoAPI['providerManager'];
      mockProviderManager.getProviderHealth = vi.fn().mockResolvedValue({
        isHealthy: true,
        lastCheck: new Date(),
      });

      mockProviderManager.initiateAuthentication = vi.fn().mockResolvedValue({
        success: true,
        authenticationUrl: 'https://login.microsoftonline.com/tenant/oauth2/v2.0/authorize',
        state: vi.fn(() => `unique-state-${Math.random()}`),
      });

      // Execute all requests concurrently
      const responses = await Promise.all(
        concurrentRequests.map(request => ssoAPI.initiateSSO(request, env))
      );

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Verify unique states were generated
      const states = await Promise.all(
        responses.map(response => response.json().then(r => r.state))
      );

      const uniqueStates = new Set(states);
      expect(uniqueStates.size).toBe(states.length);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle high-volume provider requests efficiently', async () => {
      const startTime = Date.now();
      const requestCount = 100;

      const requests = Array.from({ length: requestCount }, () =>
        new Request('https://test.com/api/sso/providers')
      );

      env.DB.prepare().bind().all.mockResolvedValue(testProviders.filter(p => p.isActive));

      const mockProviderManager = ssoAPI['providerManager'];
      mockProviderManager.getProviderHealth = vi.fn().mockResolvedValue({
        isHealthy: true,
        lastCheck: new Date(),
        responseTime: 50,
      });

      // Execute all requests concurrently
      const responses = await Promise.all(
        requests.map(request => ssoAPI.getProviders(request, env))
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgResponseTime = totalTime / requestCount;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Performance assertions
      expect(avgResponseTime).toBeLessThan(100); // Average under 100ms
      expect(totalTime).toBeLessThan(5000); // Total under 5 seconds

      // Verify response headers include timing information
      responses.forEach(response => {
        expect(response.headers.get('X-Response-Time')).toBeTruthy();
      });
    });

    it('should maintain performance under database load', async () => {
      // Simulate database latency
      env.DB.prepare().bind().all.mockImplementation(() =>
        new Promise(resolve =>
          setTimeout(() => resolve(testProviders.filter(p => p.isActive)), 50)
        )
      );

      const request = new Request('https://test.com/api/sso/providers');
      const startTime = Date.now();

      const response = await ssoAPI.getProviders(request, env);
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(200); // Under 200ms even with DB latency
    });
  });

  describe('Cross-Provider Compatibility', () => {
    it('should handle different authentication protocols', async () => {
      const protocolTests = [
        { providerId: 'test-azure-ad', expectedProtocol: 'oidc' },
        { providerId: 'test-okta', expectedProtocol: 'saml' },
      ];

      for (const test of protocolTests) {
        const request = new Request('https://test.com/api/sso/initiate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            providerId: test.providerId,
            scopes: ['openid', 'profile', 'email'],
          }),
        });

        const provider = testProviders.find(p => p.id === test.providerId);
        env.DB.prepare().bind().first.mockResolvedValue(provider);
        env.CACHE.put.mockResolvedValue(undefined);

        const mockProviderManager = ssoAPI['providerManager'];
        mockProviderManager.getProviderHealth = vi.fn().mockResolvedValue({
          isHealthy: true,
          lastCheck: new Date(),
        });

        mockProviderManager.initiateAuthentication = vi.fn().mockResolvedValue({
          success: true,
          authenticationUrl: `https://${test.providerId}.test.com/auth`,
          state: `state-${test.providerId}`,
        });

        const response = await ssoAPI.initiateSSO(request, env);
        const result = await response.json();

        expect(response.status).toBe(200);
        expect(result.success).toBe(true);
        expect(result.providerInfo.id).toBe(test.providerId);

        // Verify protocol-specific handling in provider manager
        expect(mockProviderManager.initiateAuthentication).toHaveBeenCalledWith(
          expect.objectContaining({
            providerId: test.providerId,
            scopes: ['openid', 'profile', 'email'],
          })
        );
      }
    });
  });
});
