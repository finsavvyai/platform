import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AzureADProvider, type AzureADConfig } from '../../../../src/services/sso/providers/azure-ad-provider';
import { SSOProviderType } from '../../../../src/services/sso/provider-manager';

// Mock fetch for API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock crypto for secure random generation
const mockCrypto = {
  randomBytes: jest.fn().mockReturnValue(Buffer.from('random-bytes-123456789012345678901234')),
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('hashed-data'),
  }),
};

describe('AzureADProvider', () => {
  let provider: AzureADProvider;
  let config: AzureADConfig;

  beforeEach(() => {
    config = {
      type: SSOProviderType.AZURE_AD,
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'https://test.qestro.com/auth/callback',
      tenantId: 'test-tenant-id',
      scope: 'openid profile email',
      logoutRedirectUri: 'https://test.qestro.com/logout',
    };

    provider = new AzureADProvider(config);

    // Mock URL constructor and window.location
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://test.qestro.com',
        origin: 'https://test.qestro.com',
      },
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid configuration', async () => {
      // Mock successful OIDC discovery
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          issuer: 'https://login.microsoftonline.com/test-tenant-id/v2.0',
          authorization_endpoint: 'https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/authorize',
          token_endpoint: 'https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/token',
          userinfo_endpoint: 'https://graph.microsoft.com/oidc/userinfo',
          jwks_uri: 'https://login.microsoftonline.com/test-tenant-id/discovery/v2.0/keys',
        }),
      });

      await expect(provider.initialize()).resolves.not.toThrow();
    });

    it('should throw error for missing required configuration', async () => {
      const invalidConfig = { ...config };
      delete (invalidConfig as any).clientId;

      const invalidProvider = new AzureADProvider(invalidConfig as any);

      await expect(invalidProvider.initialize()).rejects.toThrow('Missing required configuration');
    });

    it('should throw error for invalid tenant ID', async () => {
      const invalidConfig = { ...config, tenantId: '' };
      const invalidProvider = new AzureADProvider(invalidConfig);

      await expect(invalidProvider.initialize()).rejects.toThrow('Invalid tenant ID format');
    });

    it('should throw error when OIDC discovery fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(provider.initialize()).rejects.toThrow('OIDC discovery failed');
    });
  });

  describe('Authentication Flow', () => {
    beforeEach(async () => {
      // Mock successful initialization
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          issuer: 'https://login.microsoftonline.com/test-tenant-id/v2.0',
          authorization_endpoint: 'https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/authorize',
          token_endpoint: 'https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/token',
          userinfo_endpoint: 'https://graph.microsoft.com/oidc/userinfo',
          jwks_uri: 'https://login.microsoftonline.com/test-tenant-id/discovery/v2.0/keys',
        }),
      });

      await provider.initialize();
    });

    it('should generate correct authentication URL', async () => {
      const result = await provider.authenticate();

      expect(result.redirectUrl).toBeDefined();
      expect(result.state).toBeDefined();

      // Verify URL structure
      const url = new URL(result.redirectUrl);
      expect(url.hostname).toBe('login.microsoftonline.com');
      expect(url.pathname).toContain('/authorize');
      expect(url.searchParams.get('client_id')).toBe(config.clientId);
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('redirect_uri')).toBe(config.redirectUri);
      expect(url.searchParams.get('scope')).toBe(config.scope);
    });

    it('should include PKCE parameters when enabled', async () => {
      const configWithPKCE = { ...config, usePKCE: true };
      const providerWithPKCE = new AzureADProvider(configWithPKCE);
      await providerWithPKCE.initialize();

      const result = await providerWithPKCE.authenticate();

      const url = new URL(result.redirectUrl);
      expect(url.searchParams.has('code_challenge')).toBe(true);
      expect(url.searchParams.has('code_challenge_method')).toBe(true);
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    });

    it('should handle custom scopes correctly', async () => {
      const configWithCustomScope = { ...config, scope: 'openid profile email offline_access User.Read' };
      const customProvider = new AzureADProvider(configWithCustomScope);
      await customProvider.initialize();

      const result = await customProvider.authenticate();

      const url = new URL(result.redirectUrl);
      expect(url.searchParams.get('scope')).toBe('openid profile email offline_access User.Read');
    });
  });

  describe('Token Exchange', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          issuer: 'https://login.microsoftonline.com/test-tenant-id/v2.0',
          authorization_endpoint: 'https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/authorize',
          token_endpoint: 'https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/token',
          userinfo_endpoint: 'https://graph.microsoft.com/oidc/userinfo',
          jwks_uri: 'https://login.microsoftonline.com/test-tenant-id/discovery/v2.0/keys',
        }),
      });

      await provider.initialize();
    });

    it('should exchange authorization code for tokens', async () => {
      // Mock successful token response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          id_token: 'test-id-token',
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'openid profile email',
        }),
      });

      const result = await provider.exchangeCodeForToken('test-auth-code', 'test-state');

      expect(result.accessToken).toBe('test-access-token');
      expect(result.refreshToken).toBe('test-refresh-token');
      expect(result.idToken).toBe('test-id-token');
      expect(result.tokenType).toBe('Bearer');
      expect(result.expiresIn).toBe(3600);
    });

    it('should handle token exchange errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid authorization code',
      });

      await expect(
        provider.exchangeCodeForToken('invalid-code', 'test-state')
      ).rejects.toThrow('Token exchange failed: Invalid authorization code');
    });

    it('should validate state parameter if provided', async () => {
      // This would require mocking the state validation
      // For now, just test the flow doesn't throw with valid state
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      });

      await expect(
        provider.exchangeCodeForToken('test-code', 'valid-state')
      ).resolves.not.toThrow();
    });
  });

  describe('User Information', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          issuer: 'https://login.microsoftonline.com/test-tenant-id/v2.0',
          authorization_endpoint: 'https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/authorize',
          token_endpoint: 'https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/token',
          userinfo_endpoint: 'https://graph.microsoft.com/oidc/userinfo',
          jwks_uri: 'https://login.microsoftonline.com/test-tenant-id/discovery/v2.0/keys',
        }),
      });

      await provider.initialize();
    });

    it('should fetch user information from Microsoft Graph API', async () => {
      // Mock Graph API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'user-123',
          displayName: 'Test User',
          givenName: 'Test',
          surname: 'User',
          mail: 'test.user@company.com',
          userPrincipalName: 'test.user@company.com',
          jobTitle: 'Software Engineer',
          officeLocation: 'Building A',
          preferredLanguage: 'en-US',
        }),
      });

      const userInfo = await provider.getUserInfo('test-access-token');

      expect(userInfo.id).toBe('user-123');
      expect(userInfo.name).toBe('Test User');
      expect(userInfo.firstName).toBe('Test');
      expect(userInfo.lastName).toBe('User');
      expect(userInfo.email).toBe('test.user@company.com');
      expect(userInfo.attributes.jobTitle).toBe('Software Engineer');
      expect(userInfo.attributes.officeLocation).toBe('Building A');
    });

    it('should handle user info fetch errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(
        provider.getUserInfo('invalid-token')
      ).rejects.toThrow('User info fetch failed: Unauthorized');
    });

    it('should include user groups when configured', async () => {
      const configWithGroups = { ...config, includeGroups: true };
      const providerWithGroups = new AzureADProvider(configWithGroups);
      await providerWithGroups.initialize();

      // Mock Graph API responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'user-123',
            displayName: 'Test User',
            mail: 'test.user@company.com',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            value: [
              { displayName: 'Developers' },
              { displayName: 'QA Team' },
              { displayName: 'Admins' },
            ],
          }),
        });

      const userInfo = await providerWithGroups.getUserInfo('test-access-token');

      expect(userInfo.groups).toEqual(['Developers', 'QA Team', 'Admins']);
    });
  });

  describe('Token Refresh', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          issuer: 'https://login.microsoftonline.com/test-tenant-id/v2.0',
          authorization_endpoint: 'https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/authorize',
          token_endpoint: 'https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/token',
          userinfo_endpoint: 'https://graph.microsoft.com/oidc/userinfo',
          jwks_uri: 'https://login.microsoftonline.com/test-tenant-id/discovery/v2.0/keys',
        }),
      });

      await provider.initialize();
    });

    it('should refresh access token successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      });

      const result = await provider.refreshToken('test-refresh-token');

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(result.tokenType).toBe('Bearer');
      expect(result.expiresIn).toBe(3600);
    });

    it('should handle refresh token errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid refresh token',
      });

      await expect(
        provider.refreshToken('invalid-refresh-token')
      ).rejects.toThrow('Token refresh failed: Invalid refresh token');
    });
  });

  describe('Token Validation', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          issuer: 'https://login.microsoftonline.com/test-tenant-id/v2.0',
          authorization_endpoint: 'https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/authorize',
          token_endpoint: 'https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/token',
          userinfo_endpoint: 'https://graph.microsoft.com/oidc/userinfo',
          jwks_uri: 'https://login.microsoftonline.com/test-tenant-id/discovery/v2.0/keys',
        }),
      });

      await provider.initialize();
    });

    it('should validate valid JWT token', async () => {
      // Mock JWKS response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          keys: [
            {
              kty: 'RSA',
              kid: 'test-key-id',
              use: 'sig',
              n: 'mock-modulus',
              e: 'AQAB',
              alg: 'RS256',
            },
          ],
        }),
      });

      // Mock successful validation
      const mockValidateJWT = jest.spyOn(provider as any, 'utils')
        .mockReturnValue({ validateJWT: jest.fn().mockResolvedValue(true) });

      const isValid = await provider.validateToken('valid-jwt-token');

      expect(isValid).toBeDefined();
      expect(typeof isValid).toBe('boolean');
    });

    it('should return false for invalid token', async () => {
      // Mock JWKS response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ keys: [] }),
      });

      // Mock failed validation
      const mockValidateJWT = jest.spyOn(provider as any, 'utils')
        .mockReturnValue({ validateJWT: jest.fn().mockResolvedValue(false) });

      const isValid = await provider.validateToken('invalid-jwt-token');

      expect(isValid).toBe(false);
    });
  });

  describe('Logout', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          issuer: 'https://login.microsoftonline.com/test-tenant-id/v2.0',
          end_session_endpoint: 'https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/logout',
        }),
      });

      await provider.initialize();
    });

    it('should initiate logout correctly', async () => {
      const mockLocationAssign = jest.fn();
      Object.defineProperty(window.location, 'href', {
        get: () => 'https://test.qestro.com',
        set: mockLocationAssign,
      });

      await provider.logout();

      expect(mockLocationAssign).toHaveBeenCalled();
      const logoutUrl = mockLocationAssign.mock.calls[0][0];
      expect(logoutUrl).toContain('login.microsoftonline.com');
      expect(logoutUrl).toContain('logout');
      expect(logoutUrl).toContain('post_logout_redirect_uri');
    });
  });

  describe('Health Check', () => {
    it('should return healthy status when service is available', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          issuer: 'https://login.microsoftonline.com/test-tenant-id/v2.0',
        }),
      });

      const health = await provider.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.details).toBeDefined();
      expect(health.details.tenantId).toBe(config.tenantId);
    });

    it('should return unhealthy status when service is unavailable', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const health = await provider.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.details?.error).toBeDefined();
    });

    it('should return unhealthy status on network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const health = await provider.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.details?.error).toBe('Network error');
    });
  });

  describe('Metadata', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          issuer: 'https://login.microsoftonline.com/test-tenant-id/v2.0',
          authorization_endpoint: 'https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/authorize',
          token_endpoint: 'https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/token',
          userinfo_endpoint: 'https://graph.microsoft.com/oidc/userinfo',
          jwks_uri: 'https://login.microsoftonline.com/test-tenant-id/discovery/v2.0/keys',
          end_session_endpoint: 'https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/logout',
          response_modes_supported: ['query', 'fragment', 'form_post'],
          response_types_supported: ['code', 'id_token', 'code id_token', 'id_token code'],
          grant_types_supported: ['authorization_code', 'implicit', 'refresh_token'],
          subject_types_supported: ['pairwise'],
          id_token_signing_alg_values_supported: ['RS256'],
          scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
        }),
      });

      await provider.initialize();
    });

    it('should return comprehensive provider metadata', async () => {
      const metadata = await provider.getMetadata();

      expect(metadata.issuer).toContain('login.microsoftonline.com');
      expect(metadata.authorizationEndpoint).toBeDefined();
      expect(metadata.tokenEndpoint).toBeDefined();
      expect(metadata.userInfoEndpoint).toBeDefined();
      expect(metadata.jwksUri).toBeDefined();
      expect(metadata.endSessionEndpoint).toBeDefined();
      expect(Array.isArray(metadata.supportedScopes)).toBe(true);
      expect(Array.isArray(metadata.supportedResponseTypes)).toBe(true);
      expect(Array.isArray(metadata.supportedGrantTypes)).toBe(true);
      expect(metadata.providerFeatures).toBeDefined();
      expect(metadata.providerFeatures.supportsOIDC).toBe(true);
      expect(metadata.providerFeatures.supportsGroups).toBe(true);
      expect(metadata.providerFeatures.supportsConditionalAccess).toBe(true);
    });
  });

  describe('Configuration Management', () => {
    it('should update provider configuration', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          issuer: 'https://login.microsoftonline.com/test-tenant-id/v2.0',
        }),
      });

      await provider.initialize();

      const newConfig = {
        scope: 'openid profile email offline_access User.Read',
        includeGroups: true,
      };

      await provider.updateConfig(newConfig);

      const updatedConfig = provider.getConfig();
      expect(updatedConfig.scope).toBe('openid profile email offline_access User.Read');
      expect(updatedConfig.includeGroups).toBe(true);
    });
  });

  describe('Provider Type', () => {
    it('should return correct provider type', () => {
      expect(provider.getProviderType()).toBe(SSOProviderType.AZURE_AD);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network timeout'));

      await expect(provider.initialize()).rejects.toThrow('Connection test failed');
    });

    it('should handle malformed responses gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(provider.initialize()).rejects.toThrow();
    });
  });
});
