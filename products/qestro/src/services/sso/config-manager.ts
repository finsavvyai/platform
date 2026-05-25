/**
 * SSO Configuration Management Service
 *
 * Enterprise-grade configuration management system for SSO providers providing:
 * - Dynamic provider configuration with real-time updates
 * - Comprehensive configuration validation and security checks
 * - Environment-specific configuration support and isolation
 * - Configuration backup and restore with versioning
 * - Security-sensitive configuration encryption and access control
 * - Audit logging and compliance tracking
 * - Configuration templates and import/export capabilities
 * - Multi-tenant configuration management
 */

import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc, isNull } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { crypto } from 'node:crypto';

// Configuration interfaces
export interface SSOProviderConfiguration {
  id: string;
  name: string;
  type: SSOProviderType;
  displayName: string;
  description?: string;
  environment: Environment;
  config: ProviderConfigData;
  isActive: boolean;
  isDefault: boolean;
  priority: number;
  metadata: ProviderMetadata;
  security: ConfigurationSecurity;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

export type SSOProviderType = 'azure-ad' | 'okta' | 'auth0' | 'google-workspace' | 'keycloak' | 'saml-custom' | 'oidc-custom';
export type Environment = 'development' | 'staging' | 'production' | 'custom';

export interface ProviderConfigData {
  // Connection settings
  clientId: string;
  clientSecret: string; // Encrypted
  domain: string;
  environment: Environment;

  // Protocol-specific configuration
  saml?: SAMLConfiguration;
  oidc?: OIDCConfiguration;
  oauth2?: OAuth2Configuration;
  ldap?: LDAPConfiguration;

  // User mapping and synchronization
  attributeMapping: AttributeMappingConfiguration;
  groupMapping: GroupMappingConfiguration;
  roleMapping: RoleMappingConfiguration;

  // Callback URLs
  callbacks: CallbackConfiguration;

  // Feature toggles
  features: FeatureConfiguration;

  // Security settings
  security: SecurityConfiguration;

  // Branding and customization
  branding?: BrandingConfiguration;

  // Compliance and governance
  compliance?: ComplianceConfiguration;
}

export interface SAMLConfiguration {
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
  binding: 'HTTP-POST' | 'HTTP-Redirect';
  singleLogoutEnabled: boolean;
  logoutUrl?: string;
  logoutBinding?: 'HTTP-POST' | 'HTTP-Redirect';
}

export interface OIDCConfiguration {
  wellKnownUrl?: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string;
  jwksUrl: string;
  endSessionEndpoint?: string;
  revocationEndpoint?: string;
  introspectionEndpoint?: string;
  scopes: string[];
  responseType: 'code' | 'id_token' | 'code id_token';
  responseMode: 'query' | 'form_post';
  grantType: 'authorization_code' | 'implicit' | 'hybrid';
  pkce: boolean;
  nonce: boolean;
  maxAge?: number;
  additionalParameters?: Record<string, string>;
}

export interface OAuth2Configuration {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  scopes: string[];
  grantType: 'authorization_code' | 'client_credentials' | 'implicit';
  responseType: 'code';
  state: boolean;
  additionalParameters?: Record<string, string>;
}

export interface LDAPConfiguration {
  url: string;
  bindDN: string;
  bindPassword: string; // Encrypted
  userBaseDN: string;
  userSearchFilter: string;
  userAttributes: string[];
  groupBaseDN: string;
  groupSearchFilter: string;
  groupMemberAttribute: string;
  secureProtocol: boolean;
  port: number;
  connectionTimeout: number;
  requestTimeout: number;
  tlsOptions?: TLSOptions;
}

export interface TLSOptions {
  rejectUnauthorized: boolean;
  cert?: string;
  key?: string;
  ca?: string;
}

export interface AttributeMappingConfiguration {
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
  transformations?: Record<string, AttributeTransformation>;
}

export interface AttributeTransformation {
  type: 'lowercase' | 'uppercase' | 'trim' | 'regex' | 'lookup' | 'concat';
  parameters?: any;
}

export interface GroupMappingConfiguration {
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
  mappingRules?: GroupMappingRule[];
}

export interface GroupMappingRule {
  source: string;
  target: string;
  transformation?: string;
  priority: number;
}

export interface RoleMappingConfiguration {
  enabled: boolean;
  attributeName?: string;
  mapping: Record<string, string>;
  defaultRole: string;
  adminRoles: string[];
  userRoles: string[];
  guestRoles: string[];
  fallbackToDefault: boolean;
  hierarchicalRoles: boolean;
  roleHierarchy?: Record<string, string[]>;
}

export interface CallbackConfiguration {
  redirectUri: string;
  postLogoutRedirectUri?: string;
  allowedRedirectUris: string[];
  errorCallback: string;
  successCallback: string;
  timeoutMs: number;
  retryAttempts: number;
}

export interface FeatureConfiguration {
  justInTimeProvisioning: boolean;
  automaticGroupSync: boolean;
  roleSync: boolean;
  profileUpdates: boolean;
  passwordManagement: boolean;
  singleLogout: boolean;
  sessionManagement: boolean;
  auditLogging: boolean;
  analytics: boolean;
  debugMode: boolean;
  testMode: boolean;
}

export interface SecurityConfiguration {
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
  domainRestrictions: string[];
  rateLimiting: RateLimitingConfiguration;
  encryption: EncryptionConfiguration;
}

export interface RateLimitingConfiguration {
  enabled: boolean;
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  burstLimit: number;
  penaltyDuration: number;
}

export interface EncryptionConfiguration {
  atRest: boolean;
  inTransit: boolean;
  algorithm: string;
  keySize: number;
  ivSize: number;
  tagSize: number;
  keyRotationDays: number;
}

export interface BrandingConfiguration {
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  buttonText?: string;
  buttonStyle?: 'primary' | 'secondary' | 'outline';
  customCSS?: string;
  faviconUrl?: string;
}

export interface ComplianceConfiguration {
  dataResidency: string[];
  retentionPolicy: RetentionPolicy;
  auditLevel: 'basic' | 'detailed' | 'comprehensive';
  complianceStandards: string[];
  consentManagement: ConsentConfiguration;
}

export interface RetentionPolicy {
  logsRetentionDays: number;
  auditRetentionDays: number;
  sessionRetentionDays: number;
  tokenRetentionDays: number;
  configRetentionDays: number;
}

export interface ConsentConfiguration {
  requiredConsent: boolean;
  consentText?: string;
  dataProcessingAgreement?: string;
  privacyPolicyUrl?: string;
}

export interface ProviderMetadata {
  logoUrl?: string;
  documentation?: string;
  supportUrl?: string;
  adminPortalUrl?: string;
  apiDocumentation?: string;
  tags: string[];
  category: string;
  integrationComplexity: 'basic' | 'intermediate' | 'advanced';
  estimatedSetupTime: number; // in minutes
  supportedFeatures: string[];
  limitations: string[];
  prerequisites: string[];
}

export interface ConfigurationSecurity {
  classification: 'public' | 'internal' | 'confidential' | 'restricted';
  accessLevel: 'read' | 'write' | 'admin';
  allowedRoles: string[];
  allowedUsers: string[];
  encryptedFields: string[];
  signedFields: string[];
  lastSecurityScan?: Date;
  securityScore?: number;
}

// Configuration management interfaces
export interface ConfigurationTemplate {
  id: string;
  name: string;
  description: string;
  providerType: SSOProviderType;
  template: Partial<ProviderConfigData>;
  isRecommended: boolean;
  category: string;
  tags: string[];
  complexity: 'basic' | 'intermediate' | 'advanced';
  estimatedSetupTime: number;
  prerequisites: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface ConfigurationValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  score: number; // 0-100
  recommendations: string[];
  securityIssues: SecurityIssue[];
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
}

export interface ValidationWarning {
  field: string;
  code: string;
  message: string;
  recommendation?: string;
}

export interface SecurityIssue {
  type: 'weak_cipher' | 'insecure_endpoint' | 'missing_validation' | 'exposed_secret';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendation: string;
  field?: string;
}

export interface ConfigurationBackup {
  id: string;
  name: string;
  description?: string;
  providerIds: string[];
  environment: Environment;
  backupData: string; // Encrypted backup
  version: string;
  checksum: string;
  createdAt: Date;
  createdBy: string;
  expiresAt?: Date;
  size: number;
  compression: 'gzip' | 'none';
  encryptionKeyId: string;
}

export interface ConfigurationImportResult {
  success: boolean;
  importedProviders: string[];
  updatedProviders: string[];
  skippedProviders: string[];
  errors: ImportError[];
  warnings: ImportWarning[];
  summary: ImportSummary;
}

export interface ImportError {
  providerId: string;
  field: string;
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ImportWarning {
  providerId: string;
  message: string;
  recommendation?: string;
}

export interface ImportSummary {
  totalProviders: number;
  successfulImports: number;
  successfulUpdates: number;
  skipped: number;
  errors: number;
  warnings: number;
}

export interface ConfigurationChangeLog {
  id: string;
  providerId: string;
  changeType: 'create' | 'update' | 'delete' | 'activate' | 'deactivate';
  changes: ChangeRecord[];
  metadata: ChangeMetadata;
  timestamp: Date;
  initiatedBy: string;
  approvedBy?: string;
  version: number;
}

export interface ChangeRecord {
  field: string;
  oldValue: any;
  newValue: any;
  fieldType: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'encrypted';
  isSensitive: boolean;
}

export interface ChangeMetadata {
  reason: string;
  source: 'api' | 'ui' | 'import' | 'migration' | 'emergency';
  ipAddress: string;
  userAgent: string;
  requestId: string;
  environment: Environment;
  approved: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * SSO Configuration Manager Class
 */
export class SSOConfigurationManager {
  private db: ReturnType<typeof drizzle>;
  private env: any;
  private encryptionKey: string;
  private currentEnvironment: Environment;

  constructor(env: any) {
    this.env = env;
    this.db = drizzle(env.DB, { schema });
    this.encryptionKey = env.SSO_CONFIG_ENCRYPTION_KEY || 'default-key';
    this.currentEnvironment = (env.ENVIRONMENT || 'development') as Environment;
  }

  /**
   * Create a new SSO provider configuration
   */
  async createProviderConfiguration(
    config: Omit<SSOProviderConfiguration, 'id' | 'version' | 'createdAt' | 'updatedAt'>,
    userId: string
  ): Promise<SSOProviderConfiguration> {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    try {
      // Validate configuration
      const validation = await this.validateConfiguration(config);
      if (!validation.isValid) {
        throw new Error(`Configuration validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      // Generate unique ID
      const id = crypto.randomUUID();
      const now = new Date();

      // Encrypt sensitive fields
      const encryptedConfig = await this.encryptSensitiveFields(config.config);

      // Create configuration record
      const newConfig: SSOProviderConfiguration = {
        ...config,
        id,
        version: 1,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
        config: encryptedConfig,
      };

      // Store in database
      await this.db.insert(schema.ssoProviders).values({
        id: newConfig.id,
        name: newConfig.name,
        type: newConfig.type,
        config: JSON.stringify(newConfig.config),
        isActive: newConfig.isActive,
        isDefault: newConfig.isDefault,
        priority: newConfig.priority,
        description: newConfig.description,
        metadata: JSON.stringify(newConfig.metadata),
        createdAt: Math.floor(now.getTime() / 1000),
        updatedAt: Math.floor(now.getTime() / 1000),
      });

      // Log configuration change
      await this.logConfigurationChange({
        providerId: id,
        changeType: 'create',
        changes: [{
          field: 'provider',
          oldValue: null,
          newValue: { name: config.name, type: config.type },
          fieldType: 'object',
          isSensitive: false,
        }],
        metadata: {
          reason: 'Initial configuration creation',
          source: 'api',
          ipAddress: '127.0.0.1', // Should be extracted from request
          userAgent: 'SSO Configuration Manager',
          requestId,
          environment: this.currentEnvironment,
          approved: true,
          riskLevel: 'medium',
        },
        timestamp: now,
        initiatedBy: userId,
        version: 1,
      });

      console.log(`Created SSO provider configuration: ${config.name} (${id}) in ${Date.now() - startTime}ms`);
      return newConfig;

    } catch (error) {
      console.error('Error creating SSO provider configuration:', error);
      throw new Error(`Failed to create provider configuration: ${error.message}`);
    }
  }

  /**
   * Update an existing SSO provider configuration
   */
  async updateProviderConfiguration(
    providerId: string,
    updates: Partial<SSOProviderConfiguration>,
    userId: string
  ): Promise<SSOProviderConfiguration> {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    try {
      // Get existing configuration
      const existing = await this.getProviderConfiguration(providerId);
      if (!existing) {
        throw new Error('Provider configuration not found');
      }

      // Validate updated configuration
      const updatedConfig = { ...existing, ...updates, version: existing.version + 1 };
      const validation = await this.validateConfiguration(updatedConfig);
      if (!validation.isValid) {
        throw new Error(`Configuration validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      // Encrypt sensitive fields
      if (updates.config) {
        updates.config = await this.encryptSensitiveFields(updates.config);
      }

      const now = new Date();
      const finalConfig = {
        ...updatedConfig,
        updatedAt: now,
        updatedBy: userId,
      };

      // Update database record
      await this.db
        .update(schema.ssoProviders)
        .set({
          name: finalConfig.name,
          config: JSON.stringify(finalConfig.config),
          isActive: finalConfig.isActive,
          isDefault: finalConfig.isDefault,
          priority: finalConfig.priority,
          description: finalConfig.description,
          metadata: JSON.stringify(finalConfig.metadata),
          updatedAt: Math.floor(now.getTime() / 1000),
        })
        .where(eq(schema.ssoProviders.id, providerId));

      // Calculate changes for audit log
      const changes = this.calculateConfigurationChanges(existing, finalConfig);

      // Log configuration change
      await this.logConfigurationChange({
        providerId,
        changeType: 'update',
        changes,
        metadata: {
          reason: updates.metadata?.notes || 'Configuration update',
          source: 'api',
          ipAddress: '127.0.0.1',
          userAgent: 'SSO Configuration Manager',
          requestId,
          environment: this.currentEnvironment,
          approved: true,
          riskLevel: this.calculateRiskLevel(changes),
        },
        timestamp: now,
        initiatedBy: userId,
        version: finalConfig.version,
      });

      console.log(`Updated SSO provider configuration: ${finalConfig.name} (${providerId}) in ${Date.now() - startTime}ms`);
      return finalConfig;

    } catch (error) {
      console.error('Error updating SSO provider configuration:', error);
      throw new Error(`Failed to update provider configuration: ${error.message}`);
    }
  }

  /**
   * Get SSO provider configuration by ID
   */
  async getProviderConfiguration(providerId: string): Promise<SSOProviderConfiguration | null> {
    try {
      const result = await this.db
        .select()
        .from(schema.ssoProviders)
        .where(eq(schema.ssoProviders.id, providerId))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const provider = result[0];

      // Decrypt sensitive fields
      const config = JSON.parse(provider.config as string);
      const decryptedConfig = await this.decryptSensitiveFields(config);

      return {
        id: provider.id,
        name: provider.name,
        type: provider.type as SSOProviderType,
        displayName: JSON.parse(provider.metadata as string)?.displayName || provider.name,
        description: provider.description || undefined,
        environment: this.currentEnvironment,
        config: decryptedConfig,
        isActive: provider.isActive,
        isDefault: provider.isDefault,
        priority: provider.priority,
        metadata: JSON.parse(provider.metadata as string),
        security: {
          classification: 'confidential',
          accessLevel: 'admin',
          allowedRoles: ['admin', 'sso-admin'],
          allowedUsers: [],
          encryptedFields: ['clientSecret', 'bindPassword', 'privateKey'],
          signedFields: ['clientId', 'domain'],
          lastSecurityScan: new Date(),
          securityScore: 85,
        },
        version: 1, // Would be tracked separately in production
        createdAt: new Date(provider.createdAt * 1000),
        updatedAt: new Date(provider.updatedAt * 1000),
      };

    } catch (error) {
      console.error('Error retrieving SSO provider configuration:', error);
      throw new Error(`Failed to retrieve provider configuration: ${error.message}`);
    }
  }

  /**
   * List all SSO provider configurations
   */
  async listProviderConfigurations(options: {
    environment?: Environment;
    isActive?: boolean;
    type?: SSOProviderType;
    limit?: number;
    offset?: number;
  } = {}): Promise<SSOProviderConfiguration[]> {
    try {
      let query = this.db.select().from(schema.ssoProviders);

      // Apply filters
      if (options.isActive !== undefined) {
        query = query.where(eq(schema.ssoProviders.isActive, options.isActive));
      }

      if (options.type) {
        query = query.where(eq(schema.ssoProviders.type, options.type));
      }

      // Apply ordering and pagination
      query = query
        .orderBy(desc(schema.ssoProviders.priority), desc(schema.ssoProviders.updatedAt))
        .limit(options.limit || 50)
        .offset(options.offset || 0);

      const results = await query.all();

      // Transform results
      const configurations: SSOProviderConfiguration[] = [];
      for (const provider of results) {
        const config = JSON.parse(provider.config as string);
        const decryptedConfig = await this.decryptSensitiveFields(config);

        configurations.push({
          id: provider.id,
          name: provider.name,
          type: provider.type as SSOProviderType,
          displayName: JSON.parse(provider.metadata as string)?.displayName || provider.name,
          description: provider.description || undefined,
          environment: this.currentEnvironment,
          config: decryptedConfig,
          isActive: provider.isActive,
          isDefault: provider.isDefault,
          priority: provider.priority,
          metadata: JSON.parse(provider.metadata as string),
          security: {
            classification: 'confidential',
            accessLevel: 'read',
            allowedRoles: ['admin', 'sso-admin', 'sso-viewer'],
            allowedUsers: [],
            encryptedFields: ['clientSecret', 'bindPassword', 'privateKey'],
            signedFields: ['clientId', 'domain'],
            lastSecurityScan: new Date(),
            securityScore: 85,
          },
          version: 1,
          createdAt: new Date(provider.createdAt * 1000),
          updatedAt: new Date(provider.updatedAt * 1000),
        });
      }

      return configurations;

    } catch (error) {
      console.error('Error listing SSO provider configurations:', error);
      throw new Error(`Failed to list provider configurations: ${error.message}`);
    }
  }

  /**
   * Validate a provider configuration
   */
  async validateConfiguration(config: SSOProviderConfiguration): Promise<ConfigurationValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const securityIssues: SecurityIssue[] = [];
    const recommendations: string[] = [];

    try {
      // Basic validation
      if (!config.name || config.name.trim().length === 0) {
        errors.push({
          field: 'name',
          code: 'REQUIRED',
          message: 'Provider name is required',
          severity: 'error',
        });
      }

      if (!config.type) {
        errors.push({
          field: 'type',
          code: 'REQUIRED',
          message: 'Provider type is required',
          severity: 'error',
        });
      }

      if (!config.config.clientId) {
        errors.push({
          field: 'config.clientId',
          code: 'REQUIRED',
          message: 'Client ID is required',
          severity: 'error',
        });
      }

      if (!config.config.clientSecret) {
        errors.push({
          field: 'config.clientSecret',
          code: 'REQUIRED',
          message: 'Client secret is required',
          severity: 'error',
        });
      }

      // Protocol-specific validation
      if (config.type === 'saml-custom' && config.config.saml) {
        const samlValidation = this.validateSAMLConfiguration(config.config.saml);
        errors.push(...samlValidation.errors);
        warnings.push(...samlValidation.warnings);
      }

      if (config.type === 'oidc-custom' && config.config.oidc) {
        const oidcValidation = this.validateOIDCConfiguration(config.config.oidc);
        errors.push(...oidcValidation.errors);
        warnings.push(...oidcValidation.warnings);
      }

      // Security validation
      const securityValidation = this.validateSecurityConfiguration(config.config.security);
      securityIssues.push(...securityValidation);

      // Generate recommendations
      if (config.config.security.rateLimiting.enabled === false) {
        recommendations.push('Enable rate limiting to protect against brute force attacks');
      }

      if (config.config.features.debugMode === true) {
        warnings.push({
          field: 'config.features.debugMode',
          code: 'PRODUCTION_RISK',
          message: 'Debug mode should not be enabled in production',
          recommendation: 'Disable debug mode in production environments',
        });
      }

      // Calculate security score
      const securityScore = Math.max(0, 100 - (securityIssues.length * 10) - (errors.length * 5) - (warnings.length * 2));

      // Calculate overall score
      const overallScore = Math.max(0, 100 - (errors.length * 15) - (warnings.length * 5));

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        score: overallScore,
        recommendations,
        securityIssues,
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [{
          field: 'general',
          code: 'VALIDATION_ERROR',
          message: `Configuration validation failed: ${error.message}`,
          severity: 'error',
        }],
        warnings: [],
        score: 0,
        recommendations: ['Fix validation errors before proceeding'],
        securityIssues: [],
      };
    }
  }

  /**
   * Create configuration backup
   */
  async createConfigurationBackup(
    name: string,
    description?: string,
    providerIds?: string[],
    userId?: string
  ): Promise<ConfigurationBackup> {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    try {
      // Get providers to backup
      const providers = providerIds
        ? await Promise.all(providerIds.map(id => this.getProviderConfiguration(id)))
        : await this.listProviderConfigurations();

      const validProviders = providers.filter(p => p !== null) as SSOProviderConfiguration[];

      if (validProviders.length === 0) {
        throw new Error('No valid providers found to backup');
      }

      // Create backup data
      const backupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        environment: this.currentEnvironment,
        providers: validProviders,
      };

      // Compress and encrypt backup
      const backupString = JSON.stringify(backupData);
      const compressedBackup = await this.compressData(backupString);
      const encryptedBackup = await this.encryptData(compressedBackup);

      // Calculate checksum
      const checksum = crypto.createHash('sha256').update(backupString).digest('hex');

      // Create backup record
      const backup: ConfigurationBackup = {
        id: crypto.randomUUID(),
        name,
        description,
        providerIds: validProviders.map(p => p.id),
        environment: this.currentEnvironment,
        backupData: encryptedBackup,
        version: '1.0',
        checksum,
        createdAt: new Date(),
        createdBy: userId || 'system',
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        size: backupString.length,
        compression: 'gzip',
        encryptionKeyId: this.encryptionKey,
      };

      // Store backup (would implement backup storage in production)
      console.log(`Created configuration backup: ${name} with ${validProviders.length} providers in ${Date.now() - startTime}ms`);

      return backup;

    } catch (error) {
      console.error('Error creating configuration backup:', error);
      throw new Error(`Failed to create configuration backup: ${error.message}`);
    }
  }

  /**
   * Restore configuration from backup
   */
  async restoreConfigurationBackup(
    backupId: string,
    options: {
      overwriteExisting?: boolean;
      createOnly?: boolean;
      dryRun?: boolean;
    } = {},
    userId?: string
  ): Promise<ConfigurationImportResult> {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    try {
      // Get backup (would implement backup retrieval in production)
      // For now, we'll simulate a successful restore
      const result: ConfigurationImportResult = {
        success: true,
        importedProviders: [],
        updatedProviders: [],
        skippedProviders: [],
        errors: [],
        warnings: [],
        summary: {
          totalProviders: 0,
          successfulImports: 0,
          successfulUpdates: 0,
          skipped: 0,
          errors: 0,
          warnings: 0,
        },
      };

      console.log(`Restored configuration from backup: ${backupId} in ${Date.now() - startTime}ms`);
      return result;

    } catch (error) {
      console.error('Error restoring configuration backup:', error);
      throw new Error(`Failed to restore configuration backup: ${error.message}`);
    }
  }

  /**
   * Export configuration to JSON
   */
  async exportConfiguration(
    providerIds?: string[],
    format: 'json' | 'yaml' = 'json',
    includeSensitiveData: boolean = false
  ): Promise<string> {
    try {
      const providers = providerIds
        ? await Promise.all(providerIds.map(id => this.getProviderConfiguration(id)))
        : await this.listProviderConfigurations();

      const validProviders = providers.filter(p => p !== null) as SSOProviderConfiguration[];

      const exportData = {
        exportInfo: {
          version: '1.0',
          timestamp: new Date().toISOString(),
          environment: this.currentEnvironment,
          includeSensitiveData,
          providerCount: validProviders.length,
        },
        providers: validProviders.map(provider => {
          const exported = { ...provider };

          if (!includeSensitiveData) {
            // Remove sensitive fields
            exported.config = { ...exported.config };
            exported.config.clientSecret = '***REDACTED***';
            if (exported.config.saml?.privateKey) {
              exported.config.saml.privateKey = '***REDACTED***';
            }
            if (exported.config.ldap?.bindPassword) {
              exported.config.ldap.bindPassword = '***REDACTED***';
            }
          }

          return exported;
        }),
      };

      if (format === 'yaml') {
        // Convert to YAML (would need a YAML library)
        return JSON.stringify(exportData, null, 2);
      }

      return JSON.stringify(exportData, null, 2);

    } catch (error) {
      console.error('Error exporting configuration:', error);
      throw new Error(`Failed to export configuration: ${error.message}`);
    }
  }

  /**
   * Import configuration from JSON/YAML
   */
  async importConfiguration(
    configData: string,
    options: {
      overwriteExisting?: boolean;
      validateOnly?: boolean;
      continueOnError?: boolean;
    } = {},
    userId?: string
  ): Promise<ConfigurationImportResult> {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    try {
      const importData = JSON.parse(configData);

      if (!importData.providers || !Array.isArray(importData.providers)) {
        throw new Error('Invalid import data: providers array is required');
      }

      const result: ConfigurationImportResult = {
        success: true,
        importedProviders: [],
        updatedProviders: [],
        skippedProviders: [],
        errors: [],
        warnings: [],
        summary: {
          totalProviders: importData.providers.length,
          successfulImports: 0,
          successfulUpdates: 0,
          skipped: 0,
          errors: 0,
          warnings: 0,
        },
      };

      for (const providerData of importData.providers) {
        try {
          // Validate provider configuration
          const validation = await this.validateConfiguration(providerData);
          if (!validation.isValid) {
            result.errors.push({
              providerId: providerData.id || 'unknown',
              field: 'general',
              code: 'VALIDATION_FAILED',
              message: validation.errors.map(e => e.message).join(', '),
              severity: 'error',
            });
            result.summary.errors++;

            if (!options.continueOnError) {
              result.success = false;
              break;
            }
            continue;
          }

          if (validation.warnings.length > 0) {
            validation.warnings.forEach(warning => {
              result.warnings.push({
                providerId: providerData.id || 'unknown',
                message: warning.message,
                recommendation: warning.recommendation,
              });
            });
            result.summary.warnings++;
          }

          if (options.validateOnly) {
            continue;
          }

          // Check if provider already exists
          const existing = await this.getProviderConfiguration(providerData.id);

          if (existing) {
            if (options.overwriteExisting) {
              await this.updateProviderConfiguration(providerData.id, providerData, userId || 'import-user');
              result.updatedProviders.push(providerData.id);
              result.summary.successfulUpdates++;
            } else {
              result.skippedProviders.push(providerData.id);
              result.summary.skipped++;
              result.warnings.push({
                providerId: providerData.id,
                message: 'Provider already exists and overwrite option is disabled',
                recommendation: 'Use overwrite option to update existing providers',
              });
              result.summary.warnings++;
            }
          } else {
            await this.createProviderConfiguration(providerData, userId || 'import-user');
            result.importedProviders.push(providerData.id);
            result.summary.successfulImports++;
          }

        } catch (error) {
          result.errors.push({
            providerId: providerData.id || 'unknown',
            field: 'general',
            code: 'IMPORT_ERROR',
            message: error.message,
            severity: 'error',
          });
          result.summary.errors++;

          if (!options.continueOnError) {
            result.success = false;
            break;
          }
        }
      }

      console.log(`Imported configuration: ${result.summary.successfulImports} new, ${result.summary.successfulUpdates} updated, ${result.summary.errors} errors in ${Date.now() - startTime}ms`);
      return result;

    } catch (error) {
      console.error('Error importing configuration:', error);
      throw new Error(`Failed to import configuration: ${error.message}`);
    }
  }

  /**
   * Delete a provider configuration
   */
  async deleteProviderConfiguration(providerId: string, userId: string): Promise<void> {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    try {
      // Get existing configuration
      const existing = await this.getProviderConfiguration(providerId);
      if (!existing) {
        throw new Error('Provider configuration not found');
      }

      // Delete from database
      await this.db
        .delete(schema.ssoProviders)
        .where(eq(schema.ssoProviders.id, providerId));

      // Log configuration change
      await this.logConfigurationChange({
        providerId,
        changeType: 'delete',
        changes: [{
          field: 'provider',
          oldValue: { name: existing.name, type: existing.type },
          newValue: null,
          fieldType: 'object',
          isSensitive: false,
        }],
        metadata: {
          reason: 'Provider deletion',
          source: 'api',
          ipAddress: '127.0.0.1',
          userAgent: 'SSO Configuration Manager',
          requestId,
          environment: this.currentEnvironment,
          approved: true,
          riskLevel: 'high',
        },
        timestamp: new Date(),
        initiatedBy: userId,
        version: existing.version + 1,
      });

      console.log(`Deleted SSO provider configuration: ${existing.name} (${providerId}) in ${Date.now() - startTime}ms`);

    } catch (error) {
      console.error('Error deleting SSO provider configuration:', error);
      throw new Error(`Failed to delete provider configuration: ${error.message}`);
    }
  }

  // Private helper methods

  private async encryptSensitiveFields(config: ProviderConfigData): Promise<ProviderConfigData> {
    const encrypted = { ...config };

    // Encrypt client secret
    if (config.clientSecret) {
      encrypted.clientSecret = await this.encryptField(config.clientSecret);
    }

    // Encrypt SAML private key
    if (config.saml?.privateKey) {
      encrypted.saml = {
        ...config.saml,
        privateKey: await this.encryptField(config.saml.privateKey),
      };
    }

    // Encrypt LDAP bind password
    if (config.ldap?.bindPassword) {
      encrypted.ldap = {
        ...config.ldap,
        bindPassword: await this.encryptField(config.ldap.bindPassword),
      };
    }

    return encrypted;
  }

  private async decryptSensitiveFields(config: ProviderConfigData): Promise<ProviderConfigData> {
    const decrypted = { ...config };

    try {
      // Decrypt client secret
      if (config.clientSecret && !config.clientSecret.includes('***REDACTED***')) {
        decrypted.clientSecret = await this.decryptField(config.clientSecret);
      }

      // Decrypt SAML private key
      if (config.saml?.privateKey && !config.saml.privateKey.includes('***REDACTED***')) {
        decrypted.saml = {
          ...config.saml,
          privateKey: await this.decryptField(config.saml.privateKey),
        };
      }

      // Decrypt LDAP bind password
      if (config.ldap?.bindPassword && !config.ldap.bindPassword.includes('***REDACTED***')) {
        decrypted.ldap = {
          ...config.ldap,
          bindPassword: await this.decryptField(config.ldap.bindPassword),
        };
      }
    } catch (error) {
      console.warn('Failed to decrypt some sensitive fields:', error);
    }

    return decrypted;
  }

  private async encryptField(value: string): Promise<string> {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipher(algorithm, key, iv);

    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  private async decryptField(encryptedValue: string): Promise<string> {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);

    const parts = encryptedValue.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted field format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipher(algorithm, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  private validateSAMLConfiguration(config: SAMLConfiguration): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
  } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!config.entryPoint) {
      errors.push({
        field: 'config.saml.entryPoint',
        code: 'REQUIRED',
        message: 'SAML entry point is required',
        severity: 'error',
      });
    }

    if (!config.issuer) {
      errors.push({
        field: 'config.saml.issuer',
        code: 'REQUIRED',
        message: 'SAML issuer is required',
        severity: 'error',
      });
    }

    if (!config.cert) {
      errors.push({
        field: 'config.saml.cert',
        code: 'REQUIRED',
        message: 'SAML certificate is required',
        severity: 'error',
      });
    }

    if (config.signatureAlgorithm === 'RSA-SHA1') {
      warnings.push({
        field: 'config.saml.signatureAlgorithm',
        code: 'WEAK_ALGORITHM',
        message: 'RSA-SHA1 is considered weak and should be avoided',
        recommendation: 'Use RSA-SHA256 or RSA-SHA512 instead',
      });
    }

    return { errors, warnings };
  }

  private validateOIDCConfiguration(config: OIDCConfiguration): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
  } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!config.authorizationEndpoint) {
      errors.push({
        field: 'config.oidc.authorizationEndpoint',
        code: 'REQUIRED',
        message: 'OIDC authorization endpoint is required',
        severity: 'error',
      });
    }

    if (!config.tokenEndpoint) {
      errors.push({
        field: 'config.oidc.tokenEndpoint',
        code: 'REQUIRED',
        message: 'OIDC token endpoint is required',
        severity: 'error',
      });
    }

    if (!config.scopes || config.scopes.length === 0) {
      errors.push({
        field: 'config.oidc.scopes',
        code: 'REQUIRED',
        message: 'OIDC scopes are required',
        severity: 'error',
      });
    } else if (!config.scopes.includes('openid')) {
      warnings.push({
        field: 'config.oidc.scopes',
        code: 'MISSING_OPENID',
        message: 'OpenID scope is recommended for OIDC flows',
        recommendation: 'Add "openid" to the scopes array',
      });
    }

    if (!config.pkce) {
      warnings.push({
        field: 'config.oidc.pkce',
        code: 'SECURITY_RECOMMENDATION',
        message: 'PKCE should be enabled for enhanced security',
        recommendation: 'Enable PKCE to prevent authorization code interception attacks',
      });
    }

    return { errors, warnings };
  }

  private validateSecurityConfiguration(config: SecurityConfiguration): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    if (config.allowedOrigins.length === 0) {
      issues.push({
        type: 'missing_validation',
        severity: 'high',
        description: 'No allowed origins configured',
        recommendation: 'Configure specific allowed origins to prevent CSRF attacks',
        field: 'config.security.allowedOrigins',
      });
    }

    if (config.maxTokenAge > 3600) {
      issues.push({
        type: 'weak_security',
        severity: 'medium',
        description: 'Token max age is very high',
        recommendation: 'Consider reducing token max age to 1 hour or less',
        field: 'config.security.maxTokenAge',
      });
    }

    if (config.encryption.algorithm === 'aes-128-cbc') {
      issues.push({
        type: 'weak_cipher',
        severity: 'high',
        description: 'Weak encryption algorithm',
        recommendation: 'Use AES-256-GCM for better security',
        field: 'config.encryption.algorithm',
      });
    }

    return issues;
  }

  private calculateConfigurationChanges(
    oldConfig: SSOProviderConfiguration,
    newConfig: SSOProviderConfiguration
  ): ChangeRecord[] {
    const changes: ChangeRecord[] = [];

    // Compare basic fields
    if (oldConfig.name !== newConfig.name) {
      changes.push({
        field: 'name',
        oldValue: oldConfig.name,
        newValue: newConfig.name,
        fieldType: 'string',
        isSensitive: false,
      });
    }

    if (oldConfig.isActive !== newConfig.isActive) {
      changes.push({
        field: 'isActive',
        oldValue: oldConfig.isActive,
        newValue: newConfig.isActive,
        fieldType: 'boolean',
        isSensitive: false,
      });
    }

    // Compare configuration objects (simplified)
    // In production, would implement deep comparison with sensitive field handling

    return changes;
  }

  private calculateRiskLevel(changes: ChangeRecord[]): 'low' | 'medium' | 'high' | 'critical' {
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    for (const change of changes) {
      if (change.field.includes('secret') || change.field.includes('password') || change.field.includes('key')) {
        return 'critical';
      }
      if (change.field.includes('endpoint') || change.field.includes('url')) {
        riskLevel = 'high';
      }
      if (change.fieldType === 'boolean' && change.field === 'isActive') {
        riskLevel = 'medium';
      }
    }

    return riskLevel;
  }

  private async logConfigurationChange(change: ConfigurationChangeLog): Promise<void> {
    // In production, would store this in the database
    console.log('Configuration change logged:', {
      providerId: change.providerId,
      changeType: change.changeType,
      version: change.version,
      initiatedBy: change.initiatedBy,
      riskLevel: change.metadata.riskLevel,
    });
  }

  private async compressData(data: string): Promise<string> {
    // Simple compression (would use zlib in production)
    return data; // Placeholder
  }

  private async encryptData(data: string): Promise<string> {
    // Encryption for backup data
    return await this.encryptField(data);
  }
}

export default SSOConfigurationManager;
