import { SSOProviderManager, SSOUserInfo } from './provider-manager';
import { IdentityIntegrationService, SyncResult } from './identity-integration';
import { DatabaseService } from '../database-service';
import { UserService } from '../user-service';
import { AuditLogger } from '../audit-logger';
import { NotificationService } from '../notification-service';

export interface ProvisioningRequest {
  id: string;
  providerId: string;
  providerUserId: string;
  email: string;
  name: string;
  attributes: Record<string, any>;
  groups: string[];
  roles: string[];
  requestedAt: Date;
  requestedBy: string; // 'provider' or userId
  status: 'pending' | 'approved' | 'rejected' | 'processed' | 'failed';
  processedAt?: Date;
  processedBy?: string;
  userId?: string;
  rejectionReason?: string;
  metadata: Record<string, any>;
}

export interface DeprovisioningRequest {
  id: string;
  providerId: string;
  providerUserId: string;
  userId: string;
  reason: 'user_removed' | 'user_disabled' | 'access_revoked' | 'admin_action';
  deactivationDate: Date;
  status: 'pending' | 'processed' | 'failed';
  processedAt?: Date;
  processedBy?: string;
  metadata: Record<string, any>;
}

export interface ProvisioningConfig {
  enabled: boolean;
  autoApprove: boolean;
  requireApprovalForDomains: string[];
  blocklistedDomains: string[];
  allowedDomains: string[];
  defaultRoles: string[];
  defaultGroups: string[];
  welcomeEmail: boolean;
  notificationSettings: {
    newUser: boolean;
    profileUpdate: boolean;
    deactivation: boolean;
    approvalRequired: boolean;
  };
  retentionPolicy: {
    keepInactiveUsers: boolean;
    inactiveDays: number;
    archiveUsers: boolean;
  };
}

export interface ProvisioningEvent {
  id: string;
  userId: string;
  providerId: string;
  eventType: 'user_created' | 'user_updated' | 'user_deactivated' | 'user_reactivated' | 'group_synced' | 'role_assigned';
  eventData: Record<string, any>;
  timestamp: Date;
  source: 'provider' | 'admin' | 'system';
  processed: boolean;
}

/**
 * User Provisioning and Deprovisioning Service
 * Handles complete user lifecycle management with automated provisioning,
 * deprovisioning, and comprehensive audit logging
 */
export class ProvisioningService {
  private identityIntegration: IdentityIntegrationService;
  private dbService: DatabaseService;
  private userService: UserService;
  private auditLogger: AuditLogger;
  private notificationService: NotificationService;
  private config: Record<string, ProvisioningConfig>;
  private syncInterval: NodeJS.Timeout;

  constructor(
    identityIntegration: IdentityIntegrationService,
    dbService: DatabaseService,
    userService: UserService,
    auditLogger: AuditLogger,
    notificationService: NotificationService,
    config: Record<string, ProvisioningConfig>
  ) {
    this.identityIntegration = identityIntegration;
    this.dbService = dbService;
    this.userService = userService;
    this.auditLogger = auditLogger;
    this.notificationService = notificationService;
    this.config = config;

    this.initializeBackgroundSync();
  }

  /**
   * Process user login and handle provisioning
   */
  async processUserLogin(
    providerId: string,
    userInfo: SSOUserInfo,
    tokens: any
  ): Promise<{
    user: any;
    isNewUser: boolean;
    provisioningRequired: boolean;
    provisioningRequest?: ProvisioningRequest;
    syncResult: SyncResult;
  }> {
    const providerConfig = this.config[providerId];

    if (!providerConfig?.enabled) {
      throw new Error(`Provisioning not enabled for provider: ${providerId}`);
    }

    try {
      // Check if approval is required
      const requiresApproval = this.requiresApproval(userInfo.email, providerConfig);

      if (requiresApproval) {
        return this.handleApprovalRequired(providerId, userInfo, tokens);
      }

      // Process user directly if auto-approved
      const result = await this.identityIntegration.processAuthentication(providerId, userInfo, tokens);

      // Log provisioning event
      await this.logProvisioningEvent({
        id: this.generateId(),
        userId: result.user.id,
        providerId,
        eventType: result.isNewUser ? 'user_created' : 'user_updated',
        eventData: {
          email: userInfo.email,
          name: userInfo.name,
          groups: userInfo.groups,
          roles: userInfo.roles,
          isNewUser: result.isNewUser,
        },
        timestamp: new Date(),
        source: 'provider',
        processed: true,
      });

      // Send welcome email if new user
      if (result.isNewUser && providerConfig.welcomeEmail) {
        await this.sendWelcomeEmail(result.user, providerId);
      }

      // Send notifications
      await this.sendProvisioningNotifications(result.user, providerId, result.isNewUser);

      return {
        ...result,
        provisioningRequired: false,
      };
    } catch (error) {
      await this.auditLogger.log({
        event: 'provisioning_error',
        providerId,
        error: error.message,
        timestamp: new Date(),
      });

      throw error;
    }
  }

  /**
   * Handle approval required scenario
   */
  private async handleApprovalRequired(
    providerId: string,
    userInfo: SSOUserInfo,
    tokens: any
  ): Promise<{
    user: any;
    isNewUser: boolean;
    provisioningRequired: boolean;
    provisioningRequest: ProvisioningRequest;
    syncResult: SyncResult;
  }> {
    // Create provisioning request
    const provisioningRequest = await this.createProvisioningRequest({
      id: this.generateId(),
      providerId,
      providerUserId: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      attributes: userInfo.attributes || {},
      groups: userInfo.groups || [],
      roles: userInfo.roles || [],
      requestedAt: new Date(),
      requestedBy: 'provider',
      status: 'pending',
      metadata: {
        tokens, // Store tokens securely for later processing
        originalRequest: true,
      },
    });

    // Send approval notification
    await this.sendApprovalNotification(provisioningRequest, providerId);

    // Create temporary user record (if allowed)
    let tempUser = null;
    let syncResult: SyncResult;

    try {
      // Create user with limited access
      tempUser = await this.userService.create({
        email: userInfo.email,
        name: userInfo.name,
        firstName: userInfo.firstName || '',
        lastName: userInfo.lastName || '',
        isActive: false, // Inactive until approved
        source: 'sso',
        sourceProvider: providerId,
        requiresApproval: true,
        emailVerified: userInfo.emailVerified || false,
      });

      syncResult = {
        success: true,
        userId: tempUser.id,
        providerId,
        providerUserId: userInfo.id,
        action: 'created',
        changes: ['Temporary user created pending approval'],
        metadata: {
          email: userInfo.email,
          name: userInfo.name,
          pendingApproval: true,
        },
      };

      await this.auditLogger.log({
        event: 'provisioning_request_created',
        providerId,
        userId: tempUser.id,
        providerUserId: userInfo.id,
        requestId: provisioningRequest.id,
        timestamp: new Date(),
      });

      return {
        user: tempUser,
        isNewUser: true,
        provisioningRequired: true,
        provisioningRequest,
        syncResult,
      };
    } catch (error) {
      // Clean up provisioning request if user creation fails
      await this.cleanupProvisioningRequest(provisioningRequest.id);
      throw error;
    }
  }

  /**
   * Approve provisioning request
   */
  async approveProvisioningRequest(
    requestId: string,
    approvedBy: string,
    additionalRoles?: string[],
    additionalGroups?: string[]
  ): Promise<{
    success: boolean;
    user: any;
    provisioningRequest: ProvisioningRequest;
  }> {
    const request = await this.getProvisioningRequest(requestId);
    if (!request) {
      throw new Error('Provisioning request not found');
    }

    if (request.status !== 'pending') {
      throw new Error(`Cannot approve request with status: ${request.status}`);
    }

    try {
      // Update user to active
      let user = await this.userService.findByEmail(request.email);
      if (!user) {
        throw new Error('User not found for provisioning request');
      }

      user = await this.userService.update(user.id, {
        isActive: true,
        requiresApproval: false,
        approvedAt: new Date(),
        approvedBy,
      });

      // Process user provisioning with stored tokens
      const tokens = request.metadata.tokens;
      if (tokens) {
        const userInfo: SSOUserInfo = {
          id: request.providerUserId,
          email: request.email,
          name: request.name,
          attributes: request.attributes,
          groups: [...request.groups, ...(additionalGroups || [])],
          roles: [...request.roles, ...(additionalRoles || [])],
        };

        await this.identityIntegration.processAuthentication(request.providerId, userInfo, tokens);
      }

      // Update provisioning request
      const updatedRequest: ProvisioningRequest = {
        ...request,
        status: 'approved',
        processedAt: new Date(),
        processedBy: approvedBy,
        userId: user.id,
      };

      await this.updateProvisioningRequest(updatedRequest);

      // Log event
      await this.logProvisioningEvent({
        id: this.generateId(),
        userId: user.id,
        providerId: request.providerId,
        eventType: 'user_reactivated',
        eventData: {
          requestId: requestId,
          approvedBy: approvedBy,
          additionalRoles,
          additionalGroups,
        },
        timestamp: new Date(),
        source: 'admin',
        processed: true,
      });

      // Send approval notification
      await this.sendApprovalCompleteNotification(user, request.providerId);

      return {
        success: true,
        user,
        provisioningRequest: updatedRequest,
      };
    } catch (error) {
      // Update request to failed status
      await this.updateProvisioningRequest({
        ...request,
        status: 'failed',
        processedAt: new Date(),
        processedBy: approvedBy,
        rejectionReason: error.message,
      });

      throw error;
    }
  }

  /**
   * Reject provisioning request
   */
  async rejectProvisioningRequest(
    requestId: string,
    rejectedBy: string,
    reason: string
  ): Promise<ProvisioningRequest> {
    const request = await this.getProvisioningRequest(requestId);
    if (!request) {
      throw new Error('Provisioning request not found');
    }

    if (request.status !== 'pending') {
      throw new Error(`Cannot reject request with status: ${request.status}`);
    }

    // Update request
    const updatedRequest: ProvisioningRequest = {
      ...request,
      status: 'rejected',
      processedAt: new Date(),
      processedBy: rejectedBy,
      rejectionReason: reason,
    };

    await this.updateProvisioningRequest(updatedRequest);

    // Deactivate or delete temporary user
    const user = await this.userService.findByEmail(request.email);
    if (user && user.requiresApproval) {
      await this.userService.update(user.id, { isActive: false });
    }

    // Log event
    await this.auditLogger.log({
      event: 'provisioning_request_rejected',
      providerId: request.providerId,
      requestId: requestId,
      rejectedBy: rejectedBy,
      reason: reason,
      timestamp: new Date(),
    });

    // Send rejection notification
    await this.sendRejectionNotification(request, reason);

    return updatedRequest;
  }

  /**
   * Deprovision user (deactivate)
   */
  async deprovisionUser(
    userId: string,
    reason: 'user_removed' | 'user_disabled' | 'access_revoked' | 'admin_action',
    deactivatedBy: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const user = await this.userService.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Find identity mappings
      const mappings = await this.getUserIdentityMappings(userId);

      // Create deprovisioning request for each mapping
      for (const mapping of mappings) {
        await this.createDeprovisioningRequest({
          id: this.generateId(),
          providerId: mapping.providerId,
          providerUserId: mapping.providerUserId,
          userId: userId,
          reason,
          deactivationDate: new Date(),
          status: 'pending',
          metadata: {
            deactivatedBy,
            email: user.email,
            name: user.name,
            ...metadata,
          },
        });
      }

      // Deactivate user
      await this.userService.update(userId, {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedBy,
        deactivationReason: reason,
      });

      // Log event
      await this.logProvisioningEvent({
        id: this.generateId(),
        userId: userId,
        providerId: 'system',
        eventType: 'user_deactivated',
        eventData: {
          reason,
          deactivatedBy,
          mappingsCount: mappings.length,
        },
        timestamp: new Date(),
        source: 'admin',
        processed: true,
      });

      // Send deactivation notification
      await this.sendDeprovisioningNotification(user, reason);

      await this.auditLogger.log({
        event: 'user_deprovisioned',
        userId,
        reason,
        deactivatedBy,
        timestamp: new Date(),
      });
    } catch (error) {
      await this.auditLogger.log({
        event: 'deprovisioning_error',
        userId,
        error: error.message,
        timestamp: new Date(),
      });

      throw error;
    }
  }

  /**
   * Sync user from provider (manual or scheduled)
   */
  async syncUserFromProvider(
    providerId: string,
    providerUserId: string,
    syncBy: string = 'system'
  ): Promise<SyncResult> {
    try {
      // Find identity mapping
      const mapping = await this.findIdentityMapping(providerId, providerUserId);
      if (!mapping) {
        throw new Error('Identity mapping not found');
      }

      // Get valid tokens
      const tokens = await this.getValidTokens(mapping.userId, providerId);
      if (!tokens) {
        throw new Error('No valid tokens available for synchronization');
      }

      // Get provider
      const provider = this.identityIntegration['providerManager'].getProvider(providerId);

      // Get current user info
      const userInfo = await provider.getUserInfo(tokens.accessToken);

      // Update user
      const syncResult = await this.identityIntegration.processAuthentication(providerId, userInfo, tokens);

      // Log sync event
      await this.logProvisioningEvent({
        id: this.generateId(),
        userId: syncResult.user.id,
        providerId,
        eventType: 'user_updated',
        eventData: {
          syncBy,
          changes: syncResult.syncResult.changes,
          providerUserId,
        },
        timestamp: new Date(),
        source: syncBy === 'system' ? 'system' : 'admin',
        processed: true,
      });

      return syncResult.syncResult;
    } catch (error) {
      await this.auditLogger.log({
        event: 'user_sync_error',
        providerId,
        providerUserId,
        error: error.message,
        timestamp: new Date(),
      });

      throw error;
    }
  }

  /**
   * Background sync for all users
   */
  private async initializeBackgroundSync(): void {
    // Run every 6 hours
    this.syncInterval = setInterval(async () => {
      try {
        await this.performBackgroundSync();
      } catch (error) {
        console.error('Background sync failed:', error);
      }
    }, 6 * 60 * 60 * 1000);
  }

  /**
   * Perform background synchronization
   */
  private async performBackgroundSync(): Promise<void> {
    const providers = Object.keys(this.config).filter(p => this.config[p].enabled);

    for (const providerId of providers) {
      try {
        const mappings = await this.getActiveIdentityMappings(providerId);

        for (const mapping of mappings) {
          try {
            // Check if user needs sync (last sync > 24 hours)
            const lastSync = new Date(mapping.lastSyncAt);
            const now = new Date();
            const hoursSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60);

            if (hoursSinceSync >= 24) {
              await this.syncUserFromProvider(providerId, mapping.providerUserId);
            }
          } catch (error) {
            console.error(`Failed to sync user ${mapping.userId}:`, error);
          }
        }
      } catch (error) {
        console.error(`Failed to sync provider ${providerId}:`, error);
      }
    }
  }

  /**
   * Check if approval is required for user
   */
  private requiresApproval(email: string, config: ProvisioningConfig): boolean {
    if (config.autoApprove) {
      return false;
    }

    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) {
      return true; // Require approval for invalid email format
    }

    // Check if domain requires approval
    if (config.requireApprovalForDomains.includes(domain)) {
      return true;
    }

    // Check if domain is blocked
    if (config.blocklistedDomains.includes(domain)) {
      return true;
    }

    // Check if domain is in allowed list (if specified)
    if (config.allowedDomains.length > 0 && !config.allowedDomains.includes(domain)) {
      return true;
    }

    return false;
  }

  /**
   * Send welcome email to new user
   */
  private async sendWelcomeEmail(user: any, providerId: string): Promise<void> {
    try {
      await this.notificationService.sendEmail({
        to: user.email,
        template: 'welcome',
        data: {
          userName: user.name,
          providerName: providerId,
          loginUrl: `${process.env.FRONTEND_URL}/login`,
        },
      });
    } catch (error) {
      console.error('Failed to send welcome email:', error);
    }
  }

  /**
   * Send provisioning notifications
   */
  private async sendProvisioningNotifications(user: any, providerId: string, isNewUser: boolean): Promise<void> {
    const config = this.config[providerId];
    if (!config?.notificationSettings) return;

    try {
      if (isNewUser && config.notificationSettings.newUser) {
        // Notify admins about new user
        await this.notificationService.sendAdminNotification({
          type: 'new_user',
          data: {
            userName: user.name,
            email: user.email,
            provider: providerId,
            createdAt: user.createdAt,
          },
        });
      }

      if (!isNewUser && config.notificationSettings.profileUpdate) {
        // Notify user about profile update
        await this.notificationService.sendEmail({
          to: user.email,
          template: 'profile_updated',
          data: {
            userName: user.name,
            updatedAt: new Date(),
          },
        });
      }
    } catch (error) {
      console.error('Failed to send provisioning notifications:', error);
    }
  }

  /**
   * Send approval notification
   */
  private async sendApprovalNotification(request: ProvisioningRequest, providerId: string): Promise<void> {
    const config = this.config[providerId];
    if (!config?.notificationSettings?.approvalRequired) return;

    try {
      await this.notificationService.sendAdminNotification({
        type: 'approval_required',
        data: {
          requestId: request.id,
          userName: request.name,
          email: request.email,
          provider: providerId,
          requestedAt: request.requestedAt,
        },
      });
    } catch (error) {
      console.error('Failed to send approval notification:', error);
    }
  }

  /**
   * Send approval complete notification
   */
  private async sendApprovalCompleteNotification(user: any, providerId: string): Promise<void> {
    try {
      await this.notificationService.sendEmail({
        to: user.email,
        template: 'approval_complete',
        data: {
          userName: user.name,
          loginUrl: `${process.env.FRONTEND_URL}/login`,
        },
      });
    } catch (error) {
      console.error('Failed to send approval complete notification:', error);
    }
  }

  /**
   * Send rejection notification
   */
  private async sendRejectionNotification(request: ProvisioningRequest, reason: string): Promise<void> {
    try {
      await this.notificationService.sendEmail({
        to: request.email,
        template: 'access_denied',
        data: {
          userName: request.name,
          reason: reason,
        },
      });
    } catch (error) {
      console.error('Failed to send rejection notification:', error);
    }
  }

  /**
   * Send deprovisioning notification
   */
  private async sendDeprovisioningNotification(user: any, reason: string): Promise<void> {
    try {
      await this.notificationService.sendAdminNotification({
        type: 'user_deactivated',
        data: {
          userName: user.name,
          email: user.email,
          reason: reason,
          deactivatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Failed to send deprovisioning notification:', error);
    }
  }

  /**
   * Get provisioning requests
   */
  async getProvisioningRequests(filters?: {
    status?: string;
    providerId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<ProvisioningRequest[]> {
    // Implementation would query provisioning_requests table with filters
    return []; // Placeholder
  }

  /**
   * Get deprovisioning requests
   */
  async getDeprovisioningRequests(filters?: {
    status?: string;
    providerId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<DeprovisioningRequest[]> {
    // Implementation would query deprovisioning_requests table with filters
    return []; // Placeholder
  }

  /**
   * Get provisioning events
   */
  async getProvisioningEvents(filters?: {
    userId?: string;
    providerId?: string;
    eventType?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<ProvisioningEvent[]> {
    // Implementation would query provisioning_events table with filters
    return []; // Placeholder
  }

  /**
   * Utility methods (placeholders for database operations)
   */
  private generateId(): string {
    return crypto.randomUUID();
  }

  private async createProvisioningRequest(request: Partial<ProvisioningRequest>): Promise<ProvisioningRequest> {
    // Database implementation
    return request as ProvisioningRequest;
  }

  private async updateProvisioningRequest(request: ProvisioningRequest): Promise<void> {
    // Database implementation
  }

  private async getProvisioningRequest(requestId: string): Promise<ProvisioningRequest | null> {
    // Database implementation
    return null;
  }

  private async cleanupProvisioningRequest(requestId: string): Promise<void> {
    // Database implementation
  }

  private async createDeprovisioningRequest(request: Partial<DeprovisioningRequest>): Promise<DeprovisioningRequest> {
    // Database implementation
    return request as DeprovisioningRequest;
  }

  private async getUserIdentityMappings(userId: string): Promise<any[]> {
    // Database implementation
    return [];
  }

  private async findIdentityMapping(providerId: string, providerUserId: string): Promise<any> {
    // Database implementation
    return null;
  }

  private async getActiveIdentityMappings(providerId: string): Promise<any[]> {
    // Database implementation
    return [];
  }

  private async getValidTokens(userId: string, providerId: string): Promise<any> {
    // Database implementation
    return null;
  }

  private async logProvisioningEvent(event: ProvisioningEvent): Promise<void> {
    // Database implementation
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(providerId: string, config: Partial<ProvisioningConfig>): void {
    this.config[providerId] = { ...this.config[providerId], ...config };
  }

  /**
   * Get provisioning statistics
   */
  async getProvisioningStats(providerId?: string): Promise<{
    totalUsers: number;
    activeUsers: number;
    pendingRequests: number;
    recentProvisioning: number;
    recentDeprovisioning: number;
  }> {
    // Implementation would query database for statistics
    return {
      totalUsers: 0,
      activeUsers: 0,
      pendingRequests: 0,
      recentProvisioning: 0,
      recentDeprovisioning: 0,
    };
  }
}
