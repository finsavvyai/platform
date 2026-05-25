/**
 * Provider Registry Unit Tests
 */

import { ProviderRegistry } from '../ProviderRegistry.js';
import { describe, it, expect } from '@jest/globals';

describe('ProviderRegistry', () => {
  describe('getTemplate', () => {
    it('should return Azure AD template', () => {
      const template = ProviderRegistry.getTemplate('azure_ad');

      expect(template.type).toBe('azure_ad');
      expect(template.displayName).toBe('Azure Active Directory');
      expect(template.authMethod).toBe('oidc');
      expect(template.authorizationUrl).toContain('login.microsoftonline.com');
      expect(template.defaultScopes).toContain('openid');
    });

    it('should return Okta template', () => {
      const template = ProviderRegistry.getTemplate('okta');

      expect(template.type).toBe('okta');
      expect(template.displayName).toBe('Okta');
      expect(template.authMethod).toBe('oidc');
      expect(template.discoveryUrl).toContain('{orgUrl}');
    });

    it('should return Google template', () => {
      const template = ProviderRegistry.getTemplate('google');

      expect(template.type).toBe('google');
      expect(template.displayName).toBe('Google Workspace');
      expect(template.authMethod).toBe('oidc');
    });

    it('should return generic SAML template', () => {
      const template = ProviderRegistry.getTemplate('saml_generic');

      expect(template.type).toBe('saml_generic');
      expect(template.displayName).toBe('Generic SAML 2.0');
      expect(template.authMethod).toBe('saml');
    });

    it('should return generic OIDC template', () => {
      const template = ProviderRegistry.getTemplate('oidc_generic');

      expect(template.type).toBe('oidc_generic');
      expect(template.displayName).toBe('Generic OpenID Connect');
      expect(template.authMethod).toBe('oidc');
    });

    it('should throw error for unknown provider', () => {
      expect(() => ProviderRegistry.getTemplate('unknown' as any)).toThrow('not found');
    });
  });

  describe('listTemplates', () => {
    it('should return all provider templates', () => {
      const templates = ProviderRegistry.listTemplates();

      expect(templates.length).toBe(5);
      expect(templates.map((t) => t.type)).toEqual([
        'azure_ad',
        'okta',
        'google',
        'saml_generic',
        'oidc_generic',
      ]);
    });
  });

  describe('validateConfig', () => {
    it('should validate Azure AD config', () => {
      const config = {
        organizationId: 'org-123',
        providerType: 'azure_ad' as const,
        clientId: 'client-id',
        clientSecret: 'client-secret',
        tokenUrl: 'https://login.microsoftonline.com/tenant/oauth2/v2.0/token',
        userInfoUrl: 'https://graph.microsoft.com/oidc/userinfo',
      };

      const result = ProviderRegistry.validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for Azure AD without clientSecret', () => {
      const config = {
        organizationId: 'org-123',
        providerType: 'azure_ad' as const,
        clientId: 'client-id',
        tokenUrl: 'https://login.microsoftonline.com/tenant/oauth2/v2.0/token',
        userInfoUrl: 'https://graph.microsoft.com/oidc/userinfo',
      };

      const result = ProviderRegistry.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('clientSecret'));
    });

    it('should validate SAML config', () => {
      const config = {
        organizationId: 'org-123',
        providerType: 'saml_generic' as const,
        entryPoint: 'https://idp.example.com/sso',
        issuer: 'https://qestro.example.com',
        cert: 'cert-content',
      };

      const result = ProviderRegistry.validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for SAML without cert', () => {
      const config = {
        organizationId: 'org-123',
        providerType: 'saml_generic' as const,
        entryPoint: 'https://idp.example.com/sso',
        issuer: 'https://qestro.example.com',
      };

      const result = ProviderRegistry.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('cert'));
    });
  });

  describe('getRequiredFields', () => {
    it('should return required fields for OIDC provider', () => {
      const fields = ProviderRegistry.getRequiredFields('azure_ad');

      expect(fields).toContain('organizationId');
      expect(fields).toContain('clientId');
      expect(fields).toContain('clientSecret');
      expect(fields).toContain('tokenUrl');
      expect(fields).toContain('userInfoUrl');
    });

    it('should return required fields for SAML provider', () => {
      const fields = ProviderRegistry.getRequiredFields('saml_generic');

      expect(fields).toContain('organizationId');
      expect(fields).toContain('entryPoint');
      expect(fields).toContain('issuer');
      expect(fields).toContain('cert');
    });
  });

  describe('resolveTemplateUrl', () => {
    it('should resolve template variables in URL', () => {
      const url = 'https://{orgUrl}/oauth2/v1/authorize';
      const variables = { orgUrl: 'acme.okta.com' };

      const resolved = ProviderRegistry.resolveTemplateUrl(url, variables);

      expect(resolved).toBe('https://acme.okta.com/oauth2/v1/authorize');
    });

    it('should handle multiple variables', () => {
      const url = 'https://{domain}/oauth2/{version}/authorize';
      const variables = { domain: 'example.com', version: 'v2.0' };

      const resolved = ProviderRegistry.resolveTemplateUrl(url, variables);

      expect(resolved).toBe('https://example.com/oauth2/v2.0/authorize');
    });

    it('should return undefined if URL is undefined', () => {
      const resolved = ProviderRegistry.resolveTemplateUrl(undefined, {});

      expect(resolved).toBeUndefined();
    });

    it('should ignore unused variables', () => {
      const url = 'https://{domain}/api';
      const variables = { domain: 'example.com', unused: 'value' };

      const resolved = ProviderRegistry.resolveTemplateUrl(url, variables);

      expect(resolved).toBe('https://example.com/api');
    });
  });
});
