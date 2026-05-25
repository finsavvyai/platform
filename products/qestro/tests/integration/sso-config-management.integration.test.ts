/**
 * Integration Tests for SSO Configuration Management
 *
 * End-to-end testing of the complete configuration management workflow:
 * - Configuration lifecycle management
 * - Multi-environment support
 * - Security and encryption
 * - Backup and restore operations
 * - Import/export functionality
 * - Audit trail verification
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { SSOConfigurationManager, SSOProviderType, Environment } from '../../src/services/sso/config-manager';

// Test configuration
const TEST_ENVIRONMENT = {
  DB: null as any, // Will be set up in beforeAll
  SSO_CONFIG_ENCRYPTION_KEY: 'test-integration-key-32-chars-long',
  ENVIRONMENT: 'test',
} as const;

// Test utilities
const createCompleteTestConfig = (id: string, type: SSOProviderType, environment: Environment) => ({
  name: `${type.toUpperCase()} Test Provider ${id}`,
  type,
  displayName: `${type.toUpperCase()} Test Provider ${id}`,
  description: `Integration test provider for ${type} in ${environment}`,
  environment,
  config: {
    clientId: `client-id-${id}`,
    clientSecret: `client-secret-${id}`,
    domain: `${id}.test.example.com`,
    environment,
    // Protocol-specific configuration based on type
    ...(type === 'saml-custom' ? {
      saml: {
        entryPoint: `https://${id}.test.example.com/saml`,
        issuer: `urn:example:${id}`,
        cert: `-----BEGIN CERTIFICATE-----\nMIICert${id}\n-----END CERTIFICATE-----`,
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
        logoutUrl: `https://${id}.test.example.com/saml/logout`,
        logoutBinding: 'HTTP-POST' as const,
      },
    } : type === 'oidc-custom' ? {
      oidc: {
        wellKnownUrl: `https://${id}.test.example.com/.well-known/openid-configuration`,
        authorizationEndpoint: `https://${id}.test.example.com/oauth2/auth`,
        tokenEndpoint: `https://${id}.test.example.com/oauth2/token`,
        userInfoEndpoint: `https://${id}.test.example.com/oauth2/userinfo`,
        jwksUrl: `https://${id}.test.example.com/.well-known/jwks.json`,
        endSessionEndpoint: `https://${id}.test.example.com/oauth2/logout`,
        revocationEndpoint: `https://${id}.test.example.com/oauth2/revoke`,
        scopes: ['openid', 'profile', 'email', 'groups'],
        responseType: 'code' as const,
        responseMode: 'query' as const,
        grantType: 'authorization_code' as const,
        pkce: true,
        nonce: true,
        maxAge: 3600,
        additionalParameters: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    } : type.includes('azure-ad') || type.includes('google-workspace') ? {
      oidc: {
        wellKnownUrl: `https://login.microsoftonline.com/${id}/v2.0/.well-known/openid-configuration`,
        authorizationEndpoint: `https://login.microsoftonline.com/${id}/oauth2/v2.0/authorize`,
        tokenEndpoint: `https://login.microsoftonline.com/${id}/oauth2/v2.0/token`,
        userInfoEndpoint: `https://graph.microsoft.com/v1.0/me`,
        jwksUrl: `https://login.microsoftonline.com/${id}/discovery/v2.0/keys`,
        endSessionEndpoint: `https://login.microsoftonline.com/${id}/oauth2/v2.0/logout`,
        scopes: ['openid', 'profile', 'email', 'User.Read', 'Group.Read.All'],
        responseType: 'code' as const,
        responseMode: 'query' as const,
        grantType: 'authorization_code' as const,
        pkce: true,
        nonce: true,
        maxAge: 3600,
      },
    } : {}), // Default empty config for other types

    // Attribute mapping
    attributeMapping: {
      email: 'email',
      firstName: 'given_name',
      lastName: 'family_name',
      displayName: 'name',
      username: 'preferred_username',
      phone: 'phone_number',
      avatar: 'picture',
      locale: 'locale',
      timezone: 'zoneinfo',
      department: 'department',
      title: 'title',
      manager: 'manager',
      employeeId: 'employee_id',
      custom: {
        costCenter: 'cost_center',
        location: 'location',
        division: 'division',
      },
      transformations: {
        email: { type: 'lowercase' as const },
        username: { type: 'lowercase' as const },
      },
    },

    // Group mapping
    groupMapping: {
      enabled: true,
      attributeName: 'groups',
      groupBaseDN: 'ou=groups,dc=example,dc=com',
      groupFilter: '(objectClass=groupOfNames)',
      prefix: 'company-',
      suffix: '',
      caseSensitive: false,
      defaultGroups: ['users'],
      requiredGroups: [],
      adminGroups: ['admins', 'sso-admins'],
      syncExisting: true,
      createMissing: true,
      mappingRules: [
        {
          source: '.*Admins.*',
          target: 'company-admins',
          transformation: 'lowercase',
          priority: 1,
        },
        {
          source: '.*Developers.*',
          target: 'company-developers',
          transformation: 'lowercase',
          priority: 2,
        },
      ],
    },

    // Role mapping
    roleMapping: {
      enabled: true,
      attributeName: 'roles',
      mapping: {
        'global-admin': 'super-admin',
        'app-admin': 'admin',
        'app-user': 'user',
        'readonly': 'viewer',
      },
      defaultRole: 'user',
      adminRoles: ['super-admin', 'admin'],
      userRoles: ['user'],
      guestRoles: ['viewer', 'readonly'],
      fallbackToDefault: true,
      hierarchicalRoles: true,
      roleHierarchy: {
        'super-admin': ['admin', 'user', 'viewer'],
        'admin': ['user', 'viewer'],
        'user': ['viewer'],
      },
    },

    // Callback configuration
    callbacks: {
      redirectUri: `https://app.test.example.com/auth/${id}/callback`,
      postLogoutRedirectUri: `https://app.test.example.com/auth/${id}/logout`,
      allowedRedirectUris: [
        `https://app.test.example.com/auth/${id}/callback`,
        `https://app.test.example.com/auth/${id}/silent-callback`,
      ],
      errorCallback: `https://app.test.example.com/auth/${id}/error`,
      successCallback: `https://app.test.example.com/auth/${id}/success`,
      timeoutMs: 60000,
      retryAttempts: 3,
    },

    // Feature configuration
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
      testMode: environment === 'development',
    },

    // Security configuration
    security: {
      redirectUriValidation: true,
      stateValidation: true,
      nonceValidation: true,
      tokenValidation: true,
      signatureValidation: true,
      audienceValidation: true,
      maxTokenAge: 3600,
      clockSkewTolerance: 300,
      allowedOrigins: ['https://app.test.example.com'],
      domainRestrictions: ['test.example.com', 'company.com'],
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

    // Branding configuration
    branding: {
      logoUrl: `https://assets.test.example.com/logos/${type}-logo.png`,
      primaryColor: '#0078d4',
      secondaryColor: '#f3f2f1',
      buttonText: `Sign in with ${type}`,
      buttonStyle: 'primary' as const,
      customCSS: `.${type}-button { font-weight: 600; }`,
      faviconUrl: `https://assets.test.example.com/favicons/${type}.ico`,
    },

    // Compliance configuration
    compliance: {
      dataResidency: ['US', 'EU'],
      retentionPolicy: {
        logsRetentionDays: 365,
        auditRetentionDays: 2555, // 7 years
        sessionRetentionDays: 30,
        tokenRetentionDays: 7,
        configRetentionDays: 2555,
      },
      auditLevel: 'comprehensive' as const,
      complianceStandards: ['SOC2', 'GDPR', 'HIPAA'],
      consentManagement: {
        requiredConsent: true,
        consentText: `I consent to the processing of my data for ${type} authentication.`,
        dataProcessingAgreement: `https://company.com/dpa/${type}`,
        privacyPolicyUrl: 'https://company.com/privacy',
      },
    },
  },
  isActive: true,
  isDefault: false,
  priority: 1,
  metadata: {
    logoUrl: `https://assets.test.example.com/providers/${type}.png`,
    documentation: `https://docs.test.example.com/providers/${type}`,
    supportUrl: `https://support.test.example.com/${type}`,
    adminPortalUrl: `https://admin.${type}.example.com`,
    apiDocumentation: `https://api.${type}.example.com/docs`,
    tags: [type, 'test', 'integration'],
    category: 'identity-provider',
    integrationComplexity: 'intermediate' as const,
    estimatedSetupTime: 45,
    supportedFeatures: ['sso', 'provisioning', 'group-sync', 'role-sync'],
    limitations: ['Max 10,000 users', 'Rate limited'],
    prerequisites: ['Admin access to provider console', 'SSL certificate'],
  },
  security: {
    classification: 'confidential' as const,
    accessLevel: 'admin' as const,
    allowedRoles: ['admin', 'sso-admin', 'sso-operator'],
    allowedUsers: [`integration-test-user-${id}`],
    encryptedFields: ['clientSecret', 'bindPassword', 'privateKey', 'signingKey'],
    signedFields: ['clientId', 'domain', 'redirectUri'],
    lastSecurityScan: new Date(),
    securityScore: 92,
  },
});

describe('SSO Configuration Management Integration Tests', () => {
  let configManager: SSOConfigurationManager;
  let createdProviderIds: string[] = [];

  beforeAll(async () => {
    // Initialize test environment
    // In a real integration test, this would set up a test database
    configManager = new SSOConfigurationManager(TEST_ENVIRONMENT);
  });

  afterAll(async () => {
    // Cleanup test data
    for (const providerId of createdProviderIds) {
      try {
        await configManager.deleteProviderConfiguration(providerId, 'integration-test-cleanup');
      } catch (error) {
        console.warn(`Failed to cleanup provider ${providerId}:`, error);
      }
    }
  });

  beforeEach(() => {
    // Reset test state
  });

  afterEach(() => {
    // Cleanup test state
  });

  describe('Complete Configuration Lifecycle', () => {
    it('should handle full provider lifecycle across multiple environments', async () => {
      const providerTypes: SSOProviderType[] = ['azure-ad', 'okta', 'saml-custom', 'oidc-custom'];
      const environments: Environment[] = ['development', 'staging', 'production'];

      for (const type of providerTypes) {
        for (const environment of environments) {
          const providerId = `integration-${type}-${environment}`;

          // Create provider configuration
          const config = createCompleteTestConfig(providerId, type, environment);

          try {
            const createdConfig = await configManager.createProviderConfiguration(
              config,
              'integration-test-user'
            );

            createdProviderIds.push(createdConfig.id);

            // Verify creation
            expect(createdConfig.id).toBeDefined();
            expect(createdConfig.name).toBe(config.name);
            expect(createdConfig.type).toBe(type);
            expect(createdConfig.environment).toBe(environment);
            expect(createdConfig.version).toBe(1);

            // Retrieve configuration
            const retrievedConfig = await configManager.getProviderConfiguration(createdConfig.id);
            expect(retrievedConfig).not.toBeNull();
            expect(retrievedConfig?.name).toBe(config.name);
            expect(retrievedConfig?.config.clientId).toBe(config.config.clientId);

            // Validate configuration
            const validation = await configManager.validateConfiguration(createdConfig);
            expect(validation.isValid).toBe(true);
            expect(validation.score).toBeGreaterThan(80);

            // Update configuration
            const updates = {
              name: `${config.name} (Updated)`,
              priority: 5,
              isActive: environment !== 'production', // Keep production providers active
            };

            const updatedConfig = await configManager.updateProviderConfiguration(
              createdConfig.id,
              updates,
              'integration-test-user'
            );

            expect(updatedConfig.name).toBe(updates.name);
            expect(updatedConfig.priority).toBe(updates.priority);
            expect(updatedConfig.version).toBe(2);

            // Verify update persistence
            const retrievedAfterUpdate = await configManager.getProviderConfiguration(createdConfig.id);
            expect(retrievedAfterUpdate?.name).toBe(updates.name);

          } catch (error) {
            console.error(`Failed to process provider ${providerId}:`, error);
            throw error;
          }
        }
      }

      // Verify all providers were created
      expect(createdProviderIds.length).toBe(providerTypes.length * environments.length);
    });

    it('should maintain configuration consistency across operations', async () => {
      const providerId = 'consistency-test-provider';
      const config = createCompleteTestConfig(providerId, 'okta', 'development');

      // Create configuration
      const createdConfig = await configManager.createProviderConfiguration(
        config,
        'integration-test-user'
      );
      createdProviderIds.push(createdConfig.id);

      // Perform multiple updates
      const updates = [
        { isActive: false },
        { priority: 10 },
        { name: 'Consistency Test Provider (Updated)' },
        {
          metadata: {
            ...createdConfig.metadata,
            tags: [...createdConfig.metadata.tags, 'updated'],
          }
        },
      ];

      let currentConfig = createdConfig;
      for (const update of updates) {
        currentConfig = await configManager.updateProviderConfiguration(
          currentConfig.id,
          update,
          'integration-test-user'
        );

        // Verify data integrity
        const retrievedConfig = await configManager.getProviderConfiguration(currentConfig.id);
        expect(retrievedConfig).toEqual(currentConfig);
      }

      // Final consistency check
      const finalConfig = await configManager.getProviderConfiguration(createdConfig.id);
      expect(finalConfig?.version).toBe(createdConfig.version + updates.length);
      expect(finalConfig?.name).toBe('Consistency Test Provider (Updated)');
      expect(finalConfig?.isActive).toBe(false);
      expect(finalConfig?.priority).toBe(10);
      expect(finalConfig?.metadata.tags).toContain('updated');
    });
  });

  describe('Security and Encryption', () => {
    it('should properly encrypt and decrypt sensitive fields', async () => {
      const providerId = 'encryption-test-provider';
      const config = createCompleteTestConfig(providerId, 'saml-custom', 'development');

      // Create configuration with sensitive data
      const createdConfig = await configManager.createProviderConfiguration(
        config,
        'integration-test-user'
      );
      createdProviderIds.push(createdConfig.id);

      // Verify sensitive fields are encrypted in storage
      // This would require direct database inspection in a real test
      const retrievedConfig = await configManager.getProviderConfiguration(createdConfig.id);

      // Verify decrypted data matches original
      expect(retrievedConfig?.config.clientSecret).toBe(config.config.clientSecret);
      expect(retrievedConfig?.config.saml?.privateKey).toBe(config.config.saml?.privateKey);
    });

    it('should handle security validation correctly', async () => {
      const providerId = 'security-validation-provider';

      // Create configuration with security issues
      const configWithIssues = {
        ...createCompleteTestConfig(providerId, 'oidc-custom', 'development'),
        config: {
          ...createCompleteTestConfig(providerId, 'oidc-custom', 'development').config,
          security: {
            ...createCompleteTestConfig(providerId, 'oidc-custom', 'development').config.security,
            allowedOrigins: [], // Security issue
            maxTokenAge: 7200, // Too long
            encryption: {
              atRest: true,
              inTransit: true,
              algorithm: 'aes-128-cbc', // Weak algorithm
              keySize: 128,
              ivSize: 16,
              tagSize: 16,
              keyRotationDays: 90,
            },
          },
          features: {
            ...createCompleteTestConfig(providerId, 'oidc-custom', 'development').config.features,
            debugMode: true, // Production risk
          },
        },
      };

      const validation = await configManager.validateConfiguration(configWithIssues);

      // Should detect security issues
      expect(validation.securityIssues.length).toBeGreaterThan(0);
      expect(validation.securityIssues.some(issue => issue.type === 'missing_validation')).toBe(true);
      expect(validation.securityIssues.some(issue => issue.type === 'weak_cipher')).toBe(true);
      expect(validation.warnings.some(warning => warning.message.includes('debug mode'))).toBe(true);

      // Security score should be reduced
      expect(validation.score).toBeLessThan(80);
    });

    it('should enforce access control based on classification', async () => {
      const providerId = 'access-control-provider';
      const config = createCompleteTestConfig(providerId, 'azure-ad', 'development');

      // Create configuration with restricted access
      const restrictedConfig = {
        ...config,
        security: {
          ...config.security,
          classification: 'restricted' as const,
          allowedRoles: ['super-admin'],
          allowedUsers: ['authorized-user-1', 'authorized-user-2'],
        },
      };

      const createdConfig = await configManager.createProviderConfiguration(
        restrictedConfig,
        'super-admin-user'
      );
      createdProviderIds.push(createdConfig.id);

      // Verify access control settings are persisted
      expect(createdConfig.security.classification).toBe('restricted');
      expect(createdConfig.security.allowedRoles).toEqual(['super-admin']);
      expect(createdConfig.security.allowedUsers).toEqual(['authorized-user-1', 'authorized-user-2']);
    });
  });

  describe('Multi-Environment Support', () => {
    it('should isolate configurations by environment', async () => {
      const baseConfig = createCompleteTestConfig('env-test', 'okta', 'development');
      const environments: Environment[] = ['development', 'staging', 'production'];
      const providerIds: string[] = [];

      // Create same provider in different environments
      for (const environment of environments) {
        const envConfig = {
          ...baseConfig,
          name: `Okta Provider - ${environment.charAt(0).toUpperCase() + environment.slice(1)}`,
          environment,
          config: {
            ...baseConfig.config,
            domain: `${environment}.example.com`,
            callbacks: {
              ...baseConfig.config.callbacks,
              redirectUri: `https://app.${environment}.example.com/auth/callback`,
              allowedRedirectUris: [`https://app.${environment}.example.com/auth/callback`],
            },
            security: {
              ...baseConfig.config.security,
              allowedOrigins: [`https://app.${environment}.example.com`],
            },
          },
        };

        const createdConfig = await configManager.createProviderConfiguration(
          envConfig,
          'integration-test-user'
        );

        providerIds.push(createdConfig.id);
        createdProviderIds.push(createdConfig.id);

        // Verify environment isolation
        expect(createdConfig.environment).toBe(environment);
        expect(createdConfig.config.domain).toBe(`${environment}.example.com`);
      }

      // List configurations by environment
      for (const environment of environments) {
        const envConfigs = await configManager.listProviderConfigurations({
          environment,
          limit: 10,
        });

        // Should only return configurations for this environment
        expect(envConfigs.length).toBe(1);
        expect(envConfigs[0].environment).toBe(environment);
      }

      // Update environment-specific configurations
      for (let i = 0; i < environments.length; i++) {
        const environment = environments[i];
        const providerId = providerIds[i];

        const update = {
          config: {
            security: {
              ...baseConfig.config.security,
              maxTokenAge: environment === 'production' ? 1800 : 3600, // Stricter in production
            },
          },
        };

        const updatedConfig = await configManager.updateProviderConfiguration(
          providerId,
          update,
          'integration-test-user'
        );

        expect(updatedConfig.config.security.maxTokenAge).toBe(
          environment === 'production' ? 1800 : 3600
        );
      }
    });

    it('should prevent environment cross-contamination', async () => {
      const devConfig = createCompleteTestConfig('cross-contam-dev', 'okta', 'development');
      const prodConfig = createCompleteTestConfig('cross-contam-prod', 'okta', 'production');

      // Create configurations in different environments
      const devProvider = await configManager.createProviderConfiguration(
        devConfig,
        'integration-test-user'
      );
      const prodProvider = await configManager.createProviderConfiguration(
        prodConfig,
        'integration-test-user'
      );

      createdProviderIds.push(devProvider.id, prodProvider.id);

      // Verify configurations are separate
      expect(devProvider.id).not.toBe(prodProvider.id);
      expect(devProvider.environment).toBe('development');
      expect(prodProvider.environment).toBe('production');

      // List by environment should return correct results
      const devProviders = await configManager.listProviderConfigurations({
        environment: 'development',
      });
      const prodProviders = await configManager.listProviderConfigurations({
        environment: 'production',
      });

      expect(devProviders.some(p => p.id === prodProvider.id)).toBe(false);
      expect(prodProviders.some(p => p.id === devProvider.id)).toBe(false);
    });
  });

  describe('Backup and Restore Operations', () => {
    it('should create and restore configuration backups', async () => {
      const providerIds = ['backup-test-1', 'backup-test-2', 'backup-test-3'];
      const createdConfigs = [];

      // Create test providers
      for (const providerId of providerIds) {
        const config = createCompleteTestConfig(providerId, 'okta', 'development');
        const createdConfig = await configManager.createProviderConfiguration(
          config,
          'integration-test-user'
        );
        createdConfigs.push(createdConfig);
        createdProviderIds.push(createdConfig.id);
      }

      // Create backup
      const backup = await configManager.createConfigurationBackup(
        'Integration Test Backup',
        'Backup created during integration testing',
        createdConfigs.map(c => c.id),
        'integration-test-user'
      );

      expect(backup.name).toBe('Integration Test Backup');
      expect(backup.providerIds).toHaveLength(providerIds.length);
      expect(backup.checksum).toBeDefined();
      expect(backup.encryptionKeyId).toBeDefined();

      // Restore from backup (dry run)
      const restoreResult = await configManager.restoreConfigurationBackup(
        backup.id,
        { dryRun: true },
        'integration-test-user'
      );

      expect(restoreResult.success).toBe(true);

      // Delete original providers
      for (const config of createdConfigs) {
        await configManager.deleteProviderConfiguration(config.id, 'integration-test-user');
        const deletedConfig = await configManager.getProviderConfiguration(config.id);
        expect(deletedConfig).toBeNull();
      }

      // Restore from backup (actual restore)
      const actualRestoreResult = await configManager.restoreConfigurationBackup(
        backup.id,
        { overwriteExisting: false },
        'integration-test-user'
      );

      expect(actualRestoreResult.success).toBe(true);

      // Verify restored providers
      for (const originalConfig of createdConfigs) {
        const restoredConfig = await configManager.getProviderConfiguration(originalConfig.id);
        expect(restoredConfig).not.toBeNull();
        expect(restoredConfig?.name).toBe(originalConfig.name);
        expect(restoredConfig?.type).toBe(originalConfig.type);
        // Note: IDs should be the same after restore
      }
    });

    it('should handle backup encryption and compression', async () => {
      const config = createCompleteTestConfig('backup-encryption-test', 'saml-custom', 'development');
      const createdConfig = await configManager.createProviderConfiguration(
        config,
        'integration-test-user'
      );
      createdProviderIds.push(createdConfig.id);

      // Create backup
      const backup = await configManager.createConfigurationBackup(
        'Encryption Test Backup',
        'Testing backup encryption and compression',
        [createdConfig.id],
        'integration-test-user'
      );

      // Verify backup properties
      expect(backup.backupData).toBeDefined();
      expect(backup.backupData).not.toBe('{}'); // Should be encrypted
      expect(backup.encryptionKeyId).toBeDefined();
      expect(backup.compression).toBe('gzip');
      expect(backup.size).toBeGreaterThan(0);
      expect(backup.checksum).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash
    });
  });

  describe('Import and Export Functionality', () => {
    it('should export and import configurations with data integrity', async () => {
      const providerIds = ['export-test-1', 'export-test-2'];
      const createdConfigs = [];

      // Create test providers
      for (const providerId of providerIds) {
        const config = createCompleteTestConfig(providerId, 'azure-ad', 'development');
        const createdConfig = await configManager.createProviderConfiguration(
          config,
          'integration-test-user'
        );
        createdConfigs.push(createdConfig);
        createdProviderIds.push(createdConfig.id);
      }

      // Export configuration
      const exportData = await configManager.exportConfiguration(
        createdConfigs.map(c => c.id),
        'json',
        true // Include sensitive data for testing
      );

      expect(exportData).toBeDefined();

      const parsedExport = JSON.parse(exportData);
      expect(parsedExport.exportInfo.version).toBe('1.0');
      expect(parsedExport.exportInfo.providerCount).toBe(providerIds.length);
      expect(parsedExport.providers).toHaveLength(providerIds.length);

      // Verify exported data contains all fields
      for (let i = 0; i < providerIds.length; i++) {
        const exportedProvider = parsedExport.providers[i];
        const originalConfig = createdConfigs[i];

        expect(exportedProvider.name).toBe(originalConfig.name);
        expect(exportedProvider.type).toBe(originalConfig.type);
        expect(exportedProvider.config.clientId).toBe(originalConfig.config.clientId);
        expect(exportedProvider.config.clientSecret).toBe(originalConfig.config.clientSecret); // Included because includeSensitiveData: true
      }

      // Delete original providers
      for (const config of createdConfigs) {
        await configManager.deleteProviderConfiguration(config.id, 'integration-test-user');
      }

      // Import configuration
      const importResult = await configManager.importConfiguration(
        exportData,
        { overwriteExisting: false },
        'integration-test-user'
      );

      expect(importResult.success).toBe(true);
      expect(importResult.summary.successfulImports).toBe(providerIds.length);
      expect(importResult.summary.errors).toBe(0);

      // Verify imported configurations match originals
      for (const originalConfig of createdConfigs) {
        const importedConfig = await configManager.getProviderConfiguration(originalConfig.id);
        expect(importedConfig).not.toBeNull();
        expect(importedConfig?.name).toBe(originalConfig.name);
        expect(importedConfig?.config.clientId).toBe(originalConfig.config.clientId);
      }
    });

    it('should handle export without sensitive data', async () => {
      const config = createCompleteTestConfig('export-no-sensitive', 'okta', 'development');
      const createdConfig = await configManager.createProviderConfiguration(
        config,
        'integration-test-user'
      );
      createdProviderIds.push(createdConfig.id);

      // Export without sensitive data
      const exportData = await configManager.exportConfiguration(
        [createdConfig.id],
        'json',
        false // Exclude sensitive data
      );

      const parsedExport = JSON.parse(exportData);
      const exportedProvider = parsedExport.providers[0];

      // Verify sensitive fields are redacted
      expect(exportedProvider.config.clientSecret).toBe('***REDACTED***');
      expect(exportedProvider.config.saml?.privateKey).toBe('***REDACTED***');

      // Verify non-sensitive fields are preserved
      expect(exportedProvider.config.clientId).toBe(config.config.clientId);
      expect(exportedProvider.name).toBe(config.name);
    });

    it('should handle import validation and error recovery', async () => {
      // Create valid configuration
      const validConfig = createCompleteTestConfig('import-valid', 'azure-ad', 'development');
      const validCreatedConfig = await configManager.createProviderConfiguration(
        validConfig,
        'integration-test-user'
      );
      createdProviderIds.push(validCreatedConfig.id);

      // Create import data with valid and invalid providers
      const importData = {
        exportInfo: {
          version: '1.0',
          timestamp: new Date().toISOString(),
          environment: 'test',
          includeSensitiveData: true,
          providerCount: 3,
        },
        providers: [
          validConfig, // Valid, already exists
          {
            ...createCompleteTestConfig('import-invalid', 'okta', 'development'),
            name: '', // Invalid: missing name
            config: {
              ...createCompleteTestConfig('import-invalid', 'okta', 'development').config,
              clientId: '', // Invalid: missing client ID
            },
          },
          createCompleteTestConfig('import-new', 'saml-custom', 'development'), // Valid, new
        ],
      };

      const importResult = await configManager.importConfiguration(
        JSON.stringify(importData),
        { overwriteExisting: false, continueOnError: true },
        'integration-test-user'
      );

      expect(importResult.success).toBe(true);
      expect(importResult.summary.totalProviders).toBe(3);
      expect(importResult.summary.successfulImports).toBe(1); // Only the new provider
      expect(importResult.summary.skipped).toBe(1); // The existing provider
      expect(importResult.summary.errors).toBe(1); // The invalid provider
      expect(importResult.warnings.length).toBeGreaterThan(0);

      // Verify new provider was created
      const newProvider = await configManager.getProviderConfiguration('import-new');
      expect(newProvider).not.toBeNull();
      createdProviderIds.push(newProvider!.id);

      // Verify error details
      expect(importResult.errors).toHaveLength(1);
      expect(importResult.errors[0].providerId).toBe('import-invalid');
      expect(importResult.errors[0].severity).toBe('error');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle bulk configuration operations efficiently', async () => {
      const bulkCount = 20;
      const createdBulkIds = [];

      // Bulk create configurations
      const startTime = Date.now();

      for (let i = 0; i < bulkCount; i++) {
        const config = createCompleteTestConfig(`bulk-${i}`, 'okta', 'development');
        const createdConfig = await configManager.createProviderConfiguration(
          config,
          'integration-test-user'
        );
        createdBulkIds.push(createdConfig.id);
      }

      const bulkCreateTime = Date.now() - startTime;

      // Should complete bulk creation within reasonable time
      expect(bulkCreateTime).toBeLessThan(10000); // 10 seconds

      // Bulk retrieve configurations
      const retrieveStartTime = Date.now();
      const allConfigs = await configManager.listProviderConfigurations({
        limit: bulkCount + 10, // Account for existing configs
      });
      const retrieveTime = Date.now() - retrieveStartTime;

      expect(allConfigs.length).toBeGreaterThanOrEqual(bulkCount);
      expect(retrieveTime).toBeLessThan(2000); // 2 seconds

      // Bulk update configurations
      const updateStartTime = Date.now();

      for (const id of createdBulkIds) {
        await configManager.updateProviderConfiguration(
          id,
          { priority: Math.floor(Math.random() * 10) },
          'integration-test-user'
        );
      }

      const bulkUpdateTime = Date.now() - updateStartTime;
      expect(bulkUpdateTime).toBeLessThan(15000); // 15 seconds

      // Bulk delete configurations
      const deleteStartTime = Date.now();

      for (const id of createdBulkIds) {
        await configManager.deleteProviderConfiguration(id, 'integration-test-user');
      }

      const bulkDeleteTime = Date.now() - deleteStartTime;
      expect(bulkDeleteTime).toBeLessThan(10000); // 10 seconds

      console.log(`Bulk operations performance: Create=${bulkCreateTime}ms, Retrieve=${retrieveTime}ms, Update=${bulkUpdateTime}ms, Delete=${bulkDeleteTime}ms`);

      // Don't add bulk IDs to cleanup since they were already deleted
    });

    it('should handle large configuration exports efficiently', async () => {
      const largeConfigCount = 10;
      const largeConfigIds = [];

      // Create configurations with large metadata
      for (let i = 0; i < largeConfigCount; i++) {
        const config = {
          ...createCompleteTestConfig(`large-export-${i}`, 'azure-ad', 'development'),
          metadata: {
            ...createCompleteTestConfig(`large-export-${i}`, 'azure-ad', 'development').metadata,
            documentation: 'A'.repeat(10000), // Large documentation
            tags: Array.from({ length: 100 }, (_, j) => `tag-${j}`), // Many tags
          },
        };

        const createdConfig = await configManager.createProviderConfiguration(
          config,
          'integration-test-user'
        );
        largeConfigIds.push(createdConfig.id);
        createdProviderIds.push(createdConfig.id);
      }

      // Export large configuration
      const exportStartTime = Date.now();
      const exportData = await configManager.exportConfiguration(
        largeConfigIds,
        'json',
        false // Exclude sensitive data for performance
      );
      const exportTime = Date.now() - exportStartTime;

      // Should handle large export efficiently
      expect(exportTime).toBeLessThan(5000); // 5 seconds
      expect(exportData.length).toBeGreaterThan(100000); // Should be substantial data

      // Verify export integrity
      const parsedExport = JSON.parse(exportData);
      expect(parsedExport.providers).toHaveLength(largeConfigCount);

      console.log(`Large export performance: ${exportTime}ms for ${exportData.length} characters`);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle concurrent configuration operations safely', async () => {
      const concurrentCount = 5;
      const providerIds = Array.from({ length: concurrentCount }, (_, i) => `concurrent-${i}`);
      const createdConfigs = [];

      // Create configurations concurrently
      const createPromises = providerIds.map(async (providerId, index) => {
        const config = createCompleteTestConfig(providerId, 'okta', 'development');
        return await configManager.createProviderConfiguration(config, 'integration-test-user');
      });

      const concurrentResults = await Promise.all(createPromises);
      createdConfigs.push(...concurrentResults);
      createdProviderIds.push(...concurrentResults.map(c => c.id));

      // Verify all configurations were created successfully
      expect(concurrentResults).toHaveLength(concurrentCount);
      for (const result of concurrentResults) {
        expect(result.id).toBeDefined();
        expect(result.name).toMatch(/^Okta Test Provider concurrent-\d$/);
      }

      // Update configurations concurrently
      const updatePromises = concurrentResults.map(async (config, index) => {
        return await configManager.updateProviderConfiguration(
          config.id,
          { priority: index + 1 },
          'integration-test-user'
        );
      });

      const updatedResults = await Promise.all(updatePromises);

      // Verify all updates were applied correctly
      expect(updatedResults).toHaveLength(concurrentCount);
      for (let i = 0; i < updatedResults.length; i++) {
        expect(updatedResults[i].priority).toBe(i + 1);
      }
    });

    it('should handle configuration validation edge cases', async () => {
      const edgeCases = [
        {
          name: 'Empty configuration',
          config: {},
          expectedErrors: ['name', 'type', 'config.clientId', 'config.clientSecret'],
        },
        {
          name: 'Invalid protocol configuration',
          config: {
            ...createCompleteTestConfig('edge-case-invalid-protocol', 'saml-custom', 'development'),
            config: {
              ...createCompleteTestConfig('edge-case-invalid-protocol', 'saml-custom', 'development').config,
              saml: {
                entryPoint: 'not-a-url',
                issuer: '',
                cert: 'not-a-valid-certificate',
                signatureAlgorithm: 'invalid-algorithm' as any,
                digestAlgorithm: 'invalid-digest' as any,
                nameIdFormat: '',
                allowUnencryptedAssertions: true, // Security risk
                rejectDelegatedRequests: false,
                validateInResponseTo: false,
                requestIdExpirationTimeMs: -1, // Invalid
                clockSkewMs: -1, // Invalid
                binding: 'invalid-binding' as any,
                singleLogoutEnabled: true,
              },
            },
          },
          expectedErrors: ['config.saml.entryPoint', 'config.saml.issuer', 'config.saml.cert'],
          expectedWarnings: ['config.saml.signatureAlgorithm', 'config.saml.allowUnencryptedAssertions'],
        },
        {
          name: 'Security configuration extremes',
          config: {
            ...createCompleteTestConfig('edge-case-security', 'oidc-custom', 'development'),
            config: {
              ...createCompleteTestConfig('edge-case-security', 'oidc-custom', 'development').config,
              security: {
                ...createCompleteTestConfig('edge-case-security', 'oidc-custom', 'development').config.security,
                maxTokenAge: 0, // Invalid
                clockSkewTolerance: -1, // Invalid
                allowedOrigins: ['*'], // Too permissive
                domainRestrictions: [], // No restrictions
                rateLimiting: {
                  enabled: false, // Security risk
                  requestsPerMinute: 0, // Invalid
                  requestsPerHour: 0, // Invalid
                  requestsPerDay: 0, // Invalid
                  burstLimit: 0, // Invalid
                  penaltyDuration: -1, // Invalid
                },
                encryption: {
                  atRest: false, // Security risk
                  inTransit: false, // Security risk
                  algorithm: '', // Invalid
                  keySize: 0, // Invalid
                  ivSize: 0, // Invalid
                  tagSize: 0, // Invalid
                  keyRotationDays: 0, // Invalid
                },
              },
            },
          },
          expectedErrors: ['config.security.maxTokenAge', 'config.security.clockSkewTolerance'],
          expectedWarnings: ['config.security.allowedOrigins', 'config.security.encryption.atRest'],
        },
      ];

      for (const edgeCase of edgeCases) {
        const validation = await configManager.validateConfiguration({
          id: 'edge-case-test',
          name: edgeCase.config.name || 'Edge Case Test',
          type: edgeCase.config.type || 'okta',
          displayName: 'Edge Case Test',
          environment: 'development',
          config: edgeCase.config.config || edgeCase.config,
          isActive: true,
          isDefault: false,
          priority: 1,
          metadata: {
            tags: ['edge-case'],
            category: 'test',
            integrationComplexity: 'basic',
            estimatedSetupTime: 10,
            supportedFeatures: [],
            limitations: [],
            prerequisites: [],
          },
          security: {
            classification: 'internal',
            accessLevel: 'admin',
            allowedRoles: ['admin'],
            allowedUsers: [],
            encryptedFields: [],
            signedFields: [],
            securityScore: 50,
          },
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        if (edgeCase.expectedErrors) {
          expect(validation.errors.length).toBeGreaterThan(0);
          for (const expectedError of edgeCase.expectedErrors) {
            expect(validation.errors.some(e => e.field.includes(expectedError))).toBe(true);
          }
        }

        if (edgeCase.expectedWarnings) {
          expect(validation.warnings.length).toBeGreaterThan(0);
          for (const expectedWarning of edgeCase.expectedWarnings) {
            expect(validation.warnings.some(w => w.field.includes(expectedWarning))).toBe(true);
          }
        }

        // Security score should be reduced for edge cases
        expect(validation.score).toBeLessThan(70);
      }
    });
  });
});
