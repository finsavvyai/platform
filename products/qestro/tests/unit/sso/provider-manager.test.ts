import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SSOProviderManager, SSOProviderType, type SSOConfig } from '../../src/services/sso/provider-manager';

// Mock all provider implementations
jest.mock('../../src/services/sso/providers/azure-ad-provider');
jest.mock('../../src/services/sso/providers/okta-provider');
jest.mock('../../src/services/sso/providers/auth0-provider');
jest.mock('../../src/services/sso/providers/google-workspace-provider');
jest.mock('../../src/services/sso/providers/keycloak-provider');
jest.mock('../../src/services/sso/providers/saml-custom-provider');
jest.mock('../../src/services/sso/providers/oidc-custom-provider');

describe('SSOProviderManager', () => {
  let manager: SSOProviderManager;
  let mockAuditLogger: jest.MockedFunction<any>;

  beforeEach(() => {
    mockAuditLogger = jest.fn();
    manager = new SSOProviderManager({
      auditLogger: mockAuditLogger,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Provider Registration', () => {
    it('should register Azure AD provider correctly', async () => {
      const config: SSOConfig = {
        type: SSOProviderType.AZURE_AD,
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'https://test.qestro.com/auth/callback',
        tenantId: 'test-tenant-id',
      };

      await manager.registerProvider('test-azure', config);

      const providers = manager.getAvailableProviders();
      expect(providers).toContain('test-azure');

      const retrievedConfig = manager.getProviderConfig('test-azure');
      expect(retrievedConfig?.type).toBe(SSOProviderType.AZURE_AD);
    });

    it('should register multiple providers with different types', async () => {
      const azureConfig: SSOConfig = {
        type: SSOProviderType.AZURE_AD,
        clientId: 'azure-client',
        clientSecret: 'azure-secret',
        redirectUri: 'https://test.qestro.com/auth/callback',
        tenantId: 'tenant-123',
      };

      const oktaConfig: SSOConfig = {
        type: SSOProviderType.OKTA,
        clientId: 'okta-client',
        clientSecret: 'okta-secret',
        redirectUri: 'https://test.qestro.com/auth/callback',
        domain: 'okta-domain.okta.com',
      };

      await manager.registerProvider('azure-provider', azureConfig);
      await manager.registerProvider('okta-provider', oktaConfig);

      const providers = manager.getAvailableProviders();
      expect(providers).toHaveLength(2);
      expect(providers).toContain('azure-provider');
      expect(providers).toContain('okta-provider');
    });

    it('should throw error for duplicate provider names', async () => {
      const config: SSOConfig = {
        type: SSOProviderType.AZURE_AD,
        clientId: 'test-client',
        clientSecret: 'test-secret',
        redirectUri: 'https://test.qestro.com/auth/callback',
        tenantId: 'tenant-123',
      };

      await manager.registerProvider('test-provider', config);

      await expect(
        manager.registerProvider('test-provider', config)
      ).rejects.toThrow('Provider with name test-provider already exists');
    });

    it('should throw error for invalid provider type', async () => {
      const config = {
        type: 'invalid-type' as any,
        clientId: 'test-client',
        clientSecret: 'test-secret',
        redirectUri: 'https://test.qestro.com/auth/callback',
      };

      await expect(
        manager.registerProvider('test-provider', config)
      ).rejects.toThrow('Unsupported provider type');
    });
  });

  describe('Provider Discovery', () => {
    beforeEach(async () => {
      // Register test providers
      const azureConfig: SSOConfig = {
        type: SSOProviderType.AZURE_AD,
        clientId: 'azure-client',
        clientSecret: 'azure-secret',
        redirectUri: 'https://test.qestro.com/auth/callback',
        tenantId: 'tenant-123',
      };

      await manager.registerProvider('azure-provider', azureConfig);
    });

    it('should return list of available providers', () => {
      const providers = manager.getAvailableProviders();

      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
      expect(providers).toContain('azure-provider');
    });

    it('should return correct provider type', () => {
      const providerType = manager.getProviderType('azure-provider');

      expect(providerType).toBe(SSOProviderType.AZURE_AD);
    });

    it('should return undefined for non-existent provider', () => {
      const providerType = manager.getProviderType('non-existent');

      expect(providerType).toBeUndefined();
    });

    it('should return provider configuration', () => {
      const config = manager.getProviderConfig('azure-provider');

      expect(config).toBeDefined();
      expect(config?.type).toBe(SSOProviderType.AZURE_AD);
      expect(config?.clientId).toBe('azure-client');
    });

    it('should suggest provider based on email domain', () => {
      const suggestions = manager.suggestProvider('user@company.onmicrosoft.com');

      expect(suggestions).toContain(SSOProviderType.AZURE_AD);
    });
  });

  describe('Authentication Flow', () => {
    beforeEach(async () => {
      const config: SSOConfig = {
        type: SSOProviderType.AZURE_AD,
        clientId: 'test-client',
        clientSecret: 'test-secret',
        redirectUri: 'https://test.qestro.com/auth/callback',
        tenantId: 'tenant-123',
      };

      await manager.registerProvider('test-provider', config);
    });

    it('should initiate authentication flow', async () => {
      const result = await manager.authenticate('test-provider');

      expect(result).toBeDefined();
      expect(result.redirectUrl).toBeDefined();
      expect(result.state).toBeDefined();
      expect(typeof result.redirectUrl).toBe('string');
      expect(typeof result.state).toBe('string');
    });

    it('should handle authentication callback', async () => {
      const authData = {
        code: 'test-auth-code',
        state: 'test-state',
      };

      const tokenResponse = await manager.handleCallback('test-provider', authData);

      expect(tokenResponse).toBeDefined();
      expect(tokenResponse.accessToken).toBeDefined();
      expect(tokenResponse.tokenType).toBeDefined();
    });

    it('should get user information', async () => {
      const tokenResponse = {
        accessToken: 'test-access-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
      };

      const userInfo = await manager.getUserInfo('test-provider', tokenResponse);

      expect(userInfo).toBeDefined();
      expect(userInfo.id).toBeDefined();
      expect(userInfo.email).toBeDefined();
    });

    it('should refresh tokens', async () => {
      const tokenResponse = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
      };

      const refreshedTokens = await manager.refreshToken('test-provider', tokenResponse);

      expect(refreshedTokens).toBeDefined();
      expect(refreshedTokens.accessToken).toBeDefined();
      expect(refreshedTokens.tokenType).toBeDefined();
    });

    it('should logout user', async () => {
      await expect(manager.logout('test-provider')).resolves.not.toThrow();
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(async () => {
      const config: SSOConfig = {
        type: SSOProviderType.AZURE_AD,
        clientId: 'test-client',
        clientSecret: 'test-secret',
        redirectUri: 'https://test.qestro.com/auth/callback',
        tenantId: 'tenant-123',
      };

      await manager.registerProvider('test-provider', config);
    });

    it('should check health of individual provider', async () => {
      const health = await manager.checkProviderHealth('test-provider');

      expect(health).toBeDefined();
      expect(health.status).toBeDefined();
      expect(['healthy', 'unhealthy', 'degraded']).toContain(health.status);
    });

    it('should check health of all providers', async () => {
      const healthReport = await manager.checkAllProvidersHealth();

      expect(healthReport).toBeDefined();
      expect(healthReport.providers).toBeDefined();
      expect(healthReport.overallStatus).toBeDefined();
      expect(healthReport.timestamp).toBeDefined();
    });

    it('should detect unhealthy providers', async () => {
      // Mock a provider to return unhealthy status
      const mockProvider = {
        healthCheck: jest.fn().mockResolvedValue({
          status: 'unhealthy',
          details: { error: 'Connection failed' },
        }),
      };

      manager['providers'].set('unhealthy-provider', mockProvider as any);

      const health = await manager.checkProviderHealth('unhealthy-provider');

      expect(health.status).toBe('unhealthy');
      expect(health.details).toBeDefined();
    });
  });

  describe('Provider Configuration Management', () => {
    it('should update provider configuration', async () => {
      const initialConfig: SSOConfig = {
        type: SSOProviderType.AZURE_AD,
        clientId: 'initial-client',
        clientSecret: 'initial-secret',
        redirectUri: 'https://test.qestro.com/auth/callback',
        tenantId: 'tenant-123',
      };

      await manager.registerProvider('test-provider', initialConfig);

      const updatedConfig: Partial<SSOConfig> = {
        clientId: 'updated-client',
        scope: 'openid profile email offline_access',
      };

      await manager.updateProviderConfig('test-provider', updatedConfig);

      const currentConfig = manager.getProviderConfig('test-provider');
      expect(currentConfig?.clientId).toBe('updated-client');
      expect(currentConfig?.scope).toBe('openid profile email offline_access');
    });

    it('should remove provider', async () => {
      const config: SSOConfig = {
        type: SSOProviderType.AZURE_AD,
        clientId: 'test-client',
        clientSecret: 'test-secret',
        redirectUri: 'https://test.qestro.com/auth/callback',
        tenantId: 'tenant-123',
      };

      await manager.registerProvider('test-provider', config);

      await manager.removeProvider('test-provider');

      const providers = manager.getAvailableProviders();
      expect(providers).not.toContain('test-provider');
    });

    it('should throw error when removing non-existent provider', async () => {
      await expect(
        manager.removeProvider('non-existent-provider')
      ).rejects.toThrow('Provider non-existent-provider not found');
    });
  });

  describe('Audit Logging', () => {
    it('should log authentication events', async () => {
      const config: SSOConfig = {
        type: SSOProviderType.AZURE_AD,
        clientId: 'test-client',
        clientSecret: 'test-secret',
        redirectUri: 'https://test.qestro.com/auth/callback',
        tenantId: 'tenant-123',
      };

      await manager.registerProvider('test-provider', config);
      await manager.authenticate('test-provider');

      expect(mockAuditLogger).toHaveBeenCalledWith({
        event: 'authentication_initiated',
        provider: 'test-provider',
        providerType: SSOProviderType.AZURE_AD,
        timestamp: expect.any(String),
      });
    });

    it('should log configuration changes', async () => {
      const config: SSOConfig = {
        type: SSOProviderType.AZURE_AD,
        clientId: 'test-client',
        clientSecret: 'test-secret',
        redirectUri: 'https://test.qestro.com/auth/callback',
        tenantId: 'tenant-123',
      };

      await manager.registerProvider('test-provider', config);

      expect(mockAuditLogger).toHaveBeenCalledWith({
        event: 'provider_registered',
        provider: 'test-provider',
        providerType: SSOProviderType.AZURE_AD,
        timestamp: expect.any(String),
      });
    });

    it('should log errors with appropriate details', async () => {
      // Mock provider to throw error
      const mockProvider = {
        authenticate: jest.fn().mockRejectedValue(new Error('Authentication failed')),
        initialize: jest.fn().mockResolvedValue(undefined),
      };

      manager['providers'].set('error-provider', mockProvider as any);

      await expect(
        manager.authenticate('error-provider')
      ).rejects.toThrow('Authentication failed');

      expect(mockAuditLogger).toHaveBeenCalledWith({
        event: 'authentication_error',
        provider: 'error-provider',
        error: 'Authentication failed',
        timestamp: expect.any(String),
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors gracefully', async () => {
      const config: SSOConfig = {
        type: SSOProviderType.AZURE_AD,
        clientId: 'test-client',
        clientSecret: 'test-secret',
        redirectUri: 'https://test.qestro.com/auth/callback',
        tenantId: 'tenant-123',
      };

      await manager.registerProvider('test-provider', config);

      // Mock provider to throw error
      const mockProvider = manager['providers'].get('test-provider');
      jest.spyOn(mockProvider, 'authenticate').mockRejectedValue(new Error('Provider error'));

      await expect(
        manager.authenticate('test-provider')
      ).rejects.toThrow('Provider error');
    });

    it('should handle missing provider gracefully', async () => {
      await expect(
        manager.authenticate('non-existent-provider')
      ).rejects.toThrow('Provider non-existent-provider not found');
    });

    it('should handle invalid callback data', async () => {
      const config: SSOConfig = {
        type: SSOProviderType.AZURE_AD,
        clientId: 'test-client',
        clientSecret: 'test-secret',
        redirectUri: 'https://test.qestro.com/auth/callback',
        tenantId: 'tenant-123',
      };

      await manager.registerProvider('test-provider', config);

      const invalidAuthData = {
        // Missing required fields
        code: '',
        state: '',
      };

      await expect(
        manager.handleCallback('test-provider', invalidAuthData)
      ).rejects.toThrow();
    });
  });

  describe('Provider Metadata', () => {
    beforeEach(async () => {
      const config: SSOConfig = {
        type: SSOProviderType.AZURE_AD,
        clientId: 'test-client',
        clientSecret: 'test-secret',
        redirectUri: 'https://test.qestro.com/auth/callback',
        tenantId: 'tenant-123',
      };

      await manager.registerProvider('test-provider', config);
    });

    it('should retrieve provider metadata', async () => {
      const metadata = await manager.getProviderMetadata('test-provider');

      expect(metadata).toBeDefined();
      expect(metadata.issuer).toBeDefined();
      expect(metadata.authorizationEndpoint).toBeDefined();
      expect(metadata.tokenEndpoint).toBeDefined();
    });

    it('should return provider capabilities', async () => {
      const capabilities = await manager.getProviderCapabilities('test-provider');

      expect(capabilities).toBeDefined();
      expect(Array.isArray(capabilities.supportedScopes)).toBe(true);
      expect(Array.isArray(capabilities.supportedResponseTypes)).toBe(true);
    });
  });
});
