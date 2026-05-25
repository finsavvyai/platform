/**
 * SAML Provider Unit Tests
 */

import { SAMLProvider } from '../SAMLProvider.js';
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('SAMLProvider', () => {
  let samlProvider: SAMLProvider;

  beforeEach(() => {
    samlProvider = new SAMLProvider();
  });

  describe('generateAuthRequest', () => {
    it('should generate valid SAML AuthnRequest', () => {
      const config = {
        entryPoint: 'https://idp.example.com/sso',
        issuer: 'https://qestro.example.com',
      };

      const { url, requestId } = samlProvider.generateAuthRequest(config);

      expect(url).toContain('https://idp.example.com/sso');
      expect(url).toContain('SAMLRequest=');
      expect(requestId).toMatch(/^_[a-f0-9]{32}$/);
    });

    it('should throw error if entryPoint is missing', () => {
      const config = {
        issuer: 'https://qestro.example.com',
      };

      expect(() => samlProvider.generateAuthRequest(config as any)).toThrow('entryPoint');
    });

    it('should throw error if issuer is missing', () => {
      const config = {
        entryPoint: 'https://idp.example.com/sso',
      };

      expect(() => samlProvider.generateAuthRequest(config as any)).toThrow('issuer');
    });

    it('should encode request correctly', () => {
      const config = {
        entryPoint: 'https://idp.example.com/sso',
        issuer: 'https://qestro.example.com',
      };

      const { url } = samlProvider.generateAuthRequest(config);
      const params = new URL(url).searchParams;
      const encodedRequest = params.get('SAMLRequest');

      expect(encodedRequest).toBeDefined();

      // Decode and verify it contains expected XML elements
      const decoded = Buffer.from(encodedRequest!, 'base64').toString('utf-8');
      expect(decoded).toContain('samlp:AuthnRequest');
      expect(decoded).toContain('https://qestro.example.com');
    });
  });

  describe('validateAssertion', () => {
    it('should throw error if cert is missing', async () => {
      const config = {
        issuer: 'https://idp.example.com',
      };

      await expect(samlProvider.validateAssertion('invalid_response', config as any)).rejects.toThrow('certificate');
    });

    it('should throw error for invalid base64', async () => {
      const config = {
        issuer: 'https://idp.example.com',
        cert: 'test-cert',
      };

      await expect(samlProvider.validateAssertion('!!!invalid!!!', config as any)).rejects.toThrow();
    });

    it('should throw error for missing Response element', async () => {
      const invalidXml = Buffer.from('<xml></xml>').toString('base64');
      const config = {
        issuer: 'https://idp.example.com',
        cert: 'test-cert',
      };

      await expect(samlProvider.validateAssertion(invalidXml, config as any)).rejects.toThrow('Response element');
    });
  });

  describe('extractUserAttributes', () => {
    it('should extract user attributes from assertion', () => {
      const assertion = {
        nameID: 'user@example.com',
        authenticated: true,
        attributes: {
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'user@example.com',
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname': 'John',
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname': 'Doe',
          'groups': ['admin', 'developers'],
        },
      };

      const profile = samlProvider.extractUserAttributes(assertion as any);

      expect(profile.id).toBe('user@example.com');
      expect(profile.email).toBe('user@example.com');
      expect(profile.firstName).toBe('John');
      expect(profile.lastName).toBe('Doe');
      expect(profile.groups).toContain('admin');
      expect(profile.groups).toContain('developers');
    });

    it('should throw error if email not found', () => {
      const assertion = {
        nameID: 'user123',
        authenticated: true,
        attributes: {
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname': 'John',
        },
      };

      expect(() => samlProvider.extractUserAttributes(assertion as any)).toThrow('Email or NameID');
    });

    it('should handle alternative attribute names', () => {
      const assertion = {
        nameID: 'user@example.com',
        authenticated: true,
        attributes: {
          'mail': 'user@example.com',
          'name': 'John Doe',
        },
      };

      const profile = samlProvider.extractUserAttributes(assertion as any);

      expect(profile.email).toBe('user@example.com');
      expect(profile.name).toBe('John Doe');
    });
  });
});
