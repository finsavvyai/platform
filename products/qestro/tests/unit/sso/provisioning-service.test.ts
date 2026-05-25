import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ProvisioningService, ProvisioningConfig } from '../../../../src/services/sso/provisioning-service';
import { IdentityIntegrationService } from '../../../../src/services/sso/identity-integration';
import { SSOProviderManager } from '../../../../src/services/sso/provider-manager';
import { SSOUserInfo } from '../../../../src/services/sso/provider-manager';

// Mock dependencies
const mockIdentityIntegration = {
  processAuthentication: jest.fn(),
} as any;

const mockDbService = {
  query: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
} as any;

const mockUserService = {
  create: jest.fn(),
  findById: jest.fn(),
  findByEmail: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  assignRoles: jest.fn(),
  addToGroup: jest.fn(),
} as any;

const mockAuditLogger = {
  log: jest.fn(),
} as any;

const mockNotificationService = {
  sendEmail: jest.fn(),
  sendAdminNotification: jest.fn(),
} as any;

describe('ProvisioningService', () => {
  let provisioningService: ProvisioningService;
  let mockConfig: Record<string, ProvisioningConfig>;

  beforeEach(() => {
    mockConfig = {
      'azure-ad': {
        enabled: true,
        autoApprove: true,
        requireApprovalForDomains: ['external.com'],
        blocklistedDomains: ['blocked.com'],
        allowedDomains: [],
        defaultRoles: ['user'],
        defaultGroups: ['all-users'],
        welcomeEmail: true,
        notificationSettings: {
          newUser: true,
          profileUpdate: true,
          deactivation: true,
          approvalRequired: true,
        },
        retentionPolicy: {
          keepInactiveUsers: true,
          inactiveDays: 90,
          archiveUsers: false,
        },
      },
      'okta': {
        enabled: true,
        autoApprove: false,
        requireApprovalForDomains: [],
        blocklistedDomains: [],
        allowedDomains: ['company.com'],
        defaultRoles: ['user'],
        defaultGroups: ['all-users'],
        welcomeEmail: false,
        notificationSettings: {
          newUser: false,
          profileUpdate: false,
          deactivation: false,
          approvalRequired: false,
        },
        retentionPolicy: {
          keepInactiveUsers: false,
          inactiveDays: 30,
          archiveUsers: true,
        },
      },
    };

    provisioningService = new ProvisioningService(
      mockIdentityIntegration,
      mockDbService,
      mockUserService,
      mockAuditLogger,
      mockNotificationService,
      mockConfig
    );

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    provisioningService.cleanup();
  });

  describe('processUserLogin', () => {
    const mockUserInfo: SSOUserInfo = {
      id: 'user-123',
      email: 'test.user@company.com',
      name: 'Test User',
      firstName: 'Test',
      lastName: 'User',
      attributes: { department: 'Engineering' },
      groups: ['Developers', 'QA'],
      roles: ['developer'],
    };

    const mockTokens = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
      expiresIn: 3600,
    };

    it('should process new user successfully with auto-approval', async () => {
      // Mock identity integration to return new user
      const mockUser = {
        id: 'internal-user-123',
        email: 'test.user@company.com',
        name: 'Test User',
        isActive: true,
        createdAt: new Date(),
      };

      mockIdentityIntegration.processAuthentication.mockResolvedValue({
        user: mockUser,
        isNewUser: true,
        syncResult: {
          success: true,
          userId: mockUser.id,
          providerId: 'azure-ad',
          providerUserId: mockUserInfo.id,
          action: 'created',
          changes: ['User provisioned'],
        },
      });

      const result = await provisioningService.processUserLogin('azure-ad', mockUserInfo, mockTokens);

      expect(result.isNewUser).toBe(true);
      expect(result.provisioningRequired).toBe(false);
      expect(result.user).toEqual(mockUser);
      expect(mockNotificationService.sendWelcomeEmail).toHaveBeenCalledWith(mockUser, 'azure-ad');
      expect(mockNotificationService.sendAdminNotification).toHaveBeenCalled();
      expect(mockAuditLogger.log).toHaveBeenCalled();
    });

    it('should process existing user update successfully', async () => {
      // Mock identity integration to return existing user
      const mockUser = {
        id: 'internal-user-123',
        email: 'test.user@company.com',
        name: 'Test User Updated',
        isActive: true,
        updatedAt: new Date(),
      };

      mockIdentityIntegration.processAuthentication.mockResolvedValue({
        user: mockUser,
        isNewUser: false,
        syncResult: {
          success: true,
          userId: mockUser.id,
          providerId: 'azure-ad',
          providerUserId: mockUserInfo.id,
          action: 'updated',
          changes: ['Updated profile information'],
        },
      });

      const result = await provisioningService.processUserLogin('azure-ad', mockUserInfo, mockTokens);

      expect(result.isNewUser).toBe(false);
      expect(result.provisioningRequired).toBe(false);
      expect(result.user).toEqual(mockUser);
      expect(mockNotificationService.sendWelcomeEmail).not.toHaveBeenCalled();
      expect(mockNotificationService.sendEmail).toHaveBeenCalled(); // Profile update notification
    });

    it('should create approval request for domains requiring approval', async () => {
      const externalUserInfo = {
        ...mockUserInfo,
        email: 'test.user@external.com', // Domain requiring approval
      };

      // Mock temporary user creation
      const mockTempUser = {
        id: 'temp-user-123',
        email: 'test.user@external.com',
        name: 'Test User',
        isActive: false,
        requiresApproval: true,
      };

      mockUserService.create.mockResolvedValue(mockTempUser);

      const result = await provisioningService.processUserLogin('azure-ad', externalUserInfo, mockTokens);

      expect(result.isNewUser).toBe(true);
      expect(result.provisioningRequired).toBe(true);
      expect(result.provisioningRequest).toBeDefined();
      expect(result.provisioningRequest.status).toBe('pending');
      expect(result.user.isActive).toBe(false);
      expect(result.user.requiresApproval).toBe(true);
      expect(mockNotificationService.sendAdminNotification).toHaveBeenCalledWith({
        type: 'approval_required',
        data: expect.objectContaining({
          email: 'test.user@external.com',
        }),
      });
    });

    it('should block users from blocked domains', async () => {
      const blockedUserInfo = {
        ...mockUserInfo,
        email: 'test.user@blocked.com', // Blocked domain
      };

      await expect(
        provisioningService.processUserLogin('azure-ad', blockedUserInfo, mockTokens)
      ).rejects.toThrow();

      // Should not create any user or send notifications
      expect(mockUserService.create).not.toHaveBeenCalled();
      expect(mockNotificationService.sendWelcomeEmail).not.toHaveBeenCalled();
    });

    it('should handle users not in allowed domains', async () => {
      const otherDomainUserInfo = {
        ...mockUserInfo,
        email: 'test.user@other.com', // Not in allowed domains for Okta
      };

      await expect(
        provisioningService.processUserLogin('okta', otherDomainUserInfo, mockTokens)
      ).rejects.toThrow();

      expect(mockUserService.create).not.toHaveBeenCalled();
    });

    it('should handle provisioning errors gracefully', async () => {
      mockIdentityIntegration.processAuthentication.mockRejectedValue(new Error('Provisioning failed'));

      await expect(
        provisioningService.processUserLogin('azure-ad', mockUserInfo, mockTokens)
      ).rejects.toThrow('Provisioning failed');

      expect(mockAuditLogger.log).toHaveBeenCalledWith({
        event: 'provisioning_error',
        providerId: 'azure-ad',
        error: 'Provisioning failed',
        timestamp: expect.any(Date),
      });
    });

    it('should handle disabled provider', async () => {
      const disabledConfig = { ...mockConfig };
      disabledConfig['azure-ad'].enabled = false;

      const disabledService = new ProvisioningService(
        mockIdentityIntegration,
        mockDbService,
        mockUserService,
        mockAuditLogger,
        mockNotificationService,
        disabledConfig
      );

      await expect(
        disabledService.processUserLogin('azure-ad', mockUserInfo, mockTokens)
      ).rejects.toThrow('Provisioning not enabled for provider: azure-ad');
    });
  });

  describe('approveProvisioningRequest', () => {
    const mockRequest = {
      id: 'request-123',
      providerId: 'azure-ad',
      providerUserId: 'user-123',
      email: 'test.user@external.com',
      name: 'Test User',
      attributes: {},
      groups: [],
      roles: [],
      requestedAt: new Date(),
      requestedBy: 'provider',
      status: 'pending',
      metadata: {
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        },
      },
    };

    it('should approve provisioning request successfully', async () => {
      // Mock user and integration
      const mockUser = {
        id: 'user-123',
        email: 'test.user@external.com',
        name: 'Test User',
        isActive: false,
        requiresApproval: true,
      };

      mockUserService.findByEmail.mockResolvedValue(mockUser);
      mockUserService.update.mockResolvedValue({
        ...mockUser,
        isActive: true,
        requiresApproval: false,
      });

      mockIdentityIntegration.processAuthentication.mockResolvedValue({
        user: mockUser,
        isNewUser: false,
        syncResult: { success: true, action: 'updated' },
      });

      const result = await provisioningService.approveProvisioningRequest(
        'request-123',
        'admin-user',
        ['admin'],
        ['premium-users']
      );

      expect(result.success).toBe(true);
      expect(result.user.isActive).toBe(true);
      expect(result.user.requiresApproval).toBe(false);
      expect(mockNotificationService.sendEmail).toHaveBeenCalledWith({
        to: 'test.user@external.com',
        template: 'approval_complete',
        data: expect.any(Object),
      });
    });

    it('should handle non-existent request', async () => {
      await expect(
        provisioningService.approveProvisioningRequest('non-existent', 'admin-user')
      ).rejects.toThrow('Provisioning request not found');
    });

    it('should handle already processed request', async () => {
      const processedRequest = { ...mockRequest, status: 'approved' };

      await expect(
        provisioningService.approveProvisioningRequest('request-123', 'admin-user')
      ).rejects.toThrow('Cannot approve request with status: approved');
    });

    it('should handle approval failures', async () => {
      mockUserService.findByEmail.mockResolvedValue(null);

      await expect(
        provisioningService.approveProvisioningRequest('request-123', 'admin-user')
      ).rejects.toThrow('User not found for provisioning request');
    });
  });

  describe('rejectProvisioningRequest', () => {
    const mockRequest = {
      id: 'request-123',
      providerId: 'azure-ad',
      providerUserId: 'user-123',
      email: 'test.user@external.com',
      name: 'Test User',
      requestedAt: new Date(),
      requestedBy: 'provider',
      status: 'pending',
    };

    it('should reject provisioning request successfully', async () => {
      // Mock temporary user
      const mockTempUser = {
        id: 'temp-user-123',
        email: 'test.user@external.com',
        name: 'Test User',
        isActive: false,
        requiresApproval: true,
      };

      mockUserService.findByEmail.mockResolvedValue(mockTempUser);

      const result = await provisioningService.rejectProvisioningRequest(
        'request-123',
        'admin-user',
        'Security policy violation'
      );

      expect(result.status).toBe('rejected');
      expect(result.rejectionReason).toBe('Security policy violation');
      expect(result.processedBy).toBe('admin-user');
      expect(mockUserService.update).toHaveBeenCalledWith('temp-user-123', { isActive: false });
      expect(mockNotificationService.sendEmail).toHaveBeenCalledWith({
        to: 'test.user@external.com',
        template: 'access_denied',
        data: expect.objectContaining({
          reason: 'Security policy violation',
        }),
      });
      expect(mockAuditLogger.log).toHaveBeenCalledWith({
        event: 'provisioning_request_rejected',
        providerId: 'azure-ad',
        requestId: 'request-123',
        rejectedBy: 'admin-user',
        reason: 'Security policy violation',
        timestamp: expect.any(Date),
      });
    });
  });

  describe('deprovisionUser', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test.user@company.com',
      name: 'Test User',
      isActive: true,
    };

    it('should deprovision user successfully', async () => {
      mockUserService.findById.mockResolvedValue(mockUser);
      // Mock identity mappings
      jest.spyOn(provisioningService as any, 'getUserIdentityMappings').mockResolvedValue([
        {
          providerId: 'azure-ad',
          providerUserId: 'user-123',
        },
      ]);

      await provisioningService.deprovisionUser('user-123', 'admin_action', 'admin-456');

      expect(mockUserService.update).toHaveBeenCalledWith('user-123', {
        isActive: false,
        deactivatedAt: expect.any(Date),
        deactivatedBy: 'admin-456',
        deactivationReason: 'admin_action',
      });
      expect(mockNotificationService.sendAdminNotification).toHaveBeenCalledWith({
        type: 'user_deactivated',
        data: expect.objectContaining({
          userName: 'Test User',
          reason: 'admin_action',
        }),
      });
    });

    it('should handle non-existent user', async () => {
      mockUserService.findById.mockResolvedValue(null);

      await expect(
        provisioningService.deprovisionUser('non-existent', 'admin_action', 'admin-456')
      ).rejects.toThrow('User not found');
    });
  });

  describe('syncUserFromProvider', () => {
    it('should sync user from provider successfully', async () => {
      const mockMapping = {
        userId: 'user-123',
        providerId: 'azure-ad',
        providerUserId: 'user-123',
      };

      jest.spyOn(provisioningService as any, 'findIdentityMapping').mockResolvedValue(mockMapping);
      jest.spyOn(provisioningService as any, 'getValidTokens').mockResolvedValue({
        accessToken: 'access-token',
      });

      const mockProvider = {
        getUserInfo: jest.fn().mockResolvedValue({
          id: 'user-123',
          email: 'test.user@company.com',
          name: 'Test User Updated',
        }),
      };

      mockIdentityIntegration['providerManager'] = {
        getProvider: jest.fn().mockReturnValue(mockProvider),
      };

      const mockSyncResult = {
        user: { id: 'user-123', name: 'Test User Updated' },
        syncResult: {
          success: true,
          action: 'updated',
          changes: ['Updated profile information'],
        },
      };

      mockIdentityIntegration.processAuthentication.mockResolvedValue(mockSyncResult);

      const result = await provisioningService.syncUserFromProvider('azure-ad', 'user-123', 'admin-456');

      expect(result.success).toBe(true);
      expect(result.action).toBe('updated');
      expect(mockProvider.getUserInfo).toHaveBeenCalledWith('access-token');
      expect(mockIdentityIntegration.processAuthentication).toHaveBeenCalled();
    });

    it('should handle sync failure gracefully', async () => {
      jest.spyOn(provisioningService as any, 'findIdentityMapping').mockResolvedValue(null);

      await expect(
        provisioningService.syncUserFromProvider('azure-ad', 'user-123')
      ).rejects.toThrow('Identity mapping not found');

      expect(mockAuditLogger.log).toHaveBeenCalledWith({
        event: 'user_sync_error',
        providerId: 'azure-ad',
        providerUserId: 'user-123',
        error: 'Identity mapping not found',
        timestamp: expect.any(Date),
      });
    });
  });

  describe('configuration management', () => {
    it('should update provider configuration', () => {
      const newConfig = {
        autoApprove: false,
        welcomeEmail: false,
      };

      provisioningService.updateConfig('azure-ad', newConfig);

      expect(provisioningService['config']['azure-ad'].autoApprove).toBe(false);
      expect(provisioningService['config']['azure-ad'].welcomeEmail).toBe(false);
    });

    it('should get provisioning statistics', async () => {
      const stats = await provisioningService.getProvisioningStats('azure-ad');

      expect(stats).toEqual({
        totalUsers: expect.any(Number),
        activeUsers: expect.any(Number),
        pendingRequests: expect.any(Number),
        recentProvisioning: expect.any(Number),
        recentDeprovisioning: expect.any(Number),
      });
    });
  });

  describe('approval workflow validation', () => {
    it('should correctly identify domains requiring approval', () => {
      const testCases = [
        { email: 'user@company.com', provider: 'azure-ad', expected: false },
        { email: 'user@external.com', provider: 'azure-ad', expected: true },
        { email: 'user@blocked.com', provider: 'azure-ad', expected: true },
        { email: 'user@company.com', provider: 'okta', expected: false },
        { email: 'user@other.com', provider: 'okta', expected: true },
        { email: 'invalid-email', provider: 'azure-ad', expected: true },
      ];

      testCases.forEach(({ email, provider, expected }) => {
        const config = provisioningService['config'][provider];
        const requiresApproval = provisioningService['requiresApproval'](email, config);
        expect(requiresApproval).toBe(expected);
      });
    });
  });

  describe('background synchronization', () => {
    it('should initialize background sync timer', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      new ProvisioningService(
        mockIdentityIntegration,
        mockDbService,
        mockUserService,
        mockAuditLogger,
        mockNotificationService,
        mockConfig
      );

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        6 * 60 * 60 * 1000 // 6 hours
      );

      setIntervalSpy.mockRestore();
    });

    it('should cleanup background sync timer', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      provisioningService.cleanup();

      clearIntervalSpy.mockRestore();
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle notification failures gracefully', async () => {
      mockNotificationService.sendWelcomeEmail.mockRejectedValue(new Error('Email service down'));
      mockNotificationService.sendAdminNotification.mockRejectedValue(new Error('Notification service down'));

      const mockUser = {
        id: 'user-123',
        email: 'test.user@company.com',
        name: 'Test User',
        isActive: true,
      };

      mockIdentityIntegration.processAuthentication.mockResolvedValue({
        user: mockUser,
        isNewUser: true,
        syncResult: { success: true, action: 'created' },
      });

      // Should not throw despite notification failures
      const result = await provisioningService.processUserLogin('azure-ad', {
        id: 'user-123',
        email: 'test.user@company.com',
        name: 'Test User',
      }, { accessToken: 'token' });

      expect(result.user).toEqual(mockUser);
      expect(result.isNewUser).toBe(true);
    });

    it('should handle database failures during request creation', async () => {
      // This would require mocking the database operations to fail
      // The service should clean up any partial state
      // Implementation would depend on your specific database layer
    });
  });

  describe('security validation', () => {
    it('should validate email format before processing', () => {
      const invalidEmails = [
        'invalid-email',
        '@no-domain.com',
        'user@',
        'user space@domain.com',
      ];

      invalidEmails.forEach(email => {
        const config = provisioningService['config']['azure-ad'];
        const requiresApproval = provisioningService['requiresApproval'](email, config);
        expect(requiresApproval).toBe(true); // Invalid emails should require approval
      });
    });

    it('should handle case-insensitive domain matching', () => {
      const testCases = [
        { email: 'USER@COMPANY.COM', provider: 'okta', expected: false },
        { email: 'user@EXTERNAL.COM', provider: 'azure-ad', expected: true },
        { email: 'user@BLOCKED.COM', provider: 'azure-ad', expected: true },
      ];

      testCases.forEach(({ email, provider, expected }) => {
        const config = provisioningService['config'][provider];
        const requiresApproval = provisioningService['requiresApproval'](email, config);
        expect(requiresApproval).toBe(expected);
      });
    });
  });
});
