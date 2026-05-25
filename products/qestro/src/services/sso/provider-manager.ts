/**
 * SSO Provider Abstraction Layer
 *
 * Enterprise-grade SSO provider management system providing:
 * - Unified interface for multiple authentication protocols (SAML 2.0, OIDC, OAuth 2.0)
 * - Pluggable provider architecture with runtime configuration
 * - Automatic provider discovery and health monitoring
 * - Consistent user attribute mapping and role resolution
 * - Security best practices and compliance features
 * - Comprehensive audit logging and monitoring
 */

import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc, inArray } from 'drizzle-orm';
import * as schema from '../../db/schema';

// Base provider interfaces
export interface SSOProvider {
  id: string;
  name: string;
  type: ProviderType;
  protocol: AuthenticationProtocol;
  config: ProviderConfig;
  isActive: boolean;
  isDefault: boolean;
  capabilities: ProviderCapabilities;
  healthStatus: ProviderHealthStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type ProviderType = 'azure-ad' | 'okta' | 'auth0' | 'google-workspace' | 'keycloak' | 'saml-custom' | 'oidc-custom';
export type AuthenticationProtocol = 'saml2' | 'oidc' | 'oauth2' | 'ldap';

export interface ProviderCapabilities {
  authentication: boolean;
  provisioning: boolean;
  groupSync: boolean;
  roleMapping: boolean;
  singleLogout: boolean;
  mfa: boolean;
  userManagement: boolean;
  apiAccess: boolean;
}

export interface ProviderHealthStatus {
  isHealthy: boolean;
  lastCheck: Date;
  responseTime: number;
  errorCount: number;
  lastError?: string;
  uptime: number;
}

export interface ProviderConfig {
  // Connection settings
  clientId: string;
  clientSecret: string;
  domain: string;
  environment: 'development' | 'staging' | 'production';

  // Protocol-specific settings
  saml?: SAMLConfig;
  oidc?: OIDCConfig;
  oauth2?: OAuth2Config;
  ldap?: LDAPConfig;

  // Mapping and synchronization
  attributeMapping: AttributeMapping;
  groupMapping: GroupMapping;
  roleMapping: RoleMapping;

  // Security settings
  security: SecurityConfig;

  // Feature flags
  features: FeatureConfig;

  // Callback URLs
  callbacks: CallbackConfig;
}

export interface SAMLConfig {
  entryPoint: string;
  issuer: string;
  cert: string;
  privateKey?: string;
  signatureAlgorithm: 'RSA-SHA1' | 'RSA-SHA256' | 'RSA-SHA512';
  digestAlgorithm: 'SHA1' | 'SHA256' | 'SHA512';
  nameIdFormat: string;
  attributeConsumingServiceIndex?: number;
  allowUnencryptedAssertions: boolean;
  rejectDelegatedRequests: boolean;
  validateInResponseTo: boolean;
  requestIdExpirationTimeMs: number;
  clockSkewMs: number;
}

export interface OIDCConfig {
  wellKnownUrl?: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string;
  jwksUrl: string;
  endSessionEndpoint?: string;
  revocationEndpoint?: string;
  scopes: string[];
  responseType: 'code' | 'id_token' | 'code id_token';
  responseMode: 'query' | 'form_post';
  grantType: 'authorization_code' | 'implicit' | 'hybrid';
  pkce: boolean;
  nonce: boolean;
  maxAge?: number;
}

export interface OAuth2Config {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  scopes: string[];
  grantType: 'authorization_code' | 'client_credentials' | 'implicit';
  responseType: 'code';
  state: boolean;
}

export interface LDAPConfig {
  url: string;
  bindDN: string;
  bindPassword: string;
  userBaseDN: string;
  userSearchFilter: string;
  userAttributes: string[];
  groupBaseDN: string;
  groupSearchFilter: string;
  groupMemberAttribute: string;
  secureProtocol: boolean;
  port: number;
}

export interface AttributeMapping {
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  username?: string;
  phone?: string;
  avatar?: string;
  locale?: string;
  timezone?: string;
  department?: string;
  title?: string;
  manager?: string;
  employeeId?: string;
  custom: Record<string, string>;
}

export interface GroupMapping {
  enabled: boolean;
  attributeName: string;
  groupBaseDN?: string;
  groupFilter?: string;
  prefix?: string;
  suffix?: string;
  caseSensitive: boolean;
  defaultGroups: string[];
  requiredGroups: string[];
  adminGroups: string[];
  syncExisting: boolean;
  createMissing: boolean;
}

export interface RoleMapping {
  enabled: boolean;
  attributeName?: string;
  mapping: Record<string, string>;
  defaultRole: string;
  adminRoles: string[];
  userRoles: string[];
  guestRoles: string[];
  fallbackToDefault: boolean;
}

export interface SecurityConfig {
  redirectUriValidation: boolean;
  stateValidation: boolean;
  nonceValidation: boolean;
  tokenValidation: boolean;
  signatureValidation: boolean;
  audienceValidation: boolean;
  issuerValidation: boolean;
  maxTokenAge: number;
  clockSkewTolerance: number;
  allowedOrigins: string[];
  encryption: {
    atRest: boolean;
    inTransit: boolean;
    algorithm: string;
  };
}

export interface FeatureConfig {
  justInTimeProvisioning: boolean;
  automaticGroupSync: boolean;
  roleSync: boolean;
  profileUpdates: boolean;
  passwordManagement: boolean;
  singleLogout: boolean;
  sessionManagement: boolean;
  auditLogging: boolean;
  analytics: boolean;
}

export interface CallbackConfig {
  redirectUri: string;
  postLogoutRedirectUri?: string;
  allowedRedirectUris: string[];
  errorCallback: string;
  successCallback: string;
}

// Authentication request/response interfaces
export interface AuthenticationRequest {
  providerId: string;
  protocol: AuthenticationProtocol;
  redirectUri: string;
  state?: string;
  nonce?: string;
  scopes?: string[];
  responseType?: string;
  responseMode?: string;
  maxAge?: number;
  prompt?: string;
  loginHint?: string;
  acrValues?: string[];
  uiLocales?: string[];
  claims?: Record<string, any>;
  relayState?: string;
  forceAuthn?: boolean;
  passive?: boolean;
}

export interface AuthenticationResponse {
  providerId: string;
  protocol: AuthenticationProtocol;
  success: boolean;
  user?: AuthenticatedUser;
  tokens?: TokenSet;
  error?: AuthenticationError;
  state?: string;
  relayState?: string;
  timestamp: Date;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  username?: string;
  avatar?: string;
  locale?: string;
  timezone?: string;
  phone?: string;
  department?: string;
  title?: string;
  manager?: string;
  employeeId?: string;
  attributes: Record<string, any>;
  groups: string[];
  roles: string[];
  providerMetadata: {
    providerId: string;
    providerType: string;
    providerName: string;
    originalId: string;
    authenticatedAt: Date;
    expiresAt?: Date;
    authMethod: string;
    authContext?: any;
  };
}

export interface TokenSet {
  accessToken?: string;
  idToken?: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn: number;
  scope?: string;
  idTokenClaims?: any;
  userInfo?: any;
}

export interface AuthenticationError {
  code: string;
  message: string;
  description?: string;
  hint?: string;
  state?: string;
  providerSpecific?: any;
}

/**
 * Base provider interface that all SSO providers must implement
 */
export interface ISSOProvider {
  readonly type: ProviderType;
  readonly protocol: AuthenticationProtocol;
  readonly config: ProviderConfig;

  /**
   * Initialize the provider with configuration
   */
  initialize(config: ProviderConfig): Promise<void>;

  /**
   * Get provider metadata and capabilities
   */
  getMetadata(): Promise<ProviderMetadata>;

  /**
   * Check if provider is healthy and responsive
   */
  healthCheck(): Promise<ProviderHealthStatus>;

  /**
   * Generate authentication request
   */
  createAuthenticationRequest(request: AuthenticationRequest): Promise<{
    request: AuthenticationRequest;
    redirectUrl: string;
    metadata?: any;
  }>;

  /**
   * Process authentication response
   */
  processAuthenticationResponse(
    response: any,
    request: AuthenticationRequest
  ): Promise<AuthenticationResponse>;

  /**
   * Refresh access tokens
   */
  refreshTokens(refreshToken: string): Promise<TokenSet>;

  /**
   * Revoke tokens
   */
  revokeTokens(tokens: TokenSet): Promise<void>;

  /**
   * Initiate single logout
   */
  initiateSingleLogout(
    user: AuthenticatedUser,
    tokens: TokenSet,
    options?: any
  ): Promise<{
    logoutUrl?: string;
    metadata?: any;
  }>;

  /**
   * Process single logout response
   */
  processSingleLogoutResponse(response: any): Promise<void>;

  /**
   * Get user information from tokens
   */
  getUserInfo(tokens: TokenSet): Promise<AuthenticatedUser>;

  /**
   * Validate tokens
   */
  validateTokens(tokens: TokenSet): Promise<boolean>;

  /**
   * Extract user attributes from provider response
   */
  extractUserAttributes(response: any): Promise<UserAttributes>;

  /**
   * Map groups and roles
   */
  mapGroupsAndRoles(
    attributes: UserAttributes,
    config: ProviderConfig
  ): Promise<{
    groups: string[];
    roles: string[];
  }>;
}

export interface ProviderMetadata {
  type: ProviderType;
  protocol: AuthenticationProtocol;
  name: string;
  displayName: string;
  logoUrl?: string;
  description?: string;
  version: string;
  capabilities: ProviderCapabilities;
  endpoints: {
    authorization: string;
    token: string;
    userInfo?: string;
    logout?: string;
    jwks?: string;
    metadata?: string;
  };
  supportedScopes: string[];
  supportedResponseTypes: string[];
  supportedGrantTypes: string[];
  documentation?: {
    setup?: string;
    api?: string;
    troubleshooting?: string;
  };
}

export interface UserAttributes {
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  username?: string;
  phone?: string;
  avatar?: string;
  locale?: string;
  timezone?: string;
  department?: string;
  title?: string;
  manager?: string;
  employeeId?: string;
  groups?: string[];
  roles?: string[];
  rawAttributes: Record<string, any>;
}

/**
 * SSO Provider Manager
 *
 * Main orchestrator for SSO provider management
 */
export class SSOProviderManager {
  private db: any;
  private providers: Map<string, ISSOProvider> = new Map();
  private providerInstances: Map<string, SSOProvider> = new Map();
  private config: SSOManagerConfig;
  private auditLogger: SSOAuditLogger;
  private healthMonitor: ProviderHealthMonitor;

  constructor(d1Database: D1Database, config: Partial<SSOManagerConfig> = {}) {
    this.db = drizzle(d1Database, { schema });
    this.config = {
      defaultRedirectUri: process.env.SSO_DEFAULT_REDIRECT_URI || 'https://app.qestro.app/auth/callback',
      postLogoutRedirectUri: process.env.SSO_POST_LOGOUT_URI || 'https://app.qestro.app/',
      stateSecret: process.env.SSO_STATE_SECRET || 'default-secret',
      enableHealthChecks: true,
      healthCheckInterval: 60000, // 1 minute
      sessionDuration: 8 * 60 * 60 * 1000, // 8 hours
      enableAuditLogging: true,
      enableMetrics: true,
      securityLevel: 'high',
      allowedOrigins: process.env.SSO_ALLOWED_ORIGINS?.split(',') || ['https://app.qestro.app'],
      maxConcurrentAuthRequests: 100,
      ...config
    };

    this.auditLogger = new SSOAuditLogger(d1Database);
    this.healthMonitor = new ProviderHealthMonitor();

    this.initializeProviderTypes();
    this.startHealthMonitoring();
  }

  /**
   * Initialize all available provider types
   */
  private async initializeProviderTypes(): Promise<void> {
    // Import and register provider implementations
    const providerTypes = [
      await import('./providers/azure-ad-provider'),
      await import('./providers/okta-provider'),
      await import('./providers/auth0-provider'),
      await import('./providers/google-workspace-provider'),
      await import('./providers/keycloak-provider'),
      await import('./providers/saml-provider'),
      await import('./providers/oidc-provider'),
    ];

    for (const providerModule of providerTypes) {
      if (providerModule.default) {
        const providerClass = providerModule.default;
        const instance = new providerClass(this.config);
        this.providers.set(instance.type, instance);
      }
    }

    console.log(`✅ Initialized ${this.providers.size} SSO provider types`);
  }

  /**
   * Load and configure providers from database
   */
  async loadProviders(): Promise<void> {
    try {
      const providerRecords = await this.db.select()
        .from(schema.ssoProviders)
        .where(eq(schema.ssoProviders.isActive, true));

      for (const record of providerRecords) {
        const providerConfig = JSON.parse(record.config);
        const providerType = record.type as ProviderType;

        const providerImpl = this.providers.get(providerType);
        if (!providerImpl) {
          console.warn(`⚠️ No implementation found for provider type: ${providerType}`);
          continue;
        }

        try {
          await providerImpl.initialize(providerConfig);

          const provider: SSOProvider = {
            id: record.id,
            name: record.name,
            type: providerType,
            protocol: providerImpl.protocol,
            config: providerConfig,
            isActive: record.isActive,
            isDefault: record.isDefault,
            capabilities: await this.getProviderCapabilities(providerImpl),
            healthStatus: await providerImpl.healthCheck(),
            createdAt: new Date(record.createdAt),
            updatedAt: new Date(record.updatedAt)
          };

          this.providerInstances.set(record.id, provider);
          console.log(`✅ Loaded SSO provider: ${record.name} (${providerType})`);

        } catch (error) {
          console.error(`❌ Failed to initialize provider ${record.name}:`, error);
        }
      }

      console.log(`🚀 Loaded ${this.providerInstances.size} active SSO providers`);

    } catch (error) {
      console.error('Failed to load SSO providers:', error);
      throw error;
    }
  }

  /**
   * Get all available provider types
   */
  getAvailableProviderTypes(): Array<{
    type: ProviderType;
    protocol: AuthenticationProtocol;
    name: string;
    description: string;
    capabilities: ProviderCapabilities;
  }> {
    const types = Array.from(this.providers.entries()).map(([type, impl]) => ({
      type,
      protocol: impl.protocol,
      name: this.getProviderTypeName(type),
      description: this.getProviderTypeDescription(type),
      capabilities: this.getDefaultCapabilities(type)
    }));

    return types.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get configured providers
   */
  getConfiguredProviders(): SSOProvider[] {
    return Array.from(this.providerInstances.values())
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get provider by ID
   */
  getProvider(providerId: string): SSOProvider | undefined {
    return this.providerInstances.get(providerId);
  }

  /**
   * Get provider by type
   */
  getProviderByType(type: ProviderType): SSOProvider[] {
    return Array.from(this.providerInstances.values())
      .filter(provider => provider.type === type);
  }

  /**
   * Get default provider
   */
  getDefaultProvider(): SSOProvider | undefined {
    return Array.from(this.providerInstances.values())
      .find(provider => provider.isDefault);
  }

  /**
   * Add or update a provider
   */
  async upsertProvider(providerData: {
    name: string;
    type: ProviderType;
    config: ProviderConfig;
    isActive?: boolean;
    isDefault?: boolean;
  }): Promise<SSOProvider> {
    const providerImpl = this.providers.get(providerData.type);
    if (!providerImpl) {
      throw new Error(`No implementation available for provider type: ${providerData.type}`);
    }

    // Initialize provider implementation
    await providerImpl.initialize(providerData.config);

    // Check if provider already exists
    const existingProvider = Array.from(this.providerInstances.values())
      .find(p => p.name === providerData.name);

    let providerId: string;

    if (existingProvider) {
      // Update existing provider
      providerId = existingProvider.id;

      await this.db.update(schema.ssoProviders)
        .set({
          name: providerData.name,
          type: providerData.type,
          config: JSON.stringify(providerData.config),
          isActive: providerData.isActive ?? true,
          isDefault: providerData.isDefault ?? false,
          updatedAt: Date.now()
        })
        .where(eq(schema.ssoProviders.id, providerId));

    } else {
      // Create new provider
      providerId = `provider_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await this.db.insert(schema.ssoProviders).values({
        id: providerId,
        name: providerData.name,
        type: providerData.type,
        config: JSON.stringify(providerData.config),
        isActive: providerData.isActive ?? true,
        isDefault: providerData.isDefault ?? false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    // Create provider instance
    const provider: SSOProvider = {
      id: providerId,
      name: providerData.name,
      type: providerData.type,
      protocol: providerImpl.protocol,
      config: providerData.config,
      isActive: providerData.isActive ?? true,
      isDefault: providerData.isDefault ?? false,
      capabilities: await this.getProviderCapabilities(providerImpl),
      healthStatus: await providerImpl.healthCheck(),
      createdAt: existingProvider?.createdAt || new Date(),
      updatedAt: new Date()
    };

    this.providerInstances.set(providerId, provider);

    // Log provider management action
    await this.auditLogger.logProviderManagement({
      action: existingProvider ? 'updated' : 'created',
      providerId,
      providerName: providerData.name,
      providerType: providerData.type,
      isActive: provider.isActive,
      isDefault: provider.isDefault
    });

    console.log(`${existingProvider ? '📝 Updated' : '➕ Added'} SSO provider: ${providerData.name}`);

    return provider;
  }

  /**
   * Remove a provider
   */
  async removeProvider(providerId: string): Promise<void> {
    const provider = this.providerInstances.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    // Check if this is the only active provider
    const activeProviders = Array.from(this.providerInstances.values())
      .filter(p => p.isActive && p.id !== providerId);

    if (activeProviders.length === 0) {
      throw new Error('Cannot remove the last active SSO provider');
    }

    // Deactivate in database
    await this.db.update(schema.ssoProviders)
      .set({ isActive: false, updatedAt: Date.now() })
      .where(eq(schema.ssoProviders.id, providerId));

    // Remove from memory
    this.providerInstances.delete(providerId);

    // Log provider removal
    await this.auditLogger.logProviderManagement({
      action: 'removed',
      providerId,
      providerName: provider.name,
      providerType: provider.type,
      isActive: false,
      isDefault: provider.isDefault
    });

    console.log(`🗑️ Removed SSO provider: ${provider.name}`);
  }

  /**
   * Initiate authentication with a provider
   */
  async initiateAuthentication(
    providerId: string,
    request: Partial<AuthenticationRequest> = {}
  ): Promise<{
    request: AuthenticationRequest;
    redirectUrl: string;
    provider: SSOProvider;
  }> {
    const provider = this.providerInstances.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    if (!provider.isActive) {
      throw new Error(`Provider ${providerId} is not active`);
    }

    // Validate redirect URI
    const redirectUri = request.redirectUri || this.config.defaultRedirectUri;
    if (!this.validateRedirectUri(redirectUri)) {
      throw new Error(`Invalid redirect URI: ${redirectUri}`);
    }

    // Generate state and nonce
    const state = request.state || this.generateSecureToken();
    const nonce = request.nonce || this.generateSecureToken();

    const authRequest: AuthenticationRequest = {
      providerId,
      protocol: provider.protocol,
      redirectUri,
      state,
      nonce,
      scopes: request.scopes,
      responseType: request.responseType,
      responseMode: request.responseMode,
      maxAge: request.maxAge,
      prompt: request.prompt,
      loginHint: request.loginHint,
      acrValues: request.acrValues,
      uiLocales: request.uiLocales,
      claims: request.claims,
      relayState: request.relayState,
      forceAuthn: request.forceAuthn,
      passive: request.passive,
      ...request
    };

    try {
      const result = await this.providers.get(provider.type)!.createAuthenticationRequest(authRequest);

      // Log authentication initiation
      await this.auditLogger.logAuthenticationInitiation({
        providerId,
        providerName: provider.name,
        providerType: provider.type,
        protocol: provider.protocol,
        requestId: authRequest.state,
        redirectUri,
        state: authRequest.state,
        nonce: authRequest.nonce,
        forceAuthn: authRequest.forceAuthn,
        ipAddress: 'unknown', // Would come from request context
        userAgent: 'unknown'
      });

      return {
        request: authRequest,
        redirectUrl: result.redirectUrl,
        provider
      };

    } catch (error) {
      // Log authentication failure
      await this.auditLogger.logAuthenticationFailure({
        providerId,
        providerName: provider.name,
        error: error instanceof Error ? error.message : 'Unknown error',
        stage: 'initiation',
        ipAddress: 'unknown',
        userAgent: 'unknown'
      });

      throw error;
    }
  }

  /**
   * Process authentication response
   */
  async processAuthenticationResponse(
    providerId: string,
    response: any,
    state?: string
  ): Promise<AuthenticationResponse> {
    const provider = this.providerInstances.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    try {
      // Reconstruct original request (would be stored in session/cache)
      const originalRequest: AuthenticationRequest = {
        providerId,
        protocol: provider.protocol,
        redirectUri: this.config.defaultRedirectUri,
        state,
        // Other fields would be retrieved from storage
      } as AuthenticationRequest;

      const authResponse = await this.providers.get(provider.type)!.processAuthenticationResponse(
        response,
        originalRequest
      );

      if (authResponse.success && authResponse.user) {
        // Log successful authentication
        await this.auditLogger.logAuthenticationSuccess({
          providerId,
          providerName: provider.name,
          providerType: provider.type,
          protocol: provider.protocol,
          userId: authResponse.user.id,
          userEmail: authResponse.user.email,
          requestId: state,
          ipAddress: 'unknown',
          userAgent: 'unknown',
          authMethod: authResponse.user.providerMetadata.authMethod,
          isNewUser: false, // Would be determined by user lookup
          groups: authResponse.user.groups,
          roles: authResponse.user.roles
        });
      } else {
        // Log authentication failure
        await this.auditLogger.logAuthenticationFailure({
          providerId,
          providerName: provider.name,
          error: authResponse.error?.message || 'Authentication failed',
          stage: 'response_processing',
          ipAddress: 'unknown',
          userAgent: 'unknown'
        });
      }

      return authResponse;

    } catch (error) {
      // Log authentication failure
      await this.auditLogger.logAuthenticationFailure({
        providerId,
        providerName: provider.name,
        error: error instanceof Error ? error.message : 'Unknown error',
        stage: 'response_processing',
        ipAddress: 'unknown',
        userAgent: 'unknown'
      });

      throw error;
    }
  }

  /**
   * Get provider health status
   */
  async getProviderHealth(providerId: string): Promise<ProviderHealthStatus | null> {
    const provider = this.providerInstances.get(providerId);
    if (!provider) {
      return null;
    }

    const providerImpl = this.providers.get(provider.type);
    if (!providerImpl) {
      return null;
    }

    try {
      return await providerImpl.healthCheck();
    } catch (error) {
      return {
        isHealthy: false,
        lastCheck: new Date(),
        responseTime: -1,
        errorCount: 1,
        lastError: error instanceof Error ? error.message : 'Health check failed',
        uptime: 0
      };
    }
  }

  /**
   * Get all provider health statuses
   */
  async getAllProviderHealth(): Promise<Array<{
    providerId: string;
    providerName: string;
    health: ProviderHealthStatus;
  }>> {
    const healthStatuses = await Promise.all(
      Array.from(this.providerInstances.entries()).map(async ([providerId, provider]) => {
        const health = await this.getProviderHealth(providerId);
        return {
          providerId,
          providerName: provider.name,
          health: health || {
            isHealthy: false,
            lastCheck: new Date(),
            responseTime: -1,
            errorCount: 1,
            lastError: 'Health check unavailable',
            uptime: 0
          }
        };
      })
    );

    return healthStatuses;
  }

  /**
   * Private helper methods
   */
  private async getProviderCapabilities(provider: ISSOProvider): Promise<ProviderCapabilities> {
    try {
      const metadata = await provider.getMetadata();
      return metadata.capabilities;
    } catch (error) {
      return this.getDefaultCapabilities(provider.type);
    }
  }

  private getDefaultCapabilities(type: ProviderType): ProviderCapabilities {
    const capabilityMap: Record<ProviderType, ProviderCapabilities> = {
      'azure-ad': {
        authentication: true,
        provisioning: true,
        groupSync: true,
        roleMapping: true,
        singleLogout: true,
        mfa: true,
        userManagement: true,
        apiAccess: true
      },
      'okta': {
        authentication: true,
        provisioning: true,
        groupSync: true,
        roleMapping: true,
        singleLogout: true,
        mfa: true,
        userManagement: true,
        apiAccess: true
      },
      'auth0': {
        authentication: true,
        provisioning: true,
        groupSync: true,
        roleMapping: true,
        singleLogout: true,
        mfa: true,
        userManagement: true,
        apiAccess: true
      },
      'google-workspace': {
        authentication: true,
        provisioning: true,
        groupSync: true,
        roleMapping: true,
        singleLogout: false,
        mfa: true,
        userManagement: false,
        apiAccess: true
      },
      'keycloak': {
        authentication: true,
        provisioning: true,
        groupSync: true,
        roleMapping: true,
        singleLogout: true,
        mfa: true,
        userManagement: true,
        apiAccess: true
      },
      'saml-custom': {
        authentication: true,
        provisioning: false,
        groupSync: false,
        roleMapping: false,
        singleLogout: true,
        mfa: false,
        userManagement: false,
        apiAccess: false
      },
      'oidc-custom': {
        authentication: true,
        provisioning: false,
        groupSync: false,
        roleMapping: false,
        singleLogout: false,
        mfa: false,
        userManagement: false,
        apiAccess: false
      }
    };

    return capabilityMap[type] || {
      authentication: true,
      provisioning: false,
      groupSync: false,
      roleMapping: false,
      singleLogout: false,
      mfa: false,
      userManagement: false,
      apiAccess: false
    };
  }

  private getProviderTypeName(type: ProviderType): string {
    const nameMap: Record<ProviderType, string> = {
      'azure-ad': 'Microsoft Azure AD',
      'okta': 'Okta Identity Cloud',
      'auth0': 'Auth0',
      'google-workspace': 'Google Workspace',
      'keycloak': 'Keycloak',
      'saml-custom': 'Custom SAML Provider',
      'oidc-custom': 'Custom OIDC Provider'
    };

    return nameMap[type] || type;
  }

  private getProviderTypeDescription(type: ProviderType): string {
    const descriptionMap: Record<ProviderType, string> = {
      'azure-ad': 'Microsoft Azure Active Directory integration for enterprise identity management',
      'okta': 'Okta Identity Cloud for workforce identity and access management',
      'auth0': 'Auth0 platform for modern application authentication',
      'google-workspace': 'Google Workspace integration for Google Apps users',
      'keycloak': 'Open-source identity and access management solution',
      'saml-custom': 'Custom SAML 2.0 identity provider integration',
      'oidc-custom': 'Custom OpenID Connect provider integration'
    };

    return descriptionMap[type] || `Integration for ${type}`;
  }

  private validateRedirectUri(redirectUri: string): boolean {
    const allowedOrigins = this.config.allowedOrigins.map(origin =>
      origin.endsWith('/') ? origin.slice(0, -1) : origin
    );

    const redirectOrigin = new URL(redirectUri).origin;

    return allowedOrigins.some(allowed =>
      redirectOrigin === allowed || redirectOrigin.startsWith(allowed + '.')
    );
  }

  private generateSecureToken(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const payload = `${timestamp}-${random}`;
    const signature = Buffer.from(payload).toString('base64');

    return `${payload}.${signature}`;
  }

  private startHealthMonitoring(): void {
    if (!this.config.enableHealthChecks) {
      return;
    }

    setInterval(async () => {
      for (const [providerId, provider] of this.providerInstances) {
        try {
          const providerImpl = this.providers.get(provider.type);
          if (providerImpl) {
            const health = await providerImpl.healthCheck();
            provider.healthStatus = health;

            // Log health status changes
            if (!health.isHealthy && provider.healthStatus.isHealthy) {
              console.warn(`⚠️ Provider ${provider.name} (${providerId}) became unhealthy`);
              await this.auditLogger.logProviderHealthChange({
                providerId,
                providerName: provider.name,
                status: 'unhealthy',
                error: health.lastError,
                responseTime: health.responseTime
              });
            } else if (health.isHealthy && !provider.healthStatus.isHealthy) {
              console.log(`✅ Provider ${provider.name} (${providerId}) recovered`);
              await this.auditLogger.logProviderHealthChange({
                providerId,
                providerName: provider.name,
                status: 'healthy',
                responseTime: health.responseTime
              });
            }
          }
        } catch (error) {
          console.error(`❌ Health check failed for provider ${provider.name}:`, error);
          provider.healthStatus = {
            isHealthy: false,
            lastCheck: new Date(),
            responseTime: -1,
            errorCount: provider.healthStatus.errorCount + 1,
            lastError: error instanceof Error ? error.message : 'Health check error',
            uptime: 0
          };
        }
      }
    }, this.config.healthCheckInterval);
  }
}

// Supporting interfaces
interface SSOManagerConfig {
  defaultRedirectUri: string;
  postLogoutRedirectUri: string;
  stateSecret: string;
  enableHealthChecks: boolean;
  healthCheckInterval: number;
  sessionDuration: number;
  enableAuditLogging: boolean;
  enableMetrics: boolean;
  securityLevel: 'low' | 'medium' | 'high';
  allowedOrigins: string[];
  maxConcurrentAuthRequests: number;
}

/**
 * SSO Audit Logger
 */
class SSOAuditLogger {
  private db: any;

  constructor(d1Database: D1Database) {
    this.db = drizzle(d1Database, { schema });
  }

  async logAuthenticationInitiation(data: {
    providerId: string;
    providerName: string;
    providerType: string;
    protocol: string;
    requestId: string;
    redirectUri: string;
    state: string;
    nonce: string;
    forceAuthn?: boolean;
    ipAddress: string;
    userAgent: string;
  }): Promise<void> {
    await this.db.insert(schema.ssoAuditLogs).values({
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      eventType: 'authn_initiated',
      providerId: data.providerId,
      providerName: data.providerName,
      providerType: data.providerType,
      protocol: data.protocol,
      requestId: data.requestId,
      state: data.state,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      status: 'initiated',
      timestamp: Date.now(),
      metadata: JSON.stringify({
        redirectUri: data.redirectUri,
        nonce: data.nonce,
        forceAuthn: data.forceAuthn,
        protocol: data.protocol
      })
    });
  }

  async logAuthenticationSuccess(data: {
    providerId: string;
    providerName: string;
    providerType: string;
    protocol: string;
    userId: string;
    userEmail: string;
    requestId: string;
    ipAddress: string;
    userAgent: string;
    authMethod: string;
    isNewUser: boolean;
    groups: string[];
    roles: string[];
  }): Promise<void> {
    await this.db.insert(schema.ssoAuditLogs).values({
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      eventType: 'authn_success',
      providerId: data.providerId,
      providerName: data.providerName,
      providerType: data.providerType,
      protocol: data.protocol,
      userId: data.userId,
      requestId: data.requestId,
      state: data.state,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      status: 'success',
      timestamp: Date.now(),
      metadata: JSON.stringify({
        userEmail: data.userEmail,
        authMethod: data.authMethod,
        isNewUser: data.isNewUser,
        groups: data.groups,
        roles: data.roles,
        protocol: data.protocol
      })
    });
  }

  async logAuthenticationFailure(data: {
    providerId?: string;
    providerName?: string;
    error: string;
    stage: string;
    ipAddress: string;
    userAgent: string;
  }): Promise<void> {
    await this.db.insert(schema.ssoAuditLogs).values({
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      eventType: 'authn_failure',
      providerId: data.providerId,
      providerName: data.providerName,
      error: data.error,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      status: 'failed',
      timestamp: Date.now(),
      metadata: JSON.stringify({
        stage: data.stage,
        timestamp: new Date().toISOString()
      })
    });
  }

  async logProviderManagement(data: {
    action: 'created' | 'updated' | 'removed';
    providerId: string;
    providerName: string;
    providerType: string;
    isActive: boolean;
    isDefault: boolean;
  }): Promise<void> {
    await this.db.insert(schema.ssoAuditLogs).values({
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      eventType: 'provider_management',
      providerId: data.providerId,
      providerName: data.providerName,
      providerType: data.providerType,
      status: data.action,
      timestamp: Date.now(),
      metadata: JSON.stringify({
        isActive: data.isActive,
        isDefault: data.isDefault,
        action: data.action
      })
    });
  }

  async logProviderHealthChange(data: {
    providerId: string;
    providerName: string;
    status: 'healthy' | 'unhealthy';
    error?: string;
    responseTime?: number;
  }): Promise<void> {
    await this.db.insert(schema.ssoAuditLogs).values({
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      eventType: 'provider_health',
      providerId: data.providerId,
      providerName: data.providerName,
      status: data.status,
      timestamp: Date.now(),
      metadata: JSON.stringify({
        error: data.error,
        responseTime: data.responseTime,
        timestamp: new Date().toISOString()
      })
    });
  }
}

/**
 * Provider Health Monitor
 */
class ProviderHealthMonitor {
  private healthHistory: Map<string, Array<{
    timestamp: Date;
    isHealthy: boolean;
    responseTime: number;
    error?: string;
  }>> = new Map();

  recordHealthCheck(providerId: string, health: ProviderHealthStatus): void {
    if (!this.healthHistory.has(providerId)) {
      this.healthHistory.set(providerId, []);
    }

    const history = this.healthHistory.get(providerId)!;
    history.push({
      timestamp: health.lastCheck,
      isHealthy: health.isHealthy,
      responseTime: health.responseTime,
      error: health.lastError
    });

    // Keep only last 24 hours of data
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const filtered = history.filter(entry => entry.timestamp > cutoff);
    this.healthHistory.set(providerId, filtered);
  }

  getHealthMetrics(providerId: string): {
    uptime24h: number;
    averageResponseTime: number;
    errorRate: number;
    last24hChecks: number;
  } {
    const history = this.healthHistory.get(providerId) || [];
    const last24h = history.filter(entry =>
      entry.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    const healthyChecks = last24h.filter(entry => entry.isHealthy).length;
    const totalTime = last24h.reduce((sum, entry) => sum + entry.responseTime, 0);

    return {
      uptime24h: last24h.length > 0 ? (healthyChecks / last24h.length) * 100 : 0,
      averageResponseTime: last24h.length > 0 ? totalTime / last24h.length : 0,
      errorRate: last24h.length > 0 ? ((last24h.length - healthyChecks) / last24h.length) * 100 : 0,
      last24hChecks: last24h.length
    };
  }
}

/**
 * Factory function
 */
export function createSSOProviderManager(
  d1Database: D1Database,
  config?: Partial<SSOManagerConfig>
): SSOProviderManager {
  return new SSOProviderManager(d1Database, config);
}
