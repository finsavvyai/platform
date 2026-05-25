import { SSOProviderManager, SSOUserInfo, SSOProviderType } from './provider-manager';
import { SSOProviderConfig } from './provider-manager';
import { DatabaseService } from '../database-service';
import { UserService } from '../user-service';
import { AuditLogger } from '../audit-logger';

export interface IdentityMapping {
  userId: string;
  providerId: string;
  providerUserId: string;
  providerUsername: string;
  providerEmail: string;
  attributes: Record<string, any>;
  lastSyncAt: Date;
  createdAt: Date;
  isActive: boolean;
}

export interface GroupMapping {
  groupId: string;
  providerId: string;
  providerGroupId: string;
  providerGroupName: string;
  attributes: Record<string, any>;
  lastSyncAt: Date;
  createdAt: Date;
  isActive: boolean;
}

export interface RoleMapping {
  userId: string;
  roleId: string;
  providerId: string;
  providerRoleId: string;
  providerRoleName: string;
  assignedAt: Date;
  expiresAt?: Date;
  assignedBy: string; // provider or admin
  isActive: boolean;
}

export interface SyncResult {
  success: boolean;
  userId?: string;
  providerId: string;
  providerUserId: string;
  action: 'created' | 'updated' | 'deactivated' | 'error';
  changes: string[];
  errors?: string[];
  metadata?: Record<string, any>;
}

export interface GroupSyncResult {
  success: boolean;
  groupId?: string;
  providerId: string;
  providerGroupId: string;
  action: 'created' | 'updated' | 'deactivated' | 'error';
  changes: string[];
  errors?: string[];
  metadata?: Record<string, any>;
}

export interface UserProvisioningConfig {
  autoProvision: boolean;
  defaultRoles: string[];
  requireApproval: boolean;
  allowedDomains: string[];
  blockedDomains: string[];
  syncInterval: number; // minutes
  attributeMapping: Record<string, string>;
  groupMapping: Record<string, string>;
  roleMapping: Record<string, string>;
}

export interface IdentityIntegrationConfig {
  providers: Record<string, UserProvisioningConfig>;
  globalSettings: {
    syncInterval: number;
    enableRealTimeSync: boolean;
    enableAuditLogging: boolean;
    requireEmailVerification: boolean;
    enableJustInTimeProvisioning: boolean;
  };
}

/**
 * Identity Provider Integration Service
 * Handles user provisioning, attribute mapping, group synchronization, and role assignment
 */
export class IdentityIntegrationService {
  private providerManager: SSOProviderManager;
  private dbService: DatabaseService;
  private userService: UserService;
  private auditLogger: AuditLogger;
  private config: IdentityIntegrationConfig;
  private syncTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    providerManager: SSOProviderManager,
    dbService: DatabaseService,
    userService: UserService,
    auditLogger: AuditLogger,
    config: IdentityIntegrationConfig
  ) {
    this.providerManager = providerManager;
    this.dbService = dbService;
    this.userService = userService;
    this.auditLogger = auditLogger;
    this.config = config;

    this.initializeScheduledSync();
  }

  /**
   * Process user authentication and handle provisioning
   */
  async processAuthentication(
    providerId: string,
    userInfo: SSOUserInfo,
    tokens: any
  ): Promise<{ user: any; isNewUser: boolean; syncResult: SyncResult }> {
    try {
      // Check if user already exists
      const existingMapping = await this.findIdentityMapping(
        providerId,
        userInfo.id,
        userInfo.email
      );

      let user: any;
      let isNewUser = false;
      let syncResult: SyncResult;

      if (existingMapping) {
        // Update existing user
        user = await this.userService.findById(existingMapping.userId);
        syncResult = await this.updateUserFromProvider(providerId, user, userInfo);
      } else {
        // Provision new user
        const provisioningResult = await this.provisionUser(providerId, userInfo, tokens);
        user = provisioningResult.user;
        syncResult = provisioningResult.syncResult;
        isNewUser = true;
      }

      // Sync groups and roles
      await this.syncUserGroupsAndRoles(providerId, user.id, userInfo);

      return { user, isNewUser, syncResult };
    } catch (error) {
      await this.auditLogger.log({
        event: 'identity_integration_error',
        providerId,
        error: error.message,
        timestamp: new Date(),
      });

      throw new Error(`Identity integration failed: ${error.message}`);
    }
  }

  /**
   * Provision a new user from identity provider
   */
  private async provisionUser(
    providerId: string,
    userInfo: SSOUserInfo,
    tokens: any
  ): Promise<{ user: any; syncResult: SyncResult }> {
    const providerConfig = this.config.providers[providerId];

    // Validate email domain
    if (!this.isEmailDomainAllowed(userInfo.email, providerConfig)) {
      throw new Error(`Email domain not allowed: ${userInfo.email}`);
    }

    // Check if approval is required
    if (providerConfig.requireApproval) {
      return this.createPendingUser(providerId, userInfo);
    }

    // Create user record
    const userData = this.mapAttributesToUserSchema(userInfo, providerConfig.attributeMapping);

    const user = await this.userService.create({
      ...userData,
      emailVerified: userInfo.emailVerified || false,
      source: 'sso',
      sourceProvider: providerId,
      isActive: true,
      lastLoginAt: new Date(),
    });

    // Create identity mapping
    await this.createIdentityMapping({
      userId: user.id,
      providerId,
      providerUserId: userInfo.id,
      providerUsername: userInfo.email,
      providerEmail: userInfo.email,
      attributes: userInfo.attributes || {},
      lastSyncAt: new Date(),
      createdAt: new Date(),
      isActive: true,
    });

    // Assign default roles
    if (providerConfig.defaultRoles.length > 0) {
      await this.userService.assignRoles(user.id, providerConfig.defaultRoles);
    }

    const syncResult: SyncResult = {
      success: true,
      userId: user.id,
      providerId,
      providerUserId: userInfo.id,
      action: 'created',
      changes: ['User provisioned from identity provider'],
      metadata: {
        email: userInfo.email,
        name: userInfo.name,
        rolesAssigned: providerConfig.defaultRoles,
      },
    };

    await this.auditLogger.log({
      event: 'user_provisioned',
      providerId,
      userId: user.id,
      providerUserId: userInfo.id,
      action: 'created',
      timestamp: new Date(),
    });

    return { user, syncResult };
  }

  /**
   * Update existing user from identity provider
   */
  private async updateUserFromProvider(
    providerId: string,
    user: any,
    userInfo: SSOUserInfo
  ): Promise<SyncResult> {
    const providerConfig = this.config.providers[providerId];
    const changes: string[] = [];

    // Compare and update user attributes
    const updatedData = this.mapAttributesToUserSchema(userInfo, providerConfig.attributeMapping);

    for (const [key, value] of Object.entries(updatedData)) {
      if (user[key] !== value) {
        user[key] = value;
        changes.push(`Updated ${key}`);
      }
    }

    // Update last login
    if (!user.lastLoginAt || this.isLoginStale(user.lastLoginAt)) {
      user.lastLoginAt = new Date();
      changes.push('Updated last login');
    }

    if (changes.length > 0) {
      await this.userService.update(user.id, user);
    }

    // Update identity mapping
    await this.updateIdentityMapping(providerId, user.id, userInfo);

    const syncResult: SyncResult = {
      success: true,
      userId: user.id,
      providerId,
      providerUserId: userInfo.id,
      action: 'updated',
      changes,
      metadata: {
        email: userInfo.email,
        name: userInfo.name,
        totalChanges: changes.length,
      },
    };

    await this.auditLogger.log({
      event: 'user_updated',
      providerId,
      userId: user.id,
      providerUserId: userInfo.id,
      action: 'updated',
      changes,
      timestamp: new Date(),
    });

    return syncResult;
  }

  /**
   * Sync user groups and roles from identity provider
   */
  private async syncUserGroupsAndRoles(
    providerId: string,
    userId: string,
    userInfo: SSOUserInfo
  ): Promise<void> {
    const providerConfig = this.config.providers[providerId];

    if (userInfo.groups && userInfo.groups.length > 0) {
      // Sync group memberships
      for (const providerGroup of userInfo.groups) {
        await this.syncGroupMembership(providerId, userId, providerGroup, providerConfig);
      }
    }

    if (userInfo.roles && userInfo.roles.length > 0) {
      // Sync role assignments
      for (const providerRole of userInfo.roles) {
        await this.syncRoleAssignment(providerId, userId, providerRole, providerConfig);
      }
    }
  }

  /**
   * Sync group membership from identity provider
   */
  private async syncGroupMembership(
    providerId: string,
    userId: string,
    providerGroup: string,
    providerConfig: UserProvisioningConfig
  ): Promise<GroupSyncResult> {
    try {
      // Map provider group to internal group
      const internalGroupName = providerConfig.groupMapping[providerGroup] || providerGroup;

      // Find or create internal group
      let group = await this.findGroupByName(internalGroupName);
      if (!group) {
        group = await this.createGroup({
          name: internalGroupName,
          displayName: internalGroupName,
          description: `Auto-created from provider ${providerId}`,
          isActive: true,
        });
      }

      // Create group mapping if not exists
      const groupMapping = await this.findGroupMapping(providerId, providerGroup);
      if (!groupMapping) {
        await this.createGroupMapping({
          groupId: group.id,
          providerId,
          providerGroupId: providerGroup,
          providerGroupName: providerGroup,
          attributes: {},
          lastSyncAt: new Date(),
          createdAt: new Date(),
          isActive: true,
        });
      }

      // Add user to group
      await this.userService.addToGroup(userId, group.id);

      const syncResult: GroupSyncResult = {
        success: true,
        groupId: group.id,
        providerId,
        providerGroupId: providerGroup,
        action: groupMapping ? 'updated' : 'created',
        changes: [`${groupMapping ? 'Updated' : 'Created'} group membership`],
        metadata: {
          groupName: internalGroupName,
          userId,
        },
      };

      return syncResult;
    } catch (error) {
      return {
        success: false,
        providerId,
        providerGroupId: providerGroup,
        action: 'error',
        changes: [],
        errors: [error.message],
      };
    }
  }

  /**
   * Sync role assignment from identity provider
   */
  private async syncRoleAssignment(
    providerId: string,
    userId: string,
    providerRole: string,
    providerConfig: UserProvisioningConfig
  ): Promise<void> {
    // Map provider role to internal role
    const internalRoleName = providerConfig.roleMapping[providerRole] || providerRole;

    // Find internal role
    const role = await this.findRoleByName(internalRoleName);
    if (!role) {
      console.warn(`Role not found: ${internalRoleName}`);
      return;
    }

    // Create role assignment
    await this.createRoleMapping({
      userId,
      roleId: role.id,
      providerId,
      providerRoleId: providerRole,
      providerRoleName: providerRole,
      assignedAt: new Date(),
      assignedBy: 'provider',
      isActive: true,
    });

    // Assign role to user
    await this.userService.assignRole(userId, role.id);
  }

  /**
   * Deactivate user when removed from identity provider
   */
  async deactivateUser(providerId: string, providerUserId: string): Promise<SyncResult> {
    const mapping = await this.findIdentityMappingByProviderUser(providerId, providerUserId);
    if (!mapping) {
      throw new Error('Identity mapping not found');
    }

    const user = await this.userService.findById(mapping.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Deactivate user
    await this.userService.update(user.id, { isActive: false });

    // Deactivate identity mapping
    await this.deactivateIdentityMapping(mapping.id);

    const syncResult: SyncResult = {
      success: true,
      userId: user.id,
      providerId,
      providerUserId,
      action: 'deactivated',
      changes: ['User deactivated'],
      metadata: {
        email: user.email,
        deactivatedAt: new Date(),
      },
    };

    await this.auditLogger.log({
      event: 'user_deactivated',
      providerId,
      userId: user.id,
      providerUserId,
      action: 'deactivated',
      timestamp: new Date(),
    });

    return syncResult;
  }

  /**
   * Scheduled synchronization for all providers
   */
  private initializeScheduledSync(): void {
    const { syncInterval, enableRealTimeSync } = this.config.globalSettings;

    if (enableRealTimeSync && syncInterval > 0) {
      // Schedule sync for each provider
      Object.keys(this.config.providers).forEach(providerId => {
        const providerSyncInterval = this.config.providers[providerId].syncInterval || syncInterval;

        const timer = setInterval(async () => {
          try {
            await this.performScheduledSync(providerId);
          } catch (error) {
            console.error(`Scheduled sync failed for provider ${providerId}:`, error);
          }
        }, providerSyncInterval * 60 * 1000); // Convert minutes to milliseconds

        this.syncTimers.set(providerId, timer);
      });
    }
  }

  /**
   * Perform scheduled synchronization for a provider
   */
  private async performScheduledSync(providerId: string): Promise<void> {
    // Get all active identity mappings for this provider
    const mappings = await this.getActiveIdentityMappings(providerId);

    for (const mapping of mappings) {
      try {
        // Get current user info from provider
        const provider = this.providerManager.getProvider(providerId);
        const tokens = await this.getValidTokens(mapping.userId, providerId);

        if (tokens) {
          const userInfo = await provider.getUserInfo(tokens.accessToken);
          await this.updateUserFromProvider(providerId, mapping.userId, userInfo);
          await this.syncUserGroupsAndRoles(providerId, mapping.userId, userInfo);
        }
      } catch (error) {
        console.error(`Sync failed for user ${mapping.userId}:`, error);
      }
    }
  }

  /**
   * Map SSO user attributes to internal user schema
   */
  private mapAttributesToUserSchema(
    userInfo: SSOUserInfo,
    attributeMapping: Record<string, string>
  ): any {
    const mapped = {
      email: userInfo.email,
      firstName: userInfo.firstName || '',
      lastName: userInfo.lastName || '',
      name: userInfo.name || '',
      avatar: userInfo.avatar || '',
    };

    // Apply custom attribute mapping
    if (attributeMapping) {
      for (const [samlAttribute, userField] of Object.entries(attributeMapping)) {
        const value = this.getNestedValue(userInfo, samlAttribute);
        if (value !== undefined) {
          mapped[userField] = value;
        }
      }
    }

    return mapped;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Validate email domain against provider configuration
   */
  private isEmailDomainAllowed(email: string, config: UserProvisioningConfig): boolean {
    const domain = email.split('@')[1]?.toLowerCase();

    if (!domain) {
      return false;
    }

    // Check blocked domains first
    if (config.blockedDomains && config.blockedDomains.includes(domain)) {
      return false;
    }

    // If allowed domains are specified, check them
    if (config.allowedDomains && config.allowedDomains.length > 0) {
      return config.allowedDomains.includes(domain);
    }

    // If no specific domain restrictions, allow all
    return true;
  }

  /**
   * Check if login timestamp is stale (more than 24 hours)
   */
  private isLoginStale(lastLogin: Date): boolean {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return new Date(lastLogin) < twentyFourHoursAgo;
  }

  // Database helper methods (these would be implemented using your database service)
  private async findIdentityMapping(providerId: string, providerUserId: string, email: string): Promise<IdentityMapping | null> {
    // Implementation would query the identity_mappings table
    return null; // Placeholder
  }

  private async createIdentityMapping(mapping: Partial<IdentityMapping>): Promise<IdentityMapping> {
    // Implementation would insert into identity_mappings table
    return mapping as IdentityMapping; // Placeholder
  }

  private async updateIdentityMapping(providerId: string, userId: string, userInfo: SSOUserInfo): Promise<void> {
    // Implementation would update the identity_mappings table
  }

  private async deactivateIdentityMapping(mappingId: string): Promise<void> {
    // Implementation would update isActive = false
  }

  private async findIdentityMappingByProviderUser(providerId: string, providerUserId: string): Promise<IdentityMapping | null> {
    // Implementation to find mapping by provider user ID
    return null; // Placeholder
  }

  private async getActiveIdentityMappings(providerId: string): Promise<IdentityMapping[]> {
    // Implementation to get all active mappings for a provider
    return []; // Placeholder
  }

  private async findGroupByName(name: string): Promise<any> {
    // Implementation to find group by name
    return null; // Placeholder
  }

  private async createGroup(groupData: any): Promise<any> {
    // Implementation to create group
    return groupData; // Placeholder
  }

  private async findGroupMapping(providerId: string, providerGroupId: string): Promise<GroupMapping | null> {
    // Implementation to find group mapping
    return null; // Placeholder
  }

  private async createGroupMapping(mapping: Partial<GroupMapping>): Promise<GroupMapping> {
    // Implementation to create group mapping
    return mapping as GroupMapping; // Placeholder
  }

  private async findRoleByName(name: string): Promise<any> {
    // Implementation to find role by name
    return null; // Placeholder
  }

  private async createRoleMapping(mapping: Partial<RoleMapping>): Promise<RoleMapping> {
    // Implementation to create role mapping
    return mapping as RoleMapping; // Placeholder
  }

  private async createPendingUser(providerId: string, userInfo: SSOUserInfo): Promise<{ user: any; syncResult: SyncResult }> {
    // Implementation to create user that requires approval
    throw new Error('Approval flow not implemented');
  }

  private async getValidTokens(userId: string, providerId: string): Promise<any> {
    // Implementation to retrieve valid tokens for user
    return null; // Placeholder
  }

  /**
   * Cleanup scheduled sync timers
   */
  public cleanup(): void {
    for (const timer of this.syncTimers.values()) {
      clearInterval(timer);
    }
    this.syncTimers.clear();
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<IdentityIntegrationConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Restart scheduled sync with new configuration
    this.cleanup();
    this.initializeScheduledSync();
  }

  /**
   * Get sync status for all providers
   */
  public async getSyncStatus(): Promise<Record<string, any>> {
    const status: Record<string, any> = {};

    for (const providerId of Object.keys(this.config.providers)) {
      const mappings = await this.getActiveIdentityMappings(providerId);
      status[providerId] = {
        totalMappings: mappings.length,
        lastSyncAt: mappings.length > 0
          ? Math.max(...mappings.map(m => new Date(m.lastSyncAt).getTime()))
          : null,
        isActive: this.syncTimers.has(providerId),
      };
    }

    return status;
  }
}
