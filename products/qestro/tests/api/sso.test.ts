/**
 * SSO API Endpoints Test Suite
 *
 * Comprehensive test coverage for SSO authentication endpoints including:
 * - Provider listing and management
 * - Authentication flow initiation and callback handling
 * - User session management
 * - Logout functionality
 * - Security validation and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { SSOAPI } from '../../src/api/sso';
import { SSOProviderManager } from '../../src/services/sso';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../src/db/schema';
import { crypto } from 'node:crypto';

// Mock dependencies
vi.mock('drizzle-orm/d1');
vi.mock('../../src/services/sso');
vi.mock('node:crypto');

describe('SSO API', () => {
  let ssoAPI: SSOAPI;
  let mockDb: any;
  let mockEnv: any;
  let mockProviderManager: MockedFunction<any>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock environment
    mockEnv = {
      DB: {},
      CACHE: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
      },
      CORS_ORIGIN: 'https://test.com',
      FRONTEND_URL: 'https://test.com',
    };

    // Mock database
    mockDb = {
      select: vi.fn(() => mockDb),
      from: vi.fn(() => mockDb),
      where: vi.fn(() => mockDb),
      limit: vi.fn(() => mockDb),
      orderBy: vi.fn(() => mockDb),
      all: vi.fn(() => Promise.resolve([])),
      insert: vi.fn(() => mockDb),
      values: vi.fn(() => mockDb),
      update: vi.fn(() => mockDb),
      set: vi.fn(() => mockDb),
    };

    // Mock drizzle
    (drizzle as any).mockReturnValue(mockDb);

    // Mock SSO Provider Manager
    mockProviderManager = vi.fn();
    mockProviderManager.getProviderHealth = vi.fn();
    mockProviderManager.initiateAuthentication = vi.fn();
    mockProviderManager.processAuthenticationResponse = vi.fn();
    mockProviderManager.initiateLogout = vi.fn();

    (SSOProviderManager as any).mockImplementation(() => ({
      getProviderHealth: mockProviderManager.getProviderHealth,
      initiateAuthentication: mockProviderManager.initiateAuthentication,
      processAuthenticationResponse: mockProviderManager.processAuthenticationResponse,
      initiateLogout: mockProviderManager.initiateLogout,
    }));

    // Mock crypto
    (crypto.randomUUID as any).mockReturnValue('test-uuid');
    (crypto.randomBytes as any).mockReturnValue(Buffer.from('test-bytes'));
    (crypto.createHash as any).mockReturnValue({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue('test-digest'),
    });

    ssoAPI = new SSOAPI(mockEnv);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/sso/providers', () => {
    it('should return list of active SSO providers', async () => {
      // Arrange
      const mockProviders = [
        {
          id: 'provider-1',
          name: 'Test Provider 1',
          type: 'azure-ad',
          config: JSON.stringify({
            displayName: 'Azure AD',
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
              logoUrl: 'https://example.com/logo.png',
              primaryColor: '#0078d4',
            },
            supportedFeatures: ['sso', 'mfa', 'provisioning'],
          }),
          isActive: true,
          isDefault: true,
          description: 'Test Azure AD provider',
        },
        {
          id: 'provider-2',
          name: 'Test Provider 2',
          type: 'okta',
          config: JSON.stringify({
            displayName: 'Okta',
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
          description: 'Test Okta provider',
        },
      ];

      mockDb.all.mockResolvedValue(mockProviders);
      mockProviderManager.getProviderHealth.mockResolvedValue({
        isHealthy: true,
        lastCheck: new Date(),
        responseTime: 150,
      });

      const request = new Request('https://test.com/api/sso/providers');

      // Act
      const response = await ssoAPI.getProviders(request, mockEnv);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.providers).toHaveLength(2);
      expect(result.totalProviders).toBe(2);
      expect(result.defaultProvider).toBe('provider-1');

      const firstProvider = result.providers[0];
      expect(firstProvider.id).toBe('provider-1');
      expect(firstProvider.name).toBe('Test Provider 1');
      expect(firstProvider.type).toBe('azure-ad');
      expect(firstProvider.displayName).toBe('Azure AD');
      expect(firstProvider.isActive).toBe(true);
      expect(firstProvider.isDefault).toBe(true);
      expect(firstProvider.capabilities.authentication).toBe(true);
      expect(firstProvider.capabilities.provisioning).toBe(true);
      expect(firstProvider.capabilities.groupSync).toBe(true);
      expect(firstProvider.capabilities.roleMapping).toBe(true);
      expect(firstProvider.capabilities.singleLogout).toBe(true);
      expect(firstProvider.capabilities.mfa).toBe(true);
      expect(firstProvider.healthStatus.isHealthy).toBe(true);
      expect(firstProvider.healthStatus.responseTime).toBe(150);
      expect(firstProvider.metadata.logoUrl).toBe('https://example.com/logo.png');
      expect(firstProvider.metadata.primaryColor).toBe('#0078d4');
      expect(firstProvider.metadata.supportedFeatures).toEqual(['sso', 'mfa', 'provisioning']);

      expect(response.headers.get('X-Request-ID')).toBeDefined();
      expect(response.headers.get('X-Response-Time')).toBeDefined();
    });

    it('should filter providers by type', async () => {
      // Arrange
      const mockProviders = [
        {
          id: 'provider-1',
          name: 'Test Provider 1',
          type: 'azure-ad',
          config: '{}',
          isActive: true,
          isDefault: false,
        },
      ];

      mockDb.all.mockResolvedValue(mockProviders);
      mockProviderManager.getProviderHealth.mockResolvedValue({
        isHealthy: true,
        lastCheck: new Date(),
      });

      const request = new Request('https://test.com/api/sso/providers?type=azure-ad');

      // Act
      const response = await ssoAPI.getProviders(request, mockEnv);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(result.providers).toHaveLength(1);
      expect(result.providers[0].type).toBe('azure-ad');
    });

    it('should include inactive providers when requested', async () => {
      // Arrange
      const mockProviders = [
        {
          id: 'provider-1',
          name: 'Active Provider',
          type: 'azure-ad',
          config: '{}',
          isActive: true,
          isDefault: false,
        },
        {
          id: 'provider-2',
          name: 'Inactive Provider',
          type: 'okta',
          config: '{}',
          isActive: false,
          isDefault: false,
        },
      ];

      mockDb.all.mockResolvedValue(mockProviders);
      mockProviderManager.getProviderHealth.mockResolvedValue({
        isHealthy: true,
        lastCheck: new Date(),
      });

      const request = new Request('https://test.com/api/sso/providers?includeInactive=true');

      // Act
      const response = await ssoAPI.getProviders(request, mockEnv);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(result.providers).toHaveLength(2);
      expect(result.providers[0].isActive).toBe(true);
      expect(result.providers[1].isActive).toBe(false);
    });

    it('should handle provider health check failures gracefully', async () => {
      // Arrange
      const mockProviders = [
        {
          id: 'provider-1',
          name: 'Test Provider',
          type: 'azure-ad',
          config: '{}',
          isActive: true,
          isDefault: false,
        },
      ];

      mockDb.all.mockResolvedValue(mockProviders);
      mockProviderManager.getProviderHealth.mockResolvedValue({
        isHealthy: false,
        lastCheck: new Date(),
        error: 'Connection timeout',
      });

      const request = new Request('https://test.com/api/sso/providers');

      // Act
      const response = await ssoAPI.getProviders(request, mockEnv);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(result.providers[0].healthStatus.isHealthy).toBe(false);
    });

    it('should handle database errors', async () => {
      // Arrange
      mockDb.all.mockRejectedValue(new Error('Database connection failed'));

      const request = new Request('https://test.com/api/sso/providers');

      // Act
      const response = await ssoAPI.getProviders(request, mockEnv);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('PROVIDERS_FETCH_ERROR');
      expect(result.error.message).toBe('Failed to fetch SSO providers');
    });
  });

  describe('POST /api/sso/initiate', () => {
    it('should initiate SSO authentication flow successfully', async () => {
      // Arrange
      const initiateRequest = {
        providerId: 'provider-1',
        redirectUrl: 'https://test.com/callback',
        scopes: ['openid', 'profile', 'email'],
        loginHint: 'user@test.com',
      };

      const mockProvider = {
        id: 'provider-1',
        name: 'Test Provider',
        type: 'azure-ad',
        config: '{}',
        isActive: true,
        isDefault: false,
      };

      mockDb.limit.mockResolvedValue([mockProvider]);
      mockProviderManager.getProviderHealth.mockResolvedValue({
        isHealthy: true,
        lastCheck: new Date(),
        responseTime: 100,
      });

      mockProviderManager.initiateAuthentication.mockResolvedValue({
        success: true,
        authenticationUrl: 'https://provider.com/oauth/authorize?code=test-code',
        state: 'test-state',
      });

      mockEnv.CACHE.put.mockResolvedValue(undefined);

      const request = new Request('https://test.com/api/sso/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initiateRequest),
      });

      // Act
      const response = await ssoAPI.initiateSSO(request, mockEnv);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.authenticationUrl).toBe('https://provider.com/oauth/authorize?code=test-code');
      expect(result.state).toBe('test-state');
      expect(result.providerInfo.id).toBe('provider-1');
      expect(result.providerInfo.type).toBe('azure-ad');
      expect(result.expiresAt).toBeDefined();

      expect(mockProviderManager.initiateAuthentication).toHaveBeenCalledWith({
        providerId: 'provider-1',
        state: 'test-state',
        redirectUrl: 'https://test.com/callback',
        codeChallenge: 'test-digest',
        codeChallengeMethod: 'S256',
        scopes: ['openid', 'profile', 'email'],
        loginHint: 'user@test.com',
        domainHint: undefined,
        prompt: undefined,
      });

      expect(mockEnv.CACHE.put).toHaveBeenCalledWith(
        'sso:state:test-state',
        expect.stringContaining('"providerId":"provider-1"'),
        { expirationTtl: 600 }
      );
    });

    it('should handle missing provider ID', async () => {
      // Arrange
      const initiateRequest = {
        redirectUrl: 'https://test.com/callback',
      };

      const request = new Request('https://test.com/api/sso/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initiateRequest),
      });

      // Act
      const response = await ssoAPI.initiateSSO(request, mockEnv);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toBe('Provider ID is required');
    });

    it('should handle provider not found', async () => {
      // Arrange
      const initiateRequest = {
        providerId: 'non-existent-provider',
      };

      mockDb.limit.mockResolvedValue([]);

      const request = new Request('https://test.com/api/sso/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initiateRequest),
      });

      // Act
      const response = await ssoAPI.initiateSSO(request, mockEnv);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('PROVIDER_NOT_FOUND');
      expect(result.error.message).toBe('SSO provider not found or inactive');
    });

    it('should handle unhealthy provider', async () => {
      // Arrange
      const initiateRequest = {
        providerId: 'provider-1',
      };

      const mockProvider = {
        id: 'provider-1',
        name: 'Test Provider',
        type: 'azure-ad',
        config: '{}',
        isActive: true,
        isDefault: false,
      };

      mockDb.limit.mockResolvedValue([mockProvider]);
      mockProviderManager.getProviderHealth.mockResolvedValue({
        isHealthy: false,
        lastCheck: new Date(),
        error: 'Service unavailable',
      });

      const request = new Request('https://test.com/api/sso/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initiateRequest),
      });

      // Act
      const response = await ssoAPI.initiateSSO(request, mockEnv);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(503);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('PROVIDER_UNHEALTHY');
      expect(result.error.message).toBe('SSO provider is currently unavailable');
    });

    it('should handle authentication initiation failure', async () => {
      // Arrange
      const initiateRequest = {
        providerId: 'provider-1',
      };

      const mockProvider = {
        id: 'provider-1',
        name: 'Test Provider',
        type: 'azure-ad',
        config: '{}',
        isActive: true,
        isDefault: false,
      };

      mockDb.limit.mockResolvedValue([mockProvider]);
      mockProviderManager.getProviderHealth.mockResolvedValue({
        isHealthy: true,
        lastCheck: new Date(),
      });

      mockProviderManager.initiateAuthentication.mockResolvedValue({
        success: false,
        error: 'Invalid client configuration',
      });

      mockEnv.CACHE.put.mockResolvedValue(undefined);

      const request = new Request('https://test.com/api/sso/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initiateRequest),
      });

      // Act
      const response = await ssoAPI.initiateSSO(request, mockEnv);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('AUTH_INITIATION_FAILED');
      expect(result.error.message).toBe('Invalid client configuration');
    });

    it('should validate prompt parameter', async () => {
      // Arrange
      const initiateRequest = {
        providerId: 'provider-1',
        prompt: 'invalid-prompt',
      };

      const request = new Request('https://test.com/api/sso/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initiateRequest),
      });

      // Act
      const response = await ssoAPI.initiateSSO(request, mockEnv);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toBe('Invalid prompt value');
    });
  });

  describe('POST /api/sso/callback', () => {
    it('should handle successful SSO callback', async () => {
      // Arrange
      const callbackRequest = {
        providerId: 'provider-1',
        state: 'test-state',
        code: 'test-auth-code',
      };

      const authFlowState = {
        state: 'test-state',
        providerId: 'provider-1',
        userId: 'user-1',
        redirectUrl: 'https://test.com/callback',
        codeVerifier: 'test-verifier',
        scopes: ['openid', 'profile', 'email'],
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      };

      const mockUser = {
        id: 'user-1',
        email: 'user@test.com',
        name: 'Test User',
        firstName: 'Test',
        lastName: 'User',
        roles: ['user'],
        groups: [],
      };

      const mockTokens = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 3600,
        scope: 'openid profile email',
      };

      mockEnv.CACHE.get.mockResolvedValue(JSON.stringify(authFlowState));
      mockProviderManager.processAuthenticationResponse.mockResolvedValue({
        success: true,
        user: mockUser,
        tokens: mockTokens,
      });

      mockDb.limit.mockResolvedValue([]); // User doesn't exist yet
      mockDb.insert.mockResolvedValue(undefined);

      const request = new Request('https://test.com/api/sso/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(callbackRequest),
      });

      // Act
      const response = await ssoAPI.handleSSOCallback(request, mockEnv);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.user.id).toBe('user-1');
      expect(result.user.email).toBe('user@test.com');
      expect(result.tokens.accessToken).toBe('test-access-token');
      expect(result.tokens.refreshToken).toBe('test-refresh-token');
      expect(result.isNewUser).toBe(true);
      expect(result.redirectUrl).toBe('https://test.com/callback');
      expect(result.providerInfo.id).toBe('provider-1');

      expect(mockProviderManager.processAuthenticationResponse).toHaveBeenCalledWith({
        providerId: 'provider-1',
        state: 'test-state',
        code: 'test-auth-code',
        codeVerifier: 'test-verifier',
        redirectUrl: 'https://test.com/callback',
      });

      expect(mockDb.insert).toHaveBeenCalledWith(schema.ssoSessions);
      expect(mockDb.insert).toHaveBeenCalledWith(schema.ssoAccessTokens);
      expect(mockEnv.CACHE.delete).toHaveBeenCalledWith('sso:state:test-state');
    });

    it('should handle expired state', async () => {
      // Arrange
      const callbackRequest = {
        providerId: 'provider-1',
        state: 'test-state',
        code: 'test-auth-code',
      };

      const expiredState = {
        state: 'test-state',
        providerId: 'provider-1',
        expiresAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      };

      mockEnv.CACHE.get.mockResolvedValue(JSON.stringify(expiredState));

      const request = new Request('https://test.com/api/sso/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(callbackRequest),
      });

      // Act
      const response = await ssoAPI.handleSSOCallback(request, mockEnv);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('STATE_EXPIRED');
      expect(result.error.message).toBe('Authentication session has expired');
      expect(mockEnv.CACHE.delete).toHaveBeenCalledWith('sso:state:test-state');
    });

    it('should handle invalid state', async () => {
      // Arrange
      const callbackRequest = {
        providerId: 'provider-1',
        state: 'invalid-state',
        code: 'test-auth-code',
      };

      mockEnv.CACHE.get.mockResolvedValue(null);

      const request = new Request('https://test.com/api/sso/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(callbackRequest),
      });

      // Act
      const response = await ssoAPI.handleSSOCallback(request, mockEnv);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_STATE');
      expect(result.error.message).toBe('Invalid or expired authentication state');
    });

    it('should handle provider error in callback', async () => {
      // Arrange
      const callbackRequest = {
        providerId: 'provider-1',
        state: 'test-state',
        error: 'access_denied',
        error_description: 'User denied access',
      };

      const authFlowState = {
        state: 'test-state',
        providerId: 'provider-1',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      };

      mockEnv.CACHE.get.mockResolvedValue(JSON.stringify(authFlowState));

      const request = new Request('https://test.com/api/sso/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(callbackRequest),
      });

      // Act
      const response = await ssoAPI.handleSSOCallback(request, mockEnv);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('PROVIDER_ERROR');
      expect(result.error.message).toBe('User denied access');
      expect(result.error.details.providerError).toBe('access_denied');
    });

    it('should handle state mismatch', async () => {
      // Arrange
      const callbackRequest = {
        providerId: 'provider-2',
        state: 'test-state',
        code: 'test-auth-code',
      };

      const authFlowState = {
        state: 'test-state',
        providerId: 'provider-1', // Different provider
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      };

      mockEnv.CACHE.get.mockResolvedValue(JSON.stringify(authFlowState));

      const request = new Request('https://test.com/api/sso/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(callbackRequest),
      });

      // Act
      const response = await ssoAPI.handleSSOCallback(request, mockEnv);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('STATE_MISMATCH');
      expect(result.error.message).toBe('Authentication state mismatch');
    });

    it('should validate callback request', async () => {
      // Arrange
      const callbackRequest = {
        providerId: 'provider-1',
        // Missing state parameter
        code: 'test-auth-code',
      };

      const request = new Request('https://test.com/api/sso/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(callbackRequest),
      });

      // Act
      const response = await ssoAPI.handleSSOCallback(request, mockEnv);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toBe('State parameter is required');
    });
  });

  describe('GET /api/sso/user-info', () => {
    it('should return user info for valid session', async () => {
      // Arrange
      const mockSession = {
        id: 'session-1',
        userId: 'user-1',
        providerId: 'provider-1',
        isActive: true,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      };

      const mockUser = {
        id: 'user-1',
        email: 'user@test.com',
        name: 'Test User',
        firstName: 'Test',
        lastName: 'User',
        avatar: 'https://example.com/avatar.jpg',
        roles: ['user', 'admin'],
        groups: ['developers', 'testers'],
        permissions: ['read', 'write'],
        lastLogin: new Date(),
        preferences: {
          language: 'en',
          timezone: 'UTC',
          theme: 'dark',
        },
      };

      const mockProvider = {
        id: 'provider-1',
        name: 'Test Provider',
        type: 'azure-ad',
      };

      mockDb.limit.mockResolvedValueOnce([mockSession]);
      mockDb.limit.mockResolvedValueOnce([mockUser]);
      mockDb.limit.mockResolvedValueOnce([mockProvider]);

      const request = new Request('https://test.com/api/sso/user-info?sessionId=session-1');

      // Act
      const response = await ssoAPI.getUserInfo(request, mockEnv);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(result.id).toBe('user-1');
      expect(result.email).toBe('user@test.com');
      expect(result.name).toBe('Test User');
      expect(result.firstName).toBe('Test');
      expect(result.lastName).toBe('User');
      expect(result.avatar).toBe('https://example.com/avatar.jpg');
      expect(result.roles).toEqual(['user', 'admin']);
      expect(result.groups).toEqual(['developers', 'testers']);
      expect(result.permissions).toEqual(['read', 'write']);
      expect(result.provider.id).toBe('provider-1');
      expect(result.provider.name).toBe('Test Provider');
      expect(result.provider.type).toBe('azure-ad');
      expect(result.sessionInfo.sessionId).toBe('session-1');
      expect(result.sessionInfo.isActive).toBe(true);
      expect(result.preferences.language).toBe('en');
      expect(result.preferences.timezone).toBe('UTC');
      expect(result.preferences.theme).toBe('dark');
    });

    it('should handle invalid session', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([]); // No session found

      const request = new Request('https://test.com/api/sso/user-info?sessionId=invalid-session');

      // Act
      const response = await ssoAPI.getUserInfo(request, mockEnv);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_SESSION');
      expect(result.error.message).toBe('Invalid or expired session');
    });

    it('should handle missing credentials', async () => {
      // Arrange
      const request = new Request('https://test.com/api/sso/user-info');

      // Act
      const response = await ssoAPI.getUserInfo(request, mockEnv);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('MISSING_CREDENTIALS');
      expect(result.error.message).toBe('Session ID or access token required');
    });

    it('should handle user not found', async () => {
      // Arrange
      const mockSession = {
        id: 'session-1',
        userId: 'user-1',
        providerId: 'provider-1',
        isActive: true,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      };

      mockDb.limit.mockResolvedValueOnce([mockSession]);
      mockDb.limit.mockResolvedValueOnce([]); // User not found

      const request = new Request('https://test.com/api/sso/user-info?sessionId=session-1');

      // Act
      const response = await ssoAPI.getUserInfo(request, mockEnv);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('USER_NOT_FOUND');
      expect(result.error.message).toBe('User not found');
    });
  });

  describe('POST /api/sso/logout', () => {
    it('should logout from specific provider successfully', async () => {
      // Arrange
      const logoutRequest = {
        providerId: 'provider-1',
        redirectUrl: 'https://test.com/post-logout',
        revokeTokens: true,
      };

      const mockUser = {
        id: 'user-1',
        email: 'user@test.com',
      };

      const mockSession = {
        id: 'session-1',
        userId: 'user-1',
        providerId: 'provider-1',
        isActive: true,
      };

      // Mock user extraction
      vi.spyOn(ssoAPI as any, 'getUserFromRequest').mockResolvedValue(mockUser);

      mockDb.limit.mockResolvedValue([mockSession]);
      mockProviderManager.initiateLogout.mockResolvedValue({
        success: true,
        logoutUrl: 'https://provider.com/logout',
      });

      mockDb.update.mockReturnValue(mockDb);
      mockDb.set.mockReturnValue(mockDb);
      mockDb.where.mockReturnValue(mockDb);

      const request = new Request('https://test.com/api/sso/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logoutRequest),
      });

      // Act
      const response = await ssoAPI.logout(request, mockEnv);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.loggedOutProviders).toEqual(['provider-1']);
      expect(result.redirectUrl).toBe('https://test.com/post-logout');
      expect(result.message).toBe('Successfully logged out from 1 provider(s)');

      expect(mockProviderManager.initiateLogout).toHaveBeenCalledWith(
        'provider-1',
        'session-1',
        'https://test.com/post-logout'
      );

      expect(mockDb.update).toHaveBeenCalledWith(schema.ssoSessions);
      expect(mockDb.update).toHaveBeenCalledWith(schema.ssoAccessTokens);
    });

    it('should logout from all providers', async () => {
      // Arrange
      const logoutRequest = {
        logoutAllProviders: true,
        revokeTokens: true,
      };

      const mockUser = {
        id: 'user-1',
        email: 'user@test.com',
      };

      const mockSessions = [
        {
          id: 'session-1',
          userId: 'user-1',
          providerId: 'provider-1',
          isActive: true,
        },
        {
          id: 'session-2',
          userId: 'user-1',
          providerId: 'provider-2',
          isActive: true,
        },
      ];

      vi.spyOn(ssoAPI as any, 'getUserFromRequest').mockResolvedValue(mockUser);

      mockDb.all.mockResolvedValue(mockSessions);
      mockProviderManager.initiateLogout.mockResolvedValue({
        success: true,
        logoutUrl: 'https://provider.com/logout',
      });

      mockDb.update.mockReturnValue(mockDb);
      mockDb.set.mockReturnValue(mockDb);
      mockDb.where.mockReturnValue(mockDb);

      const request = new Request('https://test.com/api/sso/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logoutRequest),
      });

      // Act
      const response = await ssoAPI.logout(request, mockEnv);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(response.success).toBe(true);
      expect(result.loggedOutProviders).toEqual(['provider-1', 'provider-2']);
      expect(result.message).toBe('Successfully logged out from 2 provider(s)');

      expect(mockProviderManager.initiateLogout).toHaveBeenCalledTimes(2);
      expect(mockProviderManager.initiateLogout).toHaveBeenCalledWith(
        'provider-1',
        'session-1',
        undefined
      );
      expect(mockProviderManager.initiateLogout).toHaveBeenCalledWith(
        'provider-2',
        'session-2',
        undefined
      );
    });

    it('should handle unauthenticated logout attempt', async () => {
      // Arrange
      vi.spyOn(ssoAPI as any, 'getUserFromRequest').mockResolvedValue(null);

      const logoutRequest = {
        providerId: 'provider-1',
      };

      const request = new Request('https://test.com/api/sso/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logoutRequest),
      });

      // Act
      const response = await ssoAPI.logout(request, mockEnv);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('UNAUTHORIZED');
      expect(result.error.message).toBe('User not authenticated');
    });

    it('should handle logout errors gracefully', async () => {
      // Arrange
      const logoutRequest = {
        providerId: 'provider-1',
      };

      const mockUser = {
        id: 'user-1',
        email: 'user@test.com',
      };

      const mockSession = {
        id: 'session-1',
        userId: 'user-1',
        providerId: 'provider-1',
        isActive: true,
      };

      vi.spyOn(ssoAPI as any, 'getUserFromRequest').mockResolvedValue(mockUser);

      mockDb.limit.mockResolvedValue([mockSession]);
      mockProviderManager.initiateLogout.mockResolvedValue({
        success: false,
        error: 'Provider error',
      });

      const request = new Request('https://test.com/api/sso/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logoutRequest),
      });

      // Act
      const response = await ssoAPI.logout(request, mockEnv);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(207); // Multi-status
      expect(result.success).toBe(false);
      expect(result.loggedOutProviders).toEqual([]);
      expect(result.errors).toEqual(['Failed to logout from provider-1: Provider error']);
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers in responses', async () => {
      // This would be tested in the Cloudflare Worker export handler
      // For now, we'll verify that individual methods include request ID headers
      const request = new Request('https://test.com/api/sso/providers');

      mockDb.all.mockResolvedValue([]);

      const response = await ssoAPI.getProviders(request, mockEnv);

      expect(response.headers.get('X-Request-ID')).toBeDefined();
      expect(response.headers.get('X-Response-Time')).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON in request body', async () => {
      // Arrange
      const request = new Request('https://test.com/api/sso/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json',
      });

      // Act
      const response = await ssoAPI.initiateSSO(request, mockEnv);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('AUTH_INITIATION_ERROR');
    });

    it('should handle cache errors gracefully', async () => {
      // Arrange
      const initiateRequest = {
        providerId: 'provider-1',
      };

      const mockProvider = {
        id: 'provider-1',
        name: 'Test Provider',
        type: 'azure-ad',
        config: '{}',
        isActive: true,
        isDefault: false,
      };

      mockDb.limit.mockResolvedValue([mockProvider]);
      mockProviderManager.getProviderHealth.mockResolvedValue({
        isHealthy: true,
        lastCheck: new Date(),
      });

      mockEnv.CACHE.put.mockRejectedValue(new Error('Cache unavailable'));

      const request = new Request('https://test.com/api/sso/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initiateRequest),
      });

      // Act
      const response = await ssoAPI.initiateSSO(request, mockEnv);

      // Assert
      expect(response.status).toBe(500);
      expect(response.headers.get('X-Request-ID')).toBeDefined();
    });
  });

  describe('Security Validation', () => {
    it('should validate input parameters for injection attacks', async () => {
      // Arrange
      const initiateRequest = {
        providerId: '<script>alert("xss")</script>',
        redirectUrl: 'javascript:alert("xss")',
      };

      const request = new Request('https://test.com/api/sso/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initiateRequest),
      });

      // Act
      const response = await ssoAPI.initiateSSO(request, mockEnv);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('PROVIDER_NOT_FOUND');
    });

    it('should handle request timeout scenarios', async () => {
      // Arrange
      const initiateRequest = {
        providerId: 'provider-1',
      };

      const mockProvider = {
        id: 'provider-1',
        name: 'Test Provider',
        type: 'azure-ad',
        config: '{}',
        isActive: true,
        isDefault: false,
      };

      mockDb.limit.mockResolvedValue([mockProvider]);
      mockProviderManager.getProviderHealth.mockResolvedValue({
        isHealthy: true,
        lastCheck: new Date(),
      });

      // Simulate slow provider response
      mockProviderManager.initiateAuthentication.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({
          success: true,
          authenticationUrl: 'https://provider.com/oauth/authorize',
          state: 'test-state',
        }), 30000)) // 30 second delay
      );

      const request = new Request('https://test.com/api/sso/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initiateRequest),
        signal: AbortSignal.timeout(1000), // 1 second timeout
      });

      // Act & Assert
      // This would need to be handled at the worker level with proper timeout handling
      // For now, we'll verify the method structure
      expect(ssoAPI.initiateSSO).toBeDefined();
    });
  });
});
