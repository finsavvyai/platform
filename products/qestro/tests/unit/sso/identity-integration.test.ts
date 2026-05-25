import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { IdentityIntegrationService, IdentityIntegrationConfig, UserProvisioningConfig } from '../../../src/services/sso/identity-integration';
import { SSOProviderManager, SSOUserInfo, SSOProviderType } from '../../../src/services/sso/provider-manager';
import { SAMLParser } from '../../../src/services/sso/saml-parser';

// Mock dependencies
const mockProviderManager = {
  getProvider: jest.fn(),
  getAvailableProviders: jest.fn(),
} as any;

const mockDbService = {
  query: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
} as any;

const mockUserService = {
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  assignRoles: jest.fn(),
  assignRole: jest.fn(),
  addToGroup: jest.fn(),
  findRolesByUserId: jest.fn(),
  findGroupsByUserId: jest.fn(),
} as any;

const mockAuditLogger = {
  log: jest.fn(),
} as any;

describe('IdentityIntegrationService', () => {
  let service: IdentityIntegrationService;
  let config: IdentityIntegrationConfig;

  beforeEach(() => {
    config = {
      providers: {
        'azure-ad': {
          autoProvision: true,
          defaultRoles: ['user'],
          requireApproval: false,
          allowedDomains: ['company.com', 'test.com'],
          blockedDomains: ['spam.com'],
          syncInterval: 60,
          attributeMapping: {
            'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'email',
            'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname': 'firstName',
            'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname': 'lastName',
            'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'name',
            'http://schemas.microsoft.com/claims/authnclassreference': 'roles',
            'groups': 'groups',
          },
          groupMapping: {
            'Developers': 'dev-team',
            'QA-Team': 'qa-team',
          },
          roleMapping: {
            'User': 'user',
            'Admin': 'admin',
          },
        },
        'okta': {
          autoProvision: true,
          defaultRoles: ['user'],
          requireApproval: false,
          allowedDomains: ['company.com'],
          blockedDomains: [],
          syncInterval: 30,
          attributeMapping: {
            'email': 'email',
            'firstName': 'firstName',
            'lastName': 'lastName',
            'name': 'name',
            'groups': 'groups',
          },
          groupMapping: {},
          roleMapping: {},
        },
      },
      globalSettings: {
        syncInterval: 60,
        enableRealTimeSync: true,
        enableAuditLogging: true,
        requireEmailVerification: false,
        enableJustInTimeProvisioning: true,
      },
    };

    service = new IdentityIntegrationService(
      mockProviderManager,
      mockDbService,
      mockUserService,
      mockAuditLogger,
      config
    );

    jest.clearAllMocks();
  });

  afterEach(() => {
    service.cleanup();
  });

  describe('User Provisioning', () => {
    describe('New User Creation', () => {
      it('should provision a new user successfully', async () => {
        // Arrange
        const providerId = 'azure-ad';
        const userInfo: SSOUserInfo = {
          id: 'azure-user-123',
          email: 'test.user@company.com',
          name: 'Test User',
          firstName: 'Test',
          lastName: 'User',
          emailVerified: true,
          attributes: {
            department: 'Engineering',
            title: 'Software Engineer',
          },
          groups: ['Developers', 'All-Users'],
          roles: ['User'],
        };

        const tokens = {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        };

        // Mock user creation
        const mockUser = {
          id: 'local-user-456',
          email: 'test.user@company.com',
          name: 'Test User',
          firstName: 'Test',
          lastName: 'User',
          isActive: true,
          createdAt: new Date(),
        };

        mockUserService.create.mockResolvedValue(mockUser);

        // Act
        const result = await service.processAuthentication(providerId, userInfo, tokens);

        // Assert
        expect(result.isNewUser).toBe(true);
        expect(result.user).toEqual(mockUser);
        expect(result.syncResult.success).toBe(true);
        expect(result.syncResult.action).toBe('created');

        expect(mockUserService.create).toHaveBeenCalledWith({
          email: 'test.user@company.com',
          name: 'Test User',
          firstName: 'Test',
          lastName: 'User',
          avatar: '',
          emailVerified: true,
          source: 'sso',
          sourceProvider: 'azure-ad',
          isActive: true,
          lastLoginAt: expect.any(Date),
        });

        expect(mockUserService.assignRoles).toHaveBeenCalledWith(mockUser.id, ['user']);
        expect(mockAuditLogger.log).toHaveBeenCalledWith({
          event: 'user_provisioned',
          providerId,
          userId: mockUser.id,
          providerUserId: userInfo.id,
          action: 'created',
          timestamp: expect.any(Date),
        });
      });

      it('should reject users from blocked domains', async () => {
        const providerId = 'azure-ad';
        const userInfo: SSOUserInfo = {
          id: 'azure-user-123',
          email: 'malicious@spam.com', // Blocked domain
          name: 'Malicious User',
        };

        const tokens = { accessToken: 'access-token' };

        // Act & Assert
        await expect(
          service.processAuthentication(providerId, userInfo, tokens)
        ).rejects.toThrow('Email domain not allowed: malicious@spam.com');
      });

      it('should reject users from non-allowed domains when restrictions exist', async () => {
        const providerId = 'okta'; // Has allowedDomains: ['company.com']
        const userInfo: SSOUserInfo = {
          id: 'okta-user-123',
          email: 'user@external.com', // Not in allowed domains
          name: 'External User',
        };

        const tokens = { accessToken: 'access-token' };

        // Act & Assert
        await expect(
          service.processAuthentication(providerId, userInfo, tokens)
        ).rejects.toThrow('Email domain not allowed: user@external.com');
      });

      it('should handle approval requirement for new users', async () => {
        // Modify config to require approval
        config.providers['azure-ad'].requireApproval = true;

        const providerId = 'azure-ad';
        const userInfo: SSOUserInfo = {
          id: 'azure-user-123',
          email: 'test.user@company.com',
          name: 'Test User',
        };

        const tokens = { accessToken: 'access-token' };

        // Act & Assert
        await expect(
          service.processAuthentication(providerId, userInfo, tokens)
        ).rejects.toThrow('Approval flow not implemented');
      });
    });

    describe('Existing User Updates', () => {
      it('should update existing user with new attributes', async () => {
        // Arrange
        const providerId = 'azure-ad';
        const userInfo: SSOUserInfo = {
          id: 'azure-user-123',
          email: 'updated.user@company.com',
          name: 'Updated User',
          firstName: 'Updated',
          lastName: 'User',
          attributes: {
            department: 'Product',
            title: 'Product Manager',
          },
          groups: ['Product-Team'],
        };

        const tokens = { accessToken: 'access-token' };

        const mockUser = {
          id: 'local-user-456',
          email: 'old.user@company.com',
          name: 'Old User',
          firstName: 'Old',
          lastName: 'User',
          department: 'Engineering',
          title: 'Software Engineer',
          lastLoginAt: new Date('2023-01-01'),
        };

        // Mock existing user found
        jest.spyOn(service as any, 'findIdentityMapping').mockResolvedValue({
          userId: mockUser.id,
          providerId,
          providerUserId: userInfo.id,
        });

        mockUserService.findById.mockResolvedValue(mockUser);
        mockUserService.update.mockResolvedValue({ ...mockUser, ...userInfo });

        // Act
        const result = await service.processAuthentication(providerId, userInfo, tokens);

        // Assert
        expect(result.isNewUser).toBe(false);
        expect(result.syncResult.success).toBe(true);
        expect(result.syncResult.action).toBe('updated');
        expect(result.syncResult.changes).toContain('Updated email');
        expect(result.syncResult.changes).toContain('Updated name');
        expect(result.syncResult.changes).toContain('Updated firstName');
        expect(result.syncResult.changes).toContain('Updated lastName');

        expect(mockUserService.update).toHaveBeenCalledWith(mockUser.id, expect.objectContaining({
          email: 'updated.user@company.com',
          name: 'Updated User',
          firstName: 'Updated',
          lastName: 'User',
          lastLoginAt: expect.any(Date),
        }));

        expect(mockAuditLogger.log).toHaveBeenCalledWith({
          event: 'user_updated',
          providerId,
          userId: mockUser.id,
          providerUserId: userInfo.id,
          action: 'updated',
          changes: expect.arrayContaining([
            'Updated email',
            'Updated name',
            'Updated firstName',
            'Updated lastName',
            'Updated last login',
          ]),
          timestamp: expect.any(Date),
        });
      });

      it('should update login timestamp for stale logins', async () => {
        const providerId = 'azure-ad';
        const userInfo: SSOUserInfo = {
          id: 'azure-user-123',
          email: 'test.user@company.com',
          name: 'Test User',
        };

        const tokens = { accessToken: 'access-token' };

        const mockUser = {
          id: 'local-user-456',
          email: 'test.user@company.com',
          name: 'Test User',
          lastLoginAt: new Date('2023-01-01'), // Very old login
        };

        // Mock existing user found
        jest.spyOn(service as any, 'findIdentityMapping').mockResolvedValue({
          userId: mockUser.id,
          providerId,
          providerUserId: userInfo.id,
        });

        mockUserService.findById.mockResolvedValue(mockUser);
        mockUserService.update.mockResolvedValue(mockUser);

        // Act
        const result = await service.processAuthentication(providerId, userInfo, tokens);

        // Assert
        expect(result.syncResult.changes).toContain('Updated last login');
        expect(mockUserService.update).toHaveBeenCalledWith(mockUser.id, expect.objectContaining({
          lastLoginAt: expect.any(Date),
        }));
      });
    });
  });

  describe('Group and Role Synchronization', () => {
    it('should sync user groups and create group mappings', async () => {
      const providerId = 'azure-ad';
      const userInfo: SSOUserInfo = {
        id: 'azure-user-123',
        email: 'test.user@company.com',
        name: 'Test User',
        groups: ['Developers', 'QA-Team', 'New-Group'],
      };

      const tokens = { accessToken: 'access-token' };

      const mockUser = { id: 'local-user-456' };

      // Mock existing user found
      jest.spyOn(service as any, 'findIdentityMapping').mockResolvedValue({
        userId: mockUser.id,
        providerId,
        providerUserId: userInfo.id,
      });

      mockUserService.findById.mockResolvedValue(mockUser);

      // Mock group operations
      jest.spyOn(service as any, 'findGroupByName').mockImplementation(async (name: string) => {
        if (name === 'dev-team' || name === 'qa-team') {
          return { id: name + '-id', name };
        }
        return null; // New group
      });

      jest.spyOn(service as any, 'createGroup').mockImplementation(async (groupData: any) => ({
        id: groupData.name + '-id',
        ...groupData,
      }));

      jest.spyOn(service as any, 'findGroupMapping').mockResolvedValue(null);
      jest.spyOn(service as any, 'createGroupMapping').mockResolvedValue({});

      // Act
      await service.processAuthentication(providerId, userInfo, tokens);

      // Assert
      // Should map 'Developers' to 'dev-team' (existing group)
      expect(service as any).toHaveBeenCalledWith('dev-team');

      // Should map 'QA-Team' to 'qa-team' (existing group)
      expect(service as any).toHaveBeenCalledWith('qa-team');

      // Should create new group 'New-Group'
      expect(service as any).toHaveBeenCalledWith({
        name: 'New-Group',
        displayName: 'New-Group',
        description: 'Auto-created from provider azure-ad',
        isActive: true,
      });

      expect(mockUserService.addToGroup).toHaveBeenCalledTimes(3);
    });

    it('should sync user roles with role mapping', async () => {
      const providerId = 'azure-ad';
      const userInfo: SSOUserInfo = {
        id: 'azure-user-123',
        email: 'test.user@company.com',
        name: 'Test User',
        roles: ['User', 'Admin'],
      };

      const tokens = { accessToken: 'access-token' };

      const mockUser = { id: 'local-user-456' };

      // Mock existing user found
      jest.spyOn(service as any, 'findIdentityMapping').mockResolvedValue({
        userId: mockUser.id,
        providerId,
        providerUserId: userInfo.id,
      });

      mockUserService.findById.mockResolvedValue(mockUser);

      // Mock role operations
      jest.spyOn(service as any, 'findRoleByName').mockImplementation(async (name: string) => ({
        id: name + '-id',
        name,
      }));

      jest.spyOn(service as any, 'createRoleMapping').mockResolvedValue({});

      // Act
      await service.processAuthentication(providerId, userInfo, tokens);

      // Assert
      expect(service as any).toHaveBeenCalledWith('user');
      expect(service as any).toHaveBeenCalledWith('admin');
      expect(mockUserService.assignRole).toHaveBeenCalledWith(mockUser.id, 'user-id');
      expect(mockUserService.assignRole).toHaveBeenCalledWith(mockUser.id, 'admin-id');
    });
  });

  describe('User Deactivation', () => {
    it('should deactivate user when removed from identity provider', async () => {
      const providerId = 'azure-ad';
      const providerUserId = 'azure-user-123';

      const mockMapping = {
        id: 'mapping-123',
        userId: 'local-user-456',
        providerId,
        providerUserId,
      };

      const mockUser = {
        id: 'local-user-456',
        email: 'test.user@company.com',
        isActive: true,
      };

      // Mock mapping and user found
      jest.spyOn(service as any, 'findIdentityMappingByProviderUser').mockResolvedValue(mockMapping);
      mockUserService.findById.mockResolvedValue(mockUser);
      mockUserService.update.mockResolvedValue({ ...mockUser, isActive: false });
      jest.spyOn(service as any, 'deactivateIdentityMapping').mockResolvedValue(undefined);

      // Act
      const result = await service.deactivateUser(providerId, providerUserId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.action).toBe('deactivated');
      expect(mockUserService.update).toHaveBeenCalledWith(mockUser.id, { isActive: false });

      expect(mockAuditLogger.log).toHaveBeenCalledWith({
        event: 'user_deactivated',
        providerId,
        userId: mockUser.id,
        providerUserId,
        action: 'deactivated',
        timestamp: expect.any(Date),
      });
    });

    it('should throw error when identity mapping not found', async () => {
      const providerId = 'azure-ad';
      const providerUserId = 'nonexistent-user';

      // Mock no mapping found
      jest.spyOn(service as any, 'findIdentityMappingByProviderUser').mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.deactivateUser(providerId, providerUserId)
      ).rejects.toThrow('Identity mapping not found');
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration and restart sync timers', async () => {
      const newConfig = {
        providers: {
          ...config.providers,
          'new-provider': {
            autoProvision: true,
            defaultRoles: ['user'],
            requireApproval: false,
            allowedDomains: ['newcompany.com'],
            blockedDomains: [],
            syncInterval: 120,
            attributeMapping: {},
            groupMapping: {},
            roleMapping: {},
          },
        },
      };

      // Mock cleanup to track if it's called
      const cleanupSpy = jest.spyOn(service as any, 'cleanup');

      // Act
      service.updateConfig(newConfig);

      // Assert
      expect(cleanupSpy).toHaveBeenCalled();
      expect(service['config'].providers['new-provider']).toBeDefined();
    });

    it('should provide sync status for all providers', async () => {
      // Mock active mappings
      jest.spyOn(service as any, 'getActiveIdentityMappings').mockImplementation(async (providerId: string) => {
        if (providerId === 'azure-ad') {
          return [
            { lastSyncAt: new Date('2023-01-01T10:00:00Z') },
            { lastSyncAt: new Date('2023-01-01T11:00:00Z') },
          ];
        }
        return [];
      });

      // Act
      const status = await service.getSyncStatus();

      // Assert
      expect(status['azure-ad']).toEqual({
        totalMappings: 2,
        lastSyncAt: new Date('2023-01-01T11:00:00Z').getTime(),
        isActive: true,
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const providerId = 'azure-ad';
      const userInfo: SSOUserInfo = {
        id: 'azure-user-123',
        email: 'test.user@company.com',
        name: 'Test User',
      };

      const tokens = { accessToken: 'access-token' };

      // Mock database error
      mockUserService.findById.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(
        service.processAuthentication(providerId, userInfo, tokens)
      ).rejects.toThrow('Identity integration failed: Database connection failed');

      expect(mockAuditLogger.log).toHaveBeenCalledWith({
        event: 'identity_integration_error',
        providerId,
        error: 'Database connection failed',
        timestamp: expect.any(Date),
      });
    });

    it('should handle provider errors during group sync', async () => {
      const providerId = 'azure-ad';
      const userInfo: SSOUserInfo = {
        id: 'azure-user-123',
        email: 'test.user@company.com',
        name: 'Test User',
        groups: ['Nonexistent-Group'],
      };

      const tokens = { accessToken: 'access-token' };

      const mockUser = { id: 'local-user-456' };

      // Mock existing user found
      jest.spyOn(service as any, 'findIdentityMapping').mockResolvedValue({
        userId: mockUser.id,
        providerId,
        providerUserId: userInfo.id,
      });

      mockUserService.findById.mockResolvedValue(mockUser);

      // Mock group creation failure
      jest.spyOn(service as any, 'findGroupByName').mockResolvedValue(null);
      jest.spyOn(service as any, 'createGroup').mockRejectedValue(new Error('Group creation failed'));

      // Act - Should not throw, but log warning
      const result = await service.processAuthentication(providerId, userInfo, tokens);

      // Assert
      expect(result.user).toBeDefined();
      // Group sync failure should not prevent user authentication
    });
  });
});

describe('SAMLParser', () => {
  let parser: SAMLParser;

  beforeEach(() => {
    parser = new SAMLParser({ allowedClockSkew: 300 });
  });

  describe('SAML Response Parsing', () => {
    it('should parse valid SAML response', () => {
      // This is a simplified example - real SAML responses would be more complex
      const samlResponse = Buffer.from(`
        <samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                        xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                        ID="_8e8dc5f69a98cc4c1ff3427e5ce34606fd672f91e6"
                        Version="2.0"
                        IssueInstant="2023-01-01T10:00:00Z">
          <saml:Issuer>https://idp.example.com</saml:Issuer>
          <samlp:Status>
            <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success" />
          </samlp:Status>
          <saml:Assertion ID="_6c37f8b0c1234567890abcdef"
                          IssueInstant="2023-01-01T10:00:00Z"
                          Version="2.0">
            <saml:Issuer>https://idp.example.com</saml:Issuer>
            <saml:Subject>
              <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">
                user@example.com
              </saml:NameID>
            </saml:Subject>
            <saml:AttributeStatement>
              <saml:Attribute Name="email">
                <saml:AttributeValue>user@example.com</saml:AttributeValue>
              </saml:Attribute>
              <saml:Attribute Name="name">
                <saml:AttributeValue>Test User</saml:AttributeValue>
              </saml:Attribute>
            </saml:AttributeStatement>
          </saml:Assertion>
        </samlp:Response>
      `).toString('base64');

      const result = parser.parseSAMLResponse(samlResponse);

      expect(result.id).toBe('_8e8dc5f69a98cc4c1ff3427e5ce34606fd672f91e6');
      expect(result.issuer).toBe('https://idp.example.com');
      expect(result.assertion).toBeDefined();
      expect(result.assertion.subject.nameId).toBe('user@example.com');
      expect(result.assertion.attributes.email).toEqual(['user@example.com']);
      expect(result.assertion.attributes.name).toEqual(['Test User']);
    });

    it('should throw error for invalid SAML response', () => {
      const invalidResponse = 'invalid-base64-content';

      expect(() => parser.parseSAMLResponse(invalidResponse)).toThrow();
    });
  });

  describe('SAML Validation', () => {
    it('should validate successful status', async () => {
      const samlResponse = Buffer.from(`
        <samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                        xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                        ID="_123" Version="2.0" IssueInstant="2023-01-01T10:00:00Z">
          <saml:Issuer>https://idp.example.com</saml:Issuer>
          <samlp:Status>
            <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success" />
          </samlp:Status>
          <saml:Assertion ID="_456" IssueInstant="2023-01-01T10:00:00Z" Version="2.0">
            <saml:Issuer>https://idp.example.com</saml:Issuer>
            <saml:Subject>
              <saml:NameID>user@example.com</saml:NameID>
            </saml:Subject>
            <saml:Conditions NotBefore="2023-01-01T09:00:00Z" NotOnOrAfter="2023-01-01T11:00:00Z">
              <saml:AudienceRestriction>
                <saml:Audience>https://sp.example.com</saml:Audience>
              </saml:AudienceRestriction>
            </saml:Conditions>
          </saml:Assertion>
        </samlp:Response>
      `).toString('base64');

      const result = await parser.validateSAMLResponse(samlResponse, {
        expectedIssuer: 'https://idp.example.com',
        expectedAudience: 'https://sp.example.com',
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject expired assertions', async () => {
      // Create expired assertion (1 hour ago)
      const pastTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const samlResponse = Buffer.from(`
        <samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                        xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                        ID="_123" Version="2.0" IssueInstant="${pastTime}">
          <saml:Issuer>https://idp.example.com</saml:Issuer>
          <samlp:Status>
            <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success" />
          </samlp:Status>
          <saml:Assertion ID="_456" IssueInstant="${pastTime}" Version="2.0">
            <saml:Issuer>https://idp.example.com</saml:Issuer>
            <saml:Subject>
              <saml:NameID>user@example.com</saml:NameID>
            </saml:Subject>
            <saml:Conditions NotBefore="${pastTime}" NotOnOrAfter="${pastTime}">
              <saml:AudienceRestriction>
                <saml:Audience>https://sp.example.com</saml:Audience>
              </saml:AudienceRestriction>
            </saml:Conditions>
          </saml:Assertion>
        </samlp:Response>
      `).toString('base64');

      const result = await parser.validateSAMLResponse(samlResponse);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('has expired'));
    });
  });

  describe('User Information Extraction', () => {
    it('should extract user info with attribute mapping', () => {
      const assertion = {
        id: '_456',
        issuer: 'https://idp.example.com',
        subject: {
          nameId: 'user@example.com',
          nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
          subjectConfirmation: [],
        },
        attributes: {
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': ['user@example.com'],
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname': ['Test'],
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname': ['User'],
          'groups': ['Developers', 'QA-Team'],
        },
      };

      const attributeMapping = [
        { samlAttribute: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', userField: 'email' },
        { samlAttribute: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname', userField: 'firstName' },
        { samlAttribute: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname', userField: 'lastName' },
        { samlAttribute: 'groups', userField: 'groups', multiValue: true },
      ];

      const userInfo = parser.extractUserInfo(assertion, attributeMapping);

      expect(userInfo.id).toBe('user@example.com');
      expect(userInfo.email).toBe('user@example.com');
      expect(userInfo.firstName).toBe('Test');
      expect(userInfo.lastName).toBe('User');
      expect(userInfo.groups).toEqual(['Developers', 'QA-Team']);
    });

    it('should handle missing required attributes', () => {
      const assertion = {
        id: '_456',
        issuer: 'https://idp.example.com',
        subject: {
          nameId: 'user@example.com',
          nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
          subjectConfirmation: [],
        },
        attributes: {
          'email': ['user@example.com'],
          // Missing required 'department' attribute
        },
      };

      const attributeMapping = [
        { samlAttribute: 'email', userField: 'email' },
        { samlAttribute: 'department', userField: 'department', required: true },
      ];

      expect(() => parser.extractUserInfo(assertion, attributeMapping)).toThrow(
        'Required SAML attribute missing: department'
      );
    });
  });

  describe('SAML Request Generation', () => {
    it('should create AuthnRequest', () => {
      const authnRequest = parser.createAuthnRequest({
        destination: 'https://idp.example.com/sso',
        requestId: '_123456789',
        ssoUrl: 'https://idp.example.com/sso',
        issuer: 'https://sp.example.com',
        assertionConsumerService: 'https://sp.example.com/saml/acs',
        nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      });

      // Should be base64 encoded XML
      expect(typeof authnRequest).toBe('string');

      // Should decode to valid XML
      const decoded = Buffer.from(authnRequest, 'base64').toString();
      expect(decoded).toContain('AuthnRequest');
      expect(decoded).toContain('https://sp.example.com');
      expect(decoded).toContain('urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress');
    });

    it('should create LogoutRequest', () => {
      const logoutRequest = parser.createLogoutRequest({
        destination: 'https://idp.example.com/logout',
        requestId: '_987654321',
        issuer: 'https://sp.example.com',
        nameId: 'user@example.com',
        sessionIndex: 'session-123',
      });

      // Should be base64 encoded XML
      expect(typeof logoutRequest).toBe('string');

      // Should decode to valid XML
      const decoded = Buffer.from(logoutRequest, 'base64').toString();
      expect(decoded).toContain('LogoutRequest');
      expect(decoded).toContain('user@example.com');
      expect(decoded).toContain('session-123');
    });
  });

  describe('SP Metadata Generation', () => {
    it('should generate SP metadata', () => {
      const metadata = parser.generateSPMetadata({
        entityId: 'https://sp.example.com',
        assertionConsumerService: 'https://sp.example.com/saml/acs',
        sloService: 'https://sp.example.com/saml/slo',
        name: 'Test Application',
        description: 'Test SAML Service Provider',
        organization: {
          name: 'Test Company',
          displayName: 'Test Company Inc.',
          url: 'https://testcompany.com',
        },
        contactPerson: {
          name: 'Admin User',
          email: 'admin@testcompany.com',
        },
      });

      expect(typeof metadata).toBe('string');
      expect(metadata).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(metadata).toContain('EntityDescriptor');
      expect(metadata).toContain('https://sp.example.com');
      expect(metadata).toContain('Test Application');
      expect(metadata).toContain('Test Company');
      expect(metadata).toContain('Admin User');
    });
  });
});
