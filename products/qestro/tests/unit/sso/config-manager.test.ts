/**
 * Unit Tests for SSO Configuration Manager
 *
 * Comprehensive test suite covering:
 * - Configuration CRUD operations
 * - Validation and security checks
 * - Encryption and decryption
 * - Backup and restore functionality
 * - Import/export capabilities
 * - Audit logging and change tracking
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SSOConfigurationManager, SSOProviderType, Environment } from '../../../src/services/sso/config-manager';
import * as schema from '../../../src/db/schema';

// Mock dependencies
jest.mock('drizzle-orm/d1');
jest.mock('node:crypto');

// Test data factories
const createTestProviderConfig = (overrides = {}) => ({
  name: 'Test Provider',
  type: 'azure-ad' as SSOProviderType,
  displayName: 'Test Azure AD Provider',
  description: 'Test provider for unit testing',
  environment: 'development' as Environment,
  config: {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    domain: 'test.domain.com',
    environment: 'development' as Environment,
    saml: {
      entryPoint: 'https://test.domain.com/saml',
      issuer: 'test-issuer',
      cert: 'test-certificate',
      signatureAlgorithm: 'RSA-SHA256' as const,
      digestAlgorithm: 'SHA256' as const,
      nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      allowUnencryptedAssertions: false,
      rejectDelegatedRequests: true,
      validateInResponseTo: true,
      requestIdExpirationTimeMs: 300000,
      clockSkewMs: 30000,
      binding: 'HTTP-POST' as const,
      singleLogoutEnabled: true,
    },
    attributeMapping: {
      email: 'email',
      firstName: 'given_name',
      lastName: 'family_name',
      custom: {},
    },
    groupMapping: {
      enabled: true,
      attributeName: 'groups',
      caseSensitive: false,
      defaultGroups: [],
      requiredGroups: [],
      adminGroups: [],
      syncExisting: true,
      createMissing: false,
    },
    roleMapping: {
      enabled: true,
      mapping: {},
      defaultRole: 'user',
      adminRoles: ['admin'],
      userRoles: ['user'],
      guestRoles: ['guest'],
      fallbackToDefault: true,
      hierarchicalRoles: false,
    },
    callbacks: {
      redirectUri: 'https://app.test.com/auth/callback',
      allowedRedirectUris: ['https://app.test.com/auth/callback'],
      errorCallback: 'https://app.test.com/auth/error',
      successCallback: 'https://app.test.com/auth/success',
      timeoutMs: 30000,
      retryAttempts: 3,
    },
    features: {
      justInTimeProvisioning: true,
      automaticGroupSync: true,
      roleSync: true,
      profileUpdates: true,
      passwordManagement: false,
      singleLogout: true,
      sessionManagement: true,
      auditLogging: true,
      analytics: true,
      debugMode: false,
      testMode: false,
    },
    security: {
      redirectUriValidation: true,
      stateValidation: true,
      nonceValidation: true,
      tokenValidation: true,
      signatureValidation: true,
      audienceValidation: true,
      maxTokenAge: 3600,
      clockSkewTolerance: 300,
      allowedOrigins: ['https://app.test.com'],
      domainRestrictions: ['test.domain.com'],
      rateLimiting: {
        enabled: true,
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        requestsPerDay: 10000,
        burstLimit: 10,
        penaltyDuration: 300,
      },
      encryption: {
        atRest: true,
        inTransit: true,
        algorithm: 'aes-256-gcm',
        keySize: 256,
        ivSize: 16,
        tagSize: 16,
        keyRotationDays: 90,
      },
    },
  },
  isActive: true,
  isDefault: false,
  priority: 1,
  metadata: {
    logoUrl: 'https://test.domain.com/logo.png',
    documentation: 'https://test.domain.com/docs',
    tags: ['test', 'azure-ad'],
    category: 'identity-provider',
    integrationComplexity: 'basic' as const,
    estimatedSetupTime: 30,
    supportedFeatures: ['sso', 'provisioning'],
    limitations: [],
    prerequisites: [],
  },
  security: {
    classification: 'confidential' as const,
    accessLevel: 'admin' as const,
    allowedRoles: ['admin'],
    allowedUsers: [],
    encryptedFields: ['clientSecret'],
    signedFields: ['clientId'],
    securityScore: 85,
  },
  ...overrides,
});

const createMockEnv = () => ({
  DB: {
    prepare: jest.fn(),
    batch: jest.fn(),
    exec: jest.fn(),
  },
  SSO_CONFIG_ENCRYPTION_KEY: 'test-encryption-key',
  ENVIRONMENT: 'test',
});

describe('SSOConfigurationManager', () => {
  let configManager: SSOConfigurationManager;
  let mockEnv: any;
  let mockDb: any;

  beforeEach(() => {
    mockEnv = createMockEnv();
    mockDb = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      all: jest.fn().mockResolvedValue([]),
      run: jest.fn().mockResolvedValue({ success: true }),
    };

    // Mock crypto functions
    jest.spyOn(require('node:crypto'), 'randomUUID').mockReturnValue('test-uuid');
    jest.spyOn(require('node:crypto'), 'randomBytes').mockReturnValue({
      toString: jest.fn().mockReturnValue('test-random-bytes'),
    });
    jest.spyOn(require('node:crypto'), 'createHash').mockReturnValue({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('test-digest'),
    });

    configManager = new SSOConfigurationManager(mockEnv);
    (configManager as any).db = mockDb;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createProviderConfiguration', () => {
    it('should create a new provider configuration successfully', async () => {
      const config = createTestProviderConfig();
      const userId = 'test-user';

      // Mock successful database insert
      mockDb.run.mockResolvedValue({ success: true });

      const result = await configManager.createProviderConfiguration(config, userId);

      expect(result).toMatchObject({
        id: 'test-uuid',
        name: config.name,
        type: config.type,
        displayName: config.displayName,
        isActive: true,
        isDefault: false,
        priority: 1,
        version: 1,
        createdBy: userId,
        updatedBy: userId,
      });

      expect(mockDb.insert).toHaveBeenCalledWith(schema.ssoProviders);
      expect(mockDb.values).toHaveBeenCalled();
    });

    it('should validate required fields before creation', async () => {
      const invalidConfig = {
        ...createTestProviderConfig(),
        name: '', // Invalid: empty name
        config: {
          ...createTestProviderConfig().config,
          clientId: '', // Invalid: empty client ID
        },
      };

      await expect(
        configManager.createProviderConfiguration(invalidConfig, 'test-user')
      ).rejects.toThrow('Configuration validation failed');

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should encrypt sensitive fields before storage', async () => {
      const config = createTestProviderConfig();
      const userId = 'test-user';

      // Mock encryption
      jest.spyOn(configManager as any, 'encryptSensitiveFields').mockResolvedValue({
        ...config.config,
        clientSecret: 'encrypted-secret',
      });

      mockDb.run.mockResolvedValue({ success: true });

      await configManager.createProviderConfiguration(config, userId);

      expect((configManager as any).encryptSensitiveFields).toHaveBeenCalledWith(config.config);
    });
  });

  describe('updateProviderConfiguration', () => {
    it('should update an existing provider configuration', async () => {
      const existingConfig = createTestProviderConfig({ id: 'existing-id' });
      const updates = {
        name: 'Updated Provider Name',
        isActive: false,
      };
      const userId = 'test-user';

      // Mock existing configuration retrieval
      jest.spyOn(configManager, 'getProviderConfiguration').mockResolvedValue(existingConfig);
      mockDb.run.mockResolvedValue({ success: true });

      const result = await configManager.updateProviderConfiguration('existing-id', updates, userId);

      expect(result.name).toBe(updates.name);
      expect(result.isActive).toBe(updates.isActive);
      expect(result.version).toBe(existingConfig.version + 1);
      expect(result.updatedBy).toBe(userId);

      expect(mockDb.update).toHaveBeenCalledWith(schema.ssoProviders);
      expect(mockDb.set).toHaveBeenCalled();
    });

    it('should throw error if provider configuration not found', async () => {
      jest.spyOn(configManager, 'getProviderConfiguration').mockResolvedValue(null);

      await expect(
        configManager.updateProviderConfiguration('nonexistent-id', {}, 'test-user')
      ).rejects.toThrow('Provider configuration not found');
    });

    it('should validate updated configuration', async () => {
      const existingConfig = createTestProviderConfig({ id: 'existing-id' });
      const invalidUpdates = {
        config: {
          ...existingConfig.config,
          clientId: '', // Invalid: empty client ID
        },
      };

      jest.spyOn(configManager, 'getProviderConfiguration').mockResolvedValue(existingConfig);

      await expect(
        configManager.updateProviderConfiguration('existing-id', invalidUpdates, 'test-user')
      ).rejects.toThrow('Configuration validation failed');

      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe('getProviderConfiguration', () => {
    it('should retrieve provider configuration by ID', async () => {
      const providerData = {
        id: 'test-id',
        name: 'Test Provider',
        type: 'azure-ad',
        config: JSON.stringify(createTestProviderConfig().config),
        isActive: true,
        isDefault: false,
        priority: 1,
        description: 'Test provider',
        metadata: JSON.stringify({ displayName: 'Test Provider' }),
        createdAt: Date.now() / 1000,
        updatedAt: Date.now() / 1000,
      };

      mockDb.all.mockResolvedValue([providerData]);

      const result = await configManager.getProviderConfiguration('test-id');

      expect(result).toMatchObject({
        id: 'test-id',
        name: 'Test Provider',
        type: 'azure-ad',
        isActive: true,
        isDefault: false,
        priority: 1,
      });

      expect(mockDb.select).toHaveBeenCalledWith(schema.ssoProviders);
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should return null for non-existent provider', async () => {
      mockDb.all.mockResolvedValue([]);

      const result = await configManager.getProviderConfiguration('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should decrypt sensitive fields when retrieving', async () => {
      const providerData = {
        id: 'test-id',
        name: 'Test Provider',
        type: 'azure-ad',
        config: JSON.stringify({
          ...createTestProviderConfig().config,
          clientSecret: 'encrypted-secret',
        }),
        isActive: true,
        isDefault: false,
        priority: 1,
        description: 'Test provider',
        metadata: JSON.stringify({ displayName: 'Test Provider' }),
        createdAt: Date.now() / 1000,
        updatedAt: Date.now() / 1000,
      };

      mockDb.all.mockResolvedValue([providerData]);

      // Mock decryption
      jest.spyOn(configManager as any, 'decryptSensitiveFields').mockResolvedValue({
        ...createTestProviderConfig().config,
        clientSecret: 'decrypted-secret',
      });

      const result = await configManager.getProviderConfiguration('test-id');

      expect((configManager as any).decryptSensitiveFields).toHaveBeenCalled();
      expect(result?.config.clientSecret).toBe('decrypted-secret');
    });
  });

  describe('listProviderConfigurations', () => {
    it('should list all provider configurations', async () => {
      const providersData = [
        {
          id: 'provider-1',
          name: 'Provider 1',
          type: 'azure-ad',
          config: JSON.stringify(createTestProviderConfig().config),
          isActive: true,
          isDefault: false,
          priority: 1,
          description: 'Test provider 1',
          metadata: JSON.stringify({ displayName: 'Provider 1' }),
          createdAt: Date.now() / 1000,
          updatedAt: Date.now() / 1000,
        },
        {
          id: 'provider-2',
          name: 'Provider 2',
          type: 'okta',
          config: JSON.stringify(createTestProviderConfig().config),
          isActive: false,
          isDefault: true,
          priority: 2,
          description: 'Test provider 2',
          metadata: JSON.stringify({ displayName: 'Provider 2' }),
          createdAt: Date.now() / 1000,
          updatedAt: Date.now() / 1000,
        },
      ];

      mockDb.all.mockResolvedValue(providersData);

      const result = await configManager.listProviderConfigurations();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'provider-1',
        name: 'Provider 1',
        type: 'azure-ad',
        isActive: true,
      });
      expect(result[1]).toMatchObject({
        id: 'provider-2',
        name: 'Provider 2',
        type: 'okta',
        isActive: false,
      });
    });

    it('should apply filters when listing configurations', async () => {
      const options = {
        isActive: true,
        type: 'azure-ad' as SSOProviderType,
        limit: 10,
        offset: 0,
      };

      mockDb.all.mockResolvedValue([]);

      await configManager.listProviderConfigurations(options);

      expect(mockDb.where).toHaveBeenCalledTimes(2); // Once for isActive, once for type
      expect(mockDb.limit).toHaveBeenCalledWith(10);
      expect(mockDb.offset).toHaveBeenCalledWith(0);
    });
  });

  describe('validateConfiguration', () => {
    it('should validate a correct configuration successfully', async () => {
      const config = createTestProviderConfig({ id: 'test-id' });

      const result = await configManager.validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.score).toBeGreaterThan(80);
    });

    it('should detect missing required fields', async () => {
      const invalidConfig = {
        ...createTestProviderConfig({ id: 'test-id' }),
        name: '',
        config: {
          ...createTestProviderConfig().config,
          clientId: '',
          clientSecret: '',
        },
      };

      const result = await configManager.validateConfiguration(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.field === 'name')).toBe(true);
      expect(result.errors.some(e => e.field === 'config.clientId')).toBe(true);
      expect(result.errors.some(e => e.field === 'config.clientSecret')).toBe(true);
    });

    it('should validate SAML configuration', async () => {
      const config = createTestProviderConfig({
        id: 'test-id',
        type: 'saml-custom',
        config: {
          ...createTestProviderConfig().config,
          saml: {
            entryPoint: '',
            issuer: '',
            cert: '',
            signatureAlgorithm: 'RSA-SHA1' as const,
            digestAlgorithm: 'SHA256' as const,
            nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
            allowUnencryptedAssertions: false,
            rejectDelegatedRequests: true,
            validateInResponseTo: true,
            requestIdExpirationTimeMs: 300000,
            clockSkewMs: 30000,
            binding: 'HTTP-POST' as const,
            singleLogoutEnabled: true,
          },
        },
      });

      const result = await configManager.validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.warnings.some(w => w.field === 'config.saml.signatureAlgorithm')).toBe(true);
    });

    it('should validate OIDC configuration', async () => {
      const config = createTestProviderConfig({
        id: 'test-id',
        type: 'oidc-custom',
        config: {
          ...createTestProviderConfig().config,
          oidc: {
            authorizationEndpoint: '',
            tokenEndpoint: '',
            scopes: [],
            responseType: 'code' as const,
            grantType: 'authorization_code' as const,
            pkce: false,
            nonce: false,
          },
        },
      });

      const result = await configManager.validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.warnings.some(w => w.field === 'config.oidc.pkce')).toBe(true);
    });

    it('should detect security issues', async () => {
      const config = createTestProviderConfig({
        id: 'test-id',
        config: {
          ...createTestProviderConfig().config,
          security: {
            ...createTestProviderConfig().config.security,
            allowedOrigins: [],
            maxTokenAge: 7200,
            encryption: {
              atRest: true,
              inTransit: true,
              algorithm: 'aes-128-cbc',
              keySize: 128,
              ivSize: 16,
              tagSize: 16,
              keyRotationDays: 90,
            },
          },
        },
      });

      const result = await configManager.validateConfiguration(config);

      expect(result.securityIssues.length).toBeGreaterThan(0);
      expect(result.securityIssues.some(issue => issue.type === 'missing_validation')).toBe(true);
      expect(result.securityIssues.some(issue => issue.type === 'weak_cipher')).toBe(true);
    });
  });

  describe('deleteProviderConfiguration', () => {
    it('should delete a provider configuration successfully', async () => {
      const existingConfig = createTestProviderConfig({ id: 'test-id' });
      const userId = 'test-user';

      jest.spyOn(configManager, 'getProviderConfiguration').mockResolvedValue(existingConfig);
      mockDb.run.mockResolvedValue({ success: true });

      await configManager.deleteProviderConfiguration('test-id', userId);

      expect(mockDb.delete).toHaveBeenCalledWith(schema.ssoProviders);
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should throw error if provider configuration not found', async () => {
      jest.spyOn(configManager, 'getProviderConfiguration').mockResolvedValue(null);

      await expect(
        configManager.deleteProviderConfiguration('nonexistent-id', 'test-user')
      ).rejects.toThrow('Provider configuration not found');

      expect(mockDb.delete).not.toHaveBeenCalled();
    });
  });

  describe('createConfigurationBackup', () => {
    it('should create a backup of specified providers', async () => {
      const provider1 = createTestProviderConfig({ id: 'provider-1' });
      const provider2 = createTestProviderConfig({ id: 'provider-2' });

      jest.spyOn(configManager, 'getProviderConfiguration')
        .mockResolvedValueOnce(provider1)
        .mockResolvedValueOnce(provider2);

      jest.spyOn(configManager as any, 'compressData').mockResolvedValue('compressed-data');
      jest.spyOn(configManager as any, 'encryptData').mockResolvedValue('encrypted-data');

      const result = await configManager.createConfigurationBackup(
        'Test Backup',
        'Test backup description',
        ['provider-1', 'provider-2'],
        'test-user'
      );

      expect(result).toMatchObject({
        name: 'Test Backup',
        description: 'Test backup description',
        providerIds: ['provider-1', 'provider-2'],
        environment: 'test',
        backupData: 'encrypted-data',
        version: '1.0',
        createdBy: 'test-user',
        size: expect.any(Number),
        compression: 'gzip',
      });
    });

    it('should backup all providers when no specific IDs provided', async () => {
      const providers = [
        createTestProviderConfig({ id: 'provider-1' }),
        createTestProviderConfig({ id: 'provider-2' }),
      ];

      jest.spyOn(configManager, 'listProviderConfigurations').mockResolvedValue(providers);
      jest.spyOn(configManager as any, 'compressData').mockResolvedValue('compressed-data');
      jest.spyOn(configManager as any, 'encryptData').mockResolvedValue('encrypted-data');

      const result = await configManager.createConfigurationBackup('Full Backup');

      expect(result.providerIds).toHaveLength(2);
      expect(configManager.listProviderConfigurations).toHaveBeenCalled();
    });
  });

  describe('exportConfiguration', () => {
    it('should export configuration in JSON format', async () => {
      const provider = createTestProviderConfig({ id: 'provider-1' });

      jest.spyOn(configManager, 'getProviderConfiguration').mockResolvedValue(provider);

      const result = await configManager.exportConfiguration(['provider-1'], 'json', false);

      const exportData = JSON.parse(result);

      expect(exportData.exportInfo).toMatchObject({
        version: '1.0',
        environment: 'test',
        includeSensitiveData: false,
        providerCount: 1,
      });

      expect(exportData.providers).toHaveLength(1);
      expect(exportData.providers[0].config.clientSecret).toBe('***REDACTED***');
    });

    it('should include sensitive data when requested', async () => {
      const provider = createTestProviderConfig({ id: 'provider-1' });

      jest.spyOn(configManager, 'getProviderConfiguration').mockResolvedValue(provider);

      const result = await configManager.exportConfiguration(['provider-1'], 'json', true);

      const exportData = JSON.parse(result);

      expect(exportData.exportInfo.includeSensitiveData).toBe(true);
      expect(exportData.providers[0].config.clientSecret).toBe('test-client-secret');
    });
  });

  describe('importConfiguration', () => {
    it('should import valid configuration data', async () => {
      const importData = {
        exportInfo: {
          version: '1.0',
          timestamp: new Date().toISOString(),
          environment: 'test',
          includeSensitiveData: true,
          providerCount: 1,
        },
        providers: [createTestProviderConfig({ id: 'imported-provider' })],
      };

      jest.spyOn(configManager, 'getProviderConfiguration').mockResolvedValue(null);
      jest.spyOn(configManager, 'validateConfiguration').mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        score: 90,
        recommendations: [],
        securityIssues: [],
      });
      jest.spyOn(configManager, 'createProviderConfiguration').mockResolvedValue(
        createTestProviderConfig({ id: 'imported-provider' })
      );

      const result = await configManager.importConfiguration(JSON.stringify(importData));

      expect(result.success).toBe(true);
      expect(result.summary.successfulImports).toBe(1);
      expect(result.importedProviders).toContain('imported-provider');
    });

    it('should handle validation errors during import', async () => {
      const importData = {
        exportInfo: {
          version: '1.0',
          timestamp: new Date().toISOString(),
          environment: 'test',
          includeSensitiveData: true,
          providerCount: 1,
        },
        providers: [createTestProviderConfig({ id: 'invalid-provider', name: '' })],
      };

      jest.spyOn(configManager, 'validateConfiguration').mockResolvedValue({
        isValid: false,
        errors: [{ field: 'name', code: 'REQUIRED', message: 'Name is required', severity: 'error' }],
        warnings: [],
        score: 0,
        recommendations: [],
        securityIssues: [],
      });

      const result = await configManager.importConfiguration(JSON.stringify(importData));

      expect(result.success).toBe(true);
      expect(result.summary.errors).toBe(1);
      expect(result.errors[0].providerId).toBe('invalid-provider');
    });

    it('should update existing providers when overwrite is enabled', async () => {
      const importData = {
        exportInfo: {
          version: '1.0',
          timestamp: new Date().toISOString(),
          environment: 'test',
          includeSensitiveData: true,
          providerCount: 1,
        },
        providers: [createTestProviderConfig({ id: 'existing-provider' })],
      };

      const existingConfig = createTestProviderConfig({ id: 'existing-provider' });

      jest.spyOn(configManager, 'getProviderConfiguration').mockResolvedValue(existingConfig);
      jest.spyOn(configManager, 'validateConfiguration').mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        score: 90,
        recommendations: [],
        securityIssues: [],
      });
      jest.spyOn(configManager, 'updateProviderConfiguration').mockResolvedValue(
        createTestProviderConfig({ id: 'existing-provider' })
      );

      const result = await configManager.importConfiguration(
        JSON.stringify(importData),
        { overwriteExisting: true }
      );

      expect(result.success).toBe(true);
      expect(result.summary.successfulUpdates).toBe(1);
      expect(result.updatedProviders).toContain('existing-provider');
    });
  });

  describe('encryptSensitiveFields', () => {
    it('should encrypt client secret', async () => {
      const config = createTestProviderConfig().config;

      jest.spyOn(configManager as any, 'encryptField').mockResolvedValue('encrypted-secret');

      const result = await (configManager as any).encryptSensitiveFields(config);

      expect(result.clientSecret).toBe('encrypted-secret');
      expect((configManager as any).encryptField).toHaveBeenCalledWith('test-client-secret');
    });

    it('should encrypt SAML private key', async () => {
      const config = {
        ...createTestProviderConfig().config,
        saml: {
          ...createTestProviderConfig().config.saml!,
          privateKey: 'test-private-key',
        },
      };

      jest.spyOn(configManager as any, 'encryptField').mockResolvedValue('encrypted-key');

      const result = await (configManager as any).encryptSensitiveFields(config);

      expect(result.saml.privateKey).toBe('encrypted-key');
    });

    it('should encrypt LDAP bind password', async () => {
      const config = {
        ...createTestProviderConfig().config,
        ldap: {
          url: 'ldap://test.com',
          bindDN: 'cn=admin,dc=test,dc=com',
          bindPassword: 'test-password',
          userBaseDN: 'ou=users,dc=test,dc=com',
          userSearchFilter: '(uid={username})',
          userAttributes: ['uid', 'cn', 'mail'],
          groupBaseDN: 'ou=groups,dc=test,dc=com',
          groupSearchFilter: '(memberUid={username})',
          groupMemberAttribute: 'memberUid',
          secureProtocol: true,
          port: 636,
          connectionTimeout: 30000,
          requestTimeout: 30000,
        },
      };

      jest.spyOn(configManager as any, 'encryptField').mockResolvedValue('encrypted-password');

      const result = await (configManager as any).encryptSensitiveFields(config);

      expect(result.ldap.bindPassword).toBe('encrypted-password');
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      const config = createTestProviderConfig();
      const userId = 'test-user';

      mockDb.run.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        configManager.createProviderConfiguration(config, userId)
      ).rejects.toThrow('Failed to create provider configuration: Database connection failed');
    });

    it('should handle malformed configuration data', async () => {
      const importData = '{ invalid json }';

      await expect(
        configManager.importConfiguration(importData)
      ).rejects.toThrow('Failed to import configuration: Unexpected token');
    });

    it('should handle missing export data structure', async () => {
      const importData = {
        // Missing providers array
        exportInfo: {
          version: '1.0',
          timestamp: new Date().toISOString(),
        },
      };

      await expect(
        configManager.importConfiguration(JSON.stringify(importData))
      ).rejects.toThrow('Invalid import data: providers array is required');
    });
  });

  describe('security validation', () => {
    it('should validate SAML configuration security', async () => {
      const config = createTestProviderConfig({
        type: 'saml-custom',
        config: {
          ...createTestProviderConfig().config,
          saml: {
            entryPoint: 'https://test.com/saml',
            issuer: 'test-issuer',
            cert: 'test-cert',
            signatureAlgorithm: 'RSA-SHA1', // Weak algorithm
            digestAlgorithm: 'SHA256',
            nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
            allowUnencryptedAssertions: true, // Security risk
            rejectDelegatedRequests: false,
            validateInResponseTo: false,
            requestIdExpirationTimeMs: 300000,
            clockSkewMs: 30000,
            binding: 'HTTP-POST',
            singleLogoutEnabled: true,
          },
        },
      });

      const result = await configManager.validateConfiguration(config);

      expect(result.warnings.some(w =>
        w.field === 'config.saml.signatureAlgorithm' &&
        w.message.includes('weak')
      )).toBe(true);
    });

    it('should validate OIDC configuration security', async () => {
      const config = createTestProviderConfig({
        type: 'oidc-custom',
        config: {
          ...createTestProviderConfig().config,
          oidc: {
            authorizationEndpoint: 'https://test.com/auth',
            tokenEndpoint: 'https://test.com/token',
            scopes: ['profile'], // Missing 'openid' scope
            responseType: 'code',
            grantType: 'authorization_code',
            pkce: false, // Security recommendation
            nonce: false,
          },
        },
      });

      const result = await configManager.validateConfiguration(config);

      expect(result.warnings.some(w =>
        w.field === 'config.oidc.scopes' &&
        w.message.includes('openid')
      )).toBe(true);

      expect(result.warnings.some(w =>
        w.field === 'config.oidc.pkce' &&
        w.message.includes('PKCE')
      )).toBe(true);
    });
  });

  describe('performance considerations', () => {
    it('should handle large provider lists efficiently', async () => {
      const providersData = Array.from({ length: 100 }, (_, i) => ({
        id: `provider-${i}`,
        name: `Provider ${i}`,
        type: 'azure-ad',
        config: JSON.stringify(createTestProviderConfig().config),
        isActive: i % 2 === 0,
        isDefault: i === 0,
        priority: i,
        description: `Test provider ${i}`,
        metadata: JSON.stringify({ displayName: `Provider ${i}` }),
        createdAt: Date.now() / 1000,
        updatedAt: Date.now() / 1000,
      }));

      mockDb.all.mockResolvedValue(providersData);

      const startTime = Date.now();
      const result = await configManager.listProviderConfigurations({ limit: 100 });
      const duration = Date.now() - startTime;

      expect(result).toHaveLength(100);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should batch process configuration imports efficiently', async () => {
      const providers = Array.from({ length: 50 }, (_, i) =>
        createTestProviderConfig({ id: `imported-${i}` })
      );

      const importData = {
        exportInfo: {
          version: '1.0',
          timestamp: new Date().toISOString(),
          environment: 'test',
          includeSensitiveData: true,
          providerCount: 50,
        },
        providers,
      };

      jest.spyOn(configManager, 'getProviderConfiguration').mockResolvedValue(null);
      jest.spyOn(configManager, 'validateConfiguration').mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        score: 90,
        recommendations: [],
        securityIssues: [],
      });
      jest.spyOn(configManager, 'createProviderConfiguration').mockResolvedValue(
        createTestProviderConfig()
      );

      const startTime = Date.now();
      const result = await configManager.importConfiguration(JSON.stringify(importData));
      const duration = Date.now() - startTime;

      expect(result.summary.successfulImports).toBe(50);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});
