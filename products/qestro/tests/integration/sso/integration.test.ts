import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SSOProviderManager, SSOProviderType } from '../../../src/services/sso/provider-manager';
import { AzureADProvider } from '../../../src/services/sso/providers/azure-ad-provider';
import { OktaProvider } from '../../../src/services/sso/providers/okta-provider';

// Mock fetch for integration tests
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('SSO Integration Tests', () => {
  let manager: SSOProviderManager;
  let mockAuditLogger: jest.MockedFunction<any>;

  beforeEach(() => {
    mockAuditLogger = jest.fn();
    manager = new SSOProviderManager({
      auditLogger: mockAuditLogger,
    });

    // Mock window.location
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

  describe('End-to-End Authentication Flow', () => {
    describe('Azure AD Integration', () => {
      beforeEach(async () => {
        // Mock Azure AD OIDC discovery
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            issuer: 'https://login.microsoftonline.com/test-tenant-id/v2.0',
            authorization_endpoint: 'https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/authorize',
            token_endpoint: 'https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/token',
            userinfo_endpoint: 'https://graph.microsoft.com/oidc/userinfo',
            jwks_uri: 'https://login.microsoftonline.com/test-tenant-id/discovery/v2.0/keys',
            end_session_endpoint: 'https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/logout',
          }),
        });
      });

      it('should complete full Azure AD authentication flow', async () => {
        // 1. Register Azure AD provider
        const azureConfig = {
          type: SSOProviderType.AZURE_AD as const,
          clientId: 'azure-client-id',
          clientSecret: 'azure-client-secret',
          redirectUri: 'https://test.qestro.com/auth/callback',
          tenantId: 'test-tenant-id',
          scope: 'openid profile email User.Read',
        };

        await manager.registerProvider('azure-ad', azureConfig);

        // 2. Initiate authentication
        const authResult = await manager.authenticate('azure-ad');

        expect(authResult.redirectUrl).toContain('login.microsoftonline.com');
        expect(authResult.state).toBeDefined();

        // 3. Mock token exchange
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'azure-access-token',
            refresh_token: 'azure-refresh-token',
            id_token: 'azure-id-token',
            token_type: 'Bearer',
            expires_in: 3600,
          }),
        });

        // 4. Handle callback
        const callbackResult = await manager.handleCallback('azure-ad', {
          code: 'azure-auth-code',
          state: authResult.state,
        });

        expect(callbackResult.accessToken).toBe('azure-access-token');
        expect(callbackResult.refreshToken).toBe('azure-refresh-token');
        expect(callbackResult.idToken).toBe('azure-id-token');

        // 5. Get user information
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
          }),
        });

        const userInfo = await manager.getUserInfo('azure-ad', callbackResult);

        expect(userInfo.id).toBe('user-123');
        expect(userInfo.name).toBe('Test User');
        expect(userInfo.email).toBe('test.user@company.com');
        expect(userInfo.attributes.jobTitle).toBe('Software Engineer');

        // 6. Verify audit logging
        expect(mockAuditLogger).toHaveBeenCalledWith({
          event: 'provider_registered',
          provider: 'azure-ad',
          providerType: SSOProviderType.AZURE_AD,
          timestamp: expect.any(String),
        });

        expect(mockAuditLogger).toHaveBeenCalledWith({
          event: 'authentication_initiated',
          provider: 'azure-ad',
          providerType: SSOProviderType.AZURE_AD,
          timestamp: expect.any(String),
        });

        expect(mockAuditLogger).toHaveBeenCalledWith({
          event: 'authentication_completed',
          provider: 'azure-ad',
          providerType: SSOProviderType.AZURE_AD,
          userId: 'user-123',
          timestamp: expect.any(String),
        });
      });

      it('should handle token refresh flow', async () => {
        // Register and initialize provider
        const azureConfig = {
          type: SSOProviderType.AZURE_AD as const,
          clientId: 'azure-client-id',
          clientSecret: 'azure-client-secret',
          redirectUri: 'https://test.qestro.com/auth/callback',
          tenantId: 'test-tenant-id',
        };

        await manager.registerProvider('azure-ad', azureConfig);

        // Mock token refresh
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'new-azure-access-token',
            refresh_token: 'new-azure-refresh-token',
            token_type: 'Bearer',
            expires_in: 3600,
          }),
        });

        const refreshedTokens = await manager.refreshToken('azure-ad', {
          accessToken: 'old-access-token',
          refreshToken: 'old-refresh-token',
          tokenType: 'Bearer',
          expiresIn: 100,
        });

        expect(refreshedTokens.accessToken).toBe('new-azure-access-token');
        expect(refreshedTokens.refreshToken).toBe('new-azure-refresh-token');
      });
    });

    describe('Okta Integration', () => {
      beforeEach(async () => {
        // Mock Okta OIDC discovery
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            issuer: 'https://test-org.okta.com/oauth2/default',
            authorization_endpoint: 'https://test-org.okta.com/oauth2/default/v1/authorize',
            token_endpoint: 'https://test-org.okta.com/oauth2/default/v1/token',
            userinfo_endpoint: 'https://test-org.okta.com/oauth2/default/v1/userinfo',
            jwks_uri: 'https://test-org.okta.com/oauth2/default/v1/keys',
            end_session_endpoint: 'https://test-org.okta.com/oauth2/default/v1/logout',
          }),
        });
      });

      it('should complete full Okta authentication flow', async () => {
        // 1. Register Okta provider
        const oktaConfig = {
          type: SSOProviderType.OKTA as const,
          clientId: 'okta-client-id',
          clientSecret: 'okta-client-secret',
          redirectUri: 'https://test.qestro.com/auth/callback',
          domain: 'test-org.okta.com',
          scope: 'openid profile email groups',
        };

        await manager.registerProvider('okta', oktaConfig);

        // 2. Initiate authentication
        const authResult = await manager.authenticate('okta');

        expect(authResult.redirectUrl).toContain('test-org.okta.com');
        expect(authResult.state).toBeDefined();

        // 3. Mock token exchange
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'okta-access-token',
            refresh_token: 'okta-refresh-token',
            id_token: 'okta-id-token',
            token_type: 'Bearer',
            expires_in: 3600,
          }),
        });

        // 4. Handle callback
        const callbackResult = await manager.handleCallback('okta', {
          code: 'okta-auth-code',
          state: authResult.state,
        });

        expect(callbackResult.accessToken).toBe('okta-access-token');

        // 5. Get user information with groups
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              sub: 'user-456',
              name: 'Okta User',
              given_name: 'Okta',
              family_name: 'User',
              email: 'okta.user@company.com',
              preferred_username: 'okta.user@company.com',
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              groups: ['Everyone', 'Developers', 'QA-Team'],
            }),
          });

        const userInfo = await manager.getUserInfo('okta', callbackResult);

        expect(userInfo.id).toBe('user-456');
        expect(userInfo.name).toBe('Okta User');
        expect(userInfo.email).toBe('okta.user@company.com');
        expect(userInfo.groups).toEqual(['Everyone', 'Developers', 'QA-Team']);
      });
    });
  });

  describe('Multi-Provider Management', () => {
    it('should manage multiple providers simultaneously', async () => {
      // Mock discovery for both providers
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            issuer: 'https://login.microsoftonline.com/tenant1/v2.0',
            authorization_endpoint: 'https://login.microsoftonline.com/tenant1/oauth2/v2.0/authorize',
            token_endpoint: 'https://login.microsoftonline.com/tenant1/oauth2/v2.0/token',
            userinfo_endpoint: 'https://graph.microsoft.com/oidc/userinfo',
            jwks_uri: 'https://login.microsoftonline.com/tenant1/discovery/v2.0/keys',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            issuer: 'https://test-org.okta.com/oauth2/default',
            authorization_endpoint: 'https://test-org.okta.com/oauth2/default/v1/authorize',
            token_endpoint: 'https://test-org.okta.com/oauth2/default/v1/token',
            userinfo_endpoint: 'https://test-org.okta.com/oauth2/default/v1/userinfo',
            jwks_uri: 'https://test-org.okta.com/oauth2/default/v1/keys',
          }),
        });

      // Register both providers
      const azureConfig = {
        type: SSOProviderType.AZURE_AD as const,
        clientId: 'azure-client',
        clientSecret: 'azure-secret',
        redirectUri: 'https://test.qestro.com/auth/callback',
        tenantId: 'tenant1',
      };

      const oktaConfig = {
        type: SSOProviderType.OKTA as const,
        clientId: 'okta-client',
        clientSecret: 'okta-secret',
        redirectUri: 'https://test.qestro.com/auth/callback',
        domain: 'test-org.okta.com',
      };

      await manager.registerProvider('azure', azureConfig);
      await manager.registerProvider('okta', oktaConfig);

      // Verify both providers are available
      const providers = manager.getAvailableProviders();
      expect(providers).toContain('azure');
      expect(providers).toContain('okta');
      expect(providers).toHaveLength(2);

      // Check health of all providers
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      const healthReport = await manager.checkAllProvidersHealth();
      expect(healthReport.providers).toHaveLength(2);
      expect(healthReport.overallStatus).toBe('healthy');
    });
  });

  describe('Error Scenarios and Recovery', () => {
    it('should handle authentication failures gracefully', async () => {
      // Register provider
      const azureConfig = {
        type: SSOProviderType.AZURE_AD as const,
        clientId: 'azure-client',
        clientSecret: 'azure-secret',
        redirectUri: 'https://test.qestro.com/auth/callback',
        tenantId: 'test-tenant',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          issuer: 'https://login.microsoftonline.com/test-tenant/v2.0',
          authorization_endpoint: 'https://login.microsoftonline.com/test-tenant/oauth2/v2.0/authorize',
          token_endpoint: 'https://login.microsoftonline.com/test-tenant/oauth2/v2.0/token',
          userinfo_endpoint: 'https://graph.microsoft.com/oidc/userinfo',
          jwks_uri: 'https://login.microsoftonline.com/test-tenant/discovery/v2.0/keys',
        }),
      });

      await manager.registerProvider('azure', azureConfig);

      // Mock token exchange failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid authorization code',
      });

      const authResult = await manager.authenticate('azure');

      await expect(
        manager.handleCallback('azure', { code: 'invalid-code', state: authResult.state })
      ).rejects.toThrow();

      // Verify error audit log
      expect(mockAuditLogger).toHaveBeenCalledWith({
        event: 'authentication_error',
        provider: 'azure',
        providerType: SSOProviderType.AZURE_AD,
        error: expect.any(String),
        timestamp: expect.any(String),
      });
    });

    it('should handle provider unavailability', async () => {
      // Register provider with mock that fails initialization
      const azureConfig = {
        type: SSOProviderType.AZURE_AD as const,
        clientId: 'azure-client',
        clientSecret: 'azure-secret',
        redirectUri: 'https://test.qestro.com/auth/callback',
        tenantId: 'test-tenant',
      };

      // Mock OIDC discovery failure
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(
        manager.registerProvider('azure', azureConfig)
      ).rejects.toThrow();

      // Verify provider is not registered
      const providers = manager.getAvailableProviders();
      expect(providers).not.toContain('azure');
    });
  });

  describe('Security Validation', () => {
    it('should validate redirect URLs properly', async () => {
      const azureConfig = {
        type: SSOProviderType.AZURE_AD as const,
        clientId: 'azure-client',
        clientSecret: 'azure-secret',
        redirectUri: 'https://malicious.com/callback', // Malicious URL
        tenantId: 'test-tenant',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          issuer: 'https://login.microsoftonline.com/test-tenant/v2.0',
        }),
      });

      await expect(
        manager.registerProvider('azure', azureConfig)
      ).rejects.toThrow('Invalid redirect URI');
    });

    it('should handle CSRF protection with state parameters', async () => {
      const azureConfig = {
        type: SSOProviderType.AZURE_AD as const,
        clientId: 'azure-client',
        clientSecret: 'azure-secret',
        redirectUri: 'https://test.qestro.com/auth/callback',
        tenantId: 'test-tenant',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          issuer: 'https://login.microsoftonline.com/test-tenant/v2.0',
          authorization_endpoint: 'https://login.microsoftonline.com/test-tenant/oauth2/v2.0/authorize',
          token_endpoint: 'https://login.microsoftonline.com/test-tenant/oauth2/v2.0/token',
          userinfo_endpoint: 'https://graph.microsoft.com/oidc/userinfo',
          jwks_uri: 'https://login.microsoftonline.com/test-tenant/discovery/v2.0/keys',
        }),
      });

      await manager.registerProvider('azure', azureConfig);

      // Initiate authentication
      const authResult = await manager.authenticate('azure');

      // Try callback with wrong state
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'access-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      });

      await expect(
        manager.handleCallback('azure', {
          code: 'auth-code',
          state: 'wrong-state', // CSRF attempt
        })
      ).rejects.toThrow('Invalid state parameter');

      // Verify security audit log
      expect(mockAuditLogger).toHaveBeenCalledWith({
        event: 'security_violation',
        provider: 'azure',
        providerType: SSOProviderType.AZURE_AD,
        violation: 'Invalid state parameter',
        timestamp: expect.any(String),
      });
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent authentication requests', async () => {
      const azureConfig = {
        type: SSOProviderType.AZURE_AD as const,
        clientId: 'azure-client',
        clientSecret: 'azure-secret',
        redirectUri: 'https://test.qestro.com/auth/callback',
        tenantId: 'test-tenant',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          issuer: 'https://login.microsoftonline.com/test-tenant/v2.0',
          authorization_endpoint: 'https://login.microsoftonline.com/test-tenant/oauth2/v2.0/authorize',
          token_endpoint: 'https://login.microsoftonline.com/test-tenant/oauth2/v2.0/token',
          userinfo_endpoint: 'https://graph.microsoft.com/oidc/userinfo',
          jwks_uri: 'https://login.microsoftonline.com/test-tenant/discovery/v2.0/keys',
        }),
      });

      await manager.registerProvider('azure', azureConfig);

      // Initiate multiple concurrent authentication requests
      const concurrentAuth = Promise.all(
        Array.from({ length: 10 }, () => manager.authenticate('azure'))
      );

      const results = await concurrentAuth;

      // All requests should succeed
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.redirectUrl).toBeDefined();
        expect(result.state).toBeDefined();
        expect(result.state).not.toBe(results[0].state); // States should be unique
      });
    });
  });

  describe('Provider Discovery and Suggestion', () => {
    it('should suggest correct provider based on email domain', () => {
      const suggestions = manager.suggestProvider('user@company.onmicrosoft.com');
      expect(suggestions).toContain(SSOProviderType.AZURE_AD);

      const oktaSuggestions = manager.suggestProvider('user@company.okta.com');
      expect(oktaSuggestions).toContain(SSOProviderType.OKTA);
    });

    it('should return provider metadata for discovery', async () => {
      const azureConfig = {
        type: SSOProviderType.AZURE_AD as const,
        clientId: 'azure-client',
        clientSecret: 'azure-secret',
        redirectUri: 'https://test.qestro.com/auth/callback',
        tenantId: 'test-tenant',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          issuer: 'https://login.microsoftonline.com/test-tenant/v2.0',
          authorization_endpoint: 'https://login.microsoftonline.com/test-tenant/oauth2/v2.0/authorize',
          token_endpoint: 'https://login.microsoftonline.com/test-tenant/oauth2/v2.0/token',
          userinfo_endpoint: 'https://graph.microsoft.com/oidc/userinfo',
          jwks_uri: 'https://login.microsoftonline.com/test-tenant/discovery/v2.0/keys',
          scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
          response_types_supported: ['code', 'id_token'],
          grant_types_supported: ['authorization_code', 'refresh_token'],
        }),
      });

      await manager.registerProvider('azure', azureConfig);

      const metadata = await manager.getProviderMetadata('azure');

      expect(metadata.issuer).toContain('login.microsoftonline.com');
      expect(metadata.supportedScopes).toContain('openid');
      expect(metadata.supportedResponseTypes).toContain('code');
      expect(metadata.providerFeatures.supportsOIDC).toBe(true);
    });
  });
});
