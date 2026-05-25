/**
 * SSO Provider Registry
 * Pre-configured provider templates for Azure AD, Okta, Google, and generic SAML/OIDC
 */

import { ProviderType, SSOConfig } from './types.js';

export interface ProviderTemplate {
  type: ProviderType;
  displayName: string;
  authMethod: 'saml' | 'oidc';
  discoveryUrl?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  defaultScopes?: string[];
  claimMappings?: Record<string, string>;
}

export class ProviderRegistry {
  private static templates: Map<ProviderType, ProviderTemplate> = new Map([
    [
      'azure_ad',
      {
        type: 'azure_ad',
        displayName: 'Azure Active Directory',
        authMethod: 'oidc',
        discoveryUrl: 'https://login.microsoftonline.com/common/.well-known/openid-configuration',
        authorizationUrl: 'https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token',
        userInfoUrl: 'https://graph.microsoft.com/oidc/userinfo',
        defaultScopes: ['openid', 'profile', 'email', 'offline_access'],
        claimMappings: {
          email: 'mail',
          firstName: 'given_name',
          lastName: 'family_name',
          groups: 'groups',
        },
      },
    ],
    [
      'okta',
      {
        type: 'okta',
        displayName: 'Okta',
        authMethod: 'oidc',
        discoveryUrl: 'https://{orgUrl}/.well-known/openid-configuration',
        authorizationUrl: 'https://{orgUrl}/oauth2/v1/authorize',
        tokenUrl: 'https://{orgUrl}/oauth2/v1/token',
        userInfoUrl: 'https://{orgUrl}/oauth2/v1/userinfo',
        defaultScopes: ['openid', 'profile', 'email', 'offline_access'],
        claimMappings: {
          email: 'email',
          firstName: 'given_name',
          lastName: 'family_name',
          groups: 'groups',
        },
      },
    ],
    [
      'google',
      {
        type: 'google',
        displayName: 'Google Workspace',
        authMethod: 'oidc',
        discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration',
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
        defaultScopes: ['openid', 'profile', 'email'],
        claimMappings: {
          email: 'email',
          firstName: 'given_name',
          lastName: 'family_name',
          picture: 'picture',
        },
      },
    ],
    [
      'saml_generic',
      {
        type: 'saml_generic',
        displayName: 'Generic SAML 2.0',
        authMethod: 'saml',
        claimMappings: {
          email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
          firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
          lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
          groups: 'groups',
        },
      },
    ],
    [
      'oidc_generic',
      {
        type: 'oidc_generic',
        displayName: 'Generic OpenID Connect',
        authMethod: 'oidc',
        defaultScopes: ['openid', 'profile', 'email'],
        claimMappings: {
          email: 'email',
          firstName: 'given_name',
          lastName: 'family_name',
        },
      },
    ],
  ]);

  /**
   * Get provider template
   */
  static getTemplate(type: ProviderType): ProviderTemplate {
    const template = this.templates.get(type);
    if (!template) {
      throw new Error(`Provider type "${type}" not found in registry`);
    }
    return template;
  }

  /**
   * List all available provider templates
   */
  static listTemplates(): ProviderTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Create config from provider template (handles variable substitution)
   */
  static createConfigFromTemplate(
    organizationId: string,
    type: ProviderType,
    overrides?: Partial<SSOConfig>
  ): SSOConfig {
    const template = this.getTemplate(type);

    const config: SSOConfig = {
      organizationId,
      providerType: type,
      enabled: true,
      authorizationUrl: template.authorizationUrl,
      tokenUrl: template.tokenUrl,
      userInfoUrl: template.userInfoUrl,
      scopes: template.defaultScopes,
      emailClaim: 'email',
      nameClaim: 'name',
      groupsClaim: 'groups',
      autoProvision: true,
      autoAssignRole: 'user',
      ...overrides,
    };

    return config;
  }

  /**
   * Resolve template URLs with variables (e.g., {tenantId}, {orgUrl})
   */
  static resolveTemplateUrl(
    url: string | undefined,
    variables: Record<string, string>
  ): string | undefined {
    if (!url) return undefined;

    let resolved = url;
    for (const [key, value] of Object.entries(variables)) {
      resolved = resolved.replace(`{${key}}`, value);
    }
    return resolved;
  }

  /**
   * Validate required fields for a provider type
   */
  static validateConfig(config: SSOConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.organizationId) {
      errors.push('organizationId is required');
    }

    switch (config.providerType) {
      case 'azure_ad':
      case 'okta':
      case 'google':
      case 'oidc_generic':
        if (!config.clientId) errors.push('clientId is required for OIDC provider');
        if (!config.clientSecret) errors.push('clientSecret is required for OIDC provider');
        if (!config.tokenUrl) errors.push('tokenUrl is required for OIDC provider');
        if (!config.userInfoUrl) errors.push('userInfoUrl is required for OIDC provider');
        break;

      case 'saml_generic':
        if (!config.entryPoint) errors.push('entryPoint is required for SAML provider');
        if (!config.issuer) errors.push('issuer is required for SAML provider');
        if (!config.cert) errors.push('cert is required for SAML provider');
        break;
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get required fields for a provider type
   */
  static getRequiredFields(type: ProviderType): string[] {
    const baseFields = ['organizationId'];

    switch (type) {
      case 'azure_ad':
      case 'okta':
      case 'google':
      case 'oidc_generic':
        return [...baseFields, 'clientId', 'clientSecret', 'tokenUrl', 'userInfoUrl'];

      case 'saml_generic':
        return [...baseFields, 'entryPoint', 'issuer', 'cert'];

      default:
        return baseFields;
    }
  }
}
