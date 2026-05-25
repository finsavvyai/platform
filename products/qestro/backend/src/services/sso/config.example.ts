/**
 * SSO Configuration Examples
 * Example configurations for different SSO providers
 */

import { SSOConfig } from './types.js';

/**
 * Azure Active Directory Configuration Example
 *
 * Required setup:
 * 1. Create application in Azure AD
 * 2. Configure redirect URI: https://app.example.com/api/sso/callback/oidc
 * 3. Create client secret
 * 4. Configure API permissions
 */
export const azureAdConfig: SSOConfig = {
  organizationId: 'org-123',
  providerType: 'azure_ad',
  enabled: true,
  clientId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  clientSecret: 'your-client-secret',
  authorizationUrl: 'https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/authorize',
  tokenUrl: 'https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token',
  userInfoUrl: 'https://graph.microsoft.com/oidc/userinfo',
  scopes: ['openid', 'profile', 'email', 'offline_access'],
  emailClaim: 'email',
  nameClaim: 'name',
  groupsClaim: 'groups',
  groupMappings: {
    'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx': 'admin', // Azure AD group ID -> Qestro role
    'yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy': 'user',
  },
  autoProvision: true,
  autoAssignRole: 'user',
};

/**
 * Okta Configuration Example
 *
 * Required setup:
 * 1. Create OIDC application in Okta
 * 2. Configure redirect URI: https://app.example.com/api/sso/callback/oidc
 * 3. Note your Okta organization URL
 * 4. Create OAuth token if needed
 */
export const oktaConfig: SSOConfig = {
  organizationId: 'org-456',
  providerType: 'okta',
  enabled: true,
  clientId: 'your-okta-client-id',
  clientSecret: 'your-okta-client-secret',
  authorizationUrl: 'https://acme.okta.com/oauth2/v1/authorize',
  tokenUrl: 'https://acme.okta.com/oauth2/v1/token',
  userInfoUrl: 'https://acme.okta.com/oauth2/v1/userinfo',
  scopes: ['openid', 'profile', 'email', 'offline_access'],
  emailClaim: 'email',
  nameClaim: 'name',
  groupsClaim: 'groups',
  groupMappings: {
    'admin-group': 'admin',
    'developer-group': 'user',
    'qa-group': 'user',
  },
  autoProvision: true,
  autoAssignRole: 'user',
};

/**
 * Google Workspace Configuration Example
 *
 * Required setup:
 * 1. Create OAuth 2.0 Client ID in Google Cloud Console
 * 2. Configure redirect URI: https://app.example.com/api/sso/callback/oidc
 * 3. Download credentials JSON
 */
export const googleWorkspaceConfig: SSOConfig = {
  organizationId: 'org-789',
  providerType: 'google',
  enabled: true,
  clientId: 'your-google-client-id.apps.googleusercontent.com',
  clientSecret: 'your-google-client-secret',
  authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
  scopes: ['openid', 'profile', 'email'],
  emailClaim: 'email',
  nameClaim: 'name',
  groupsClaim: 'groups',
  autoProvision: true,
  autoAssignRole: 'user',
};

/**
 * Generic SAML 2.0 Configuration Example
 *
 * Required setup:
 * 1. Obtain IdP certificate from your SAML provider
 * 2. Configure Assertion Consumer Service URL: https://app.example.com/api/sso/callback/saml
 * 3. Configure entity ID/issuer
 */
export const samlGenericConfig: SSOConfig = {
  organizationId: 'org-saml',
  providerType: 'saml_generic',
  enabled: true,
  entryPoint: 'https://idp.example.com/sso',
  issuer: 'https://qestro.example.com',
  cert: `-----BEGIN CERTIFICATE-----
MIIC4jCCAcoCCQC33AxjlsDdLjANBgkqhkiG9w0BAQsFADAyMQswCQYDVQQGEwJV
UzELMAkGA1UECAwCTUExEjAQBgNVBAcMCUJvc3RvbiXNBQYDVQQKDAhF
eGFtcGxlIENvLjAeFw0yNDA0MDEwODAwMDBaFw0yNTA0MDEwODAwMDBaMDIx
CzAJBgNVBAYTAlVTMQswCQYDVQQIDAJNQTESMBAGA1UEBwwJQm9zdG9uIE1B
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1Z7...
-----END CERTIFICATE-----`,
  identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
  emailClaim: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
  nameClaim: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
  groupsClaim: 'memberOf',
  groupMappings: {
    'CN=Admins,DC=example,DC=com': 'admin',
    'CN=Users,DC=example,DC=com': 'user',
  },
  autoProvision: true,
  autoAssignRole: 'user',
};

/**
 * Generic OpenID Connect Configuration Example
 *
 * Required setup:
 * 1. Register application with OIDC provider
 * 2. Obtain client credentials
 * 3. Configure redirect URL: https://app.example.com/api/sso/callback/oidc
 */
export const oidcGenericConfig: SSOConfig = {
  organizationId: 'org-oidc',
  providerType: 'oidc_generic',
  enabled: true,
  clientId: 'your-oidc-client-id',
  clientSecret: 'your-oidc-client-secret',
  authorizationUrl: 'https://auth.custom-provider.com/oauth2/authorize',
  tokenUrl: 'https://auth.custom-provider.com/oauth2/token',
  userInfoUrl: 'https://api.custom-provider.com/userinfo',
  scopes: ['openid', 'profile', 'email'],
  emailClaim: 'email',
  nameClaim: 'name',
  groupsClaim: 'groups',
  autoProvision: true,
  autoAssignRole: 'user',
};

/**
 * Advanced Configuration: Group-to-Role Mapping
 *
 * This example shows how to map different groups to different roles
 * and handle authorization at provisioning time
 */
export const advancedGroupMappingConfig: SSOConfig = {
  organizationId: 'org-advanced',
  providerType: 'azure_ad',
  enabled: true,
  clientId: 'client-id',
  clientSecret: 'client-secret',
  tokenUrl: 'https://login.microsoftonline.com/tenant-id/oauth2/v2.0/token',
  userInfoUrl: 'https://graph.microsoft.com/oidc/userinfo',
  scopes: ['openid', 'profile', 'email', 'offline_access'],
  emailClaim: 'email',
  nameClaim: 'name',
  groupsClaim: 'groups',
  groupMappings: {
    // Map Azure AD group IDs to Qestro roles
    'enterprise-admin-group-id': 'admin',
    'team-lead-group-id': 'admin',
    'developer-group-id': 'user',
    'qa-group-id': 'user',
    'viewer-group-id': 'user',
  },
  // Override auto-assigned role with group mapping
  autoProvision: true,
  autoAssignRole: 'user', // Default if no group matches
};

/**
 * Minimal Configuration: Just Email
 *
 * Simplest possible setup for OIDC provider
 * No group mapping, just auto-provision with default role
 */
export const minimalConfig: SSOConfig = {
  organizationId: 'org-minimal',
  providerType: 'oidc_generic',
  enabled: true,
  clientId: 'client-id',
  clientSecret: 'client-secret',
  authorizationUrl: 'https://auth.example.com/oauth2/authorize',
  tokenUrl: 'https://auth.example.com/oauth2/token',
  userInfoUrl: 'https://auth.example.com/oauth2/userinfo',
  scopes: ['openid', 'email'],
  autoProvision: true,
  autoAssignRole: 'user',
};

/**
 * Enterprise Configuration: No Auto-Provisioning
 *
 * For enterprises that want to control user creation
 * Users must be manually added before SSO login
 */
export const enterpriseConfig: SSOConfig = {
  organizationId: 'org-enterprise',
  providerType: 'okta',
  enabled: true,
  clientId: 'client-id',
  clientSecret: 'client-secret',
  tokenUrl: 'https://enterprise.okta.com/oauth2/v1/token',
  userInfoUrl: 'https://enterprise.okta.com/oauth2/v1/userinfo',
  authorizationUrl: 'https://enterprise.okta.com/oauth2/v1/authorize',
  scopes: ['openid', 'profile', 'email', 'offline_access'],
  emailClaim: 'email',
  nameClaim: 'name',
  groupsClaim: 'groups',
  groupMappings: {
    'admin-team': 'admin',
    'engineering-team': 'user',
  },
  // Disable auto-provisioning
  autoProvision: false,
  autoAssignRole: 'user',
};
