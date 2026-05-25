/**
 * OIDC Provider Unit Tests
 */

import { OIDCProvider } from '../OIDCProvider.js';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('OIDCProvider', () => {
  let oidcProvider: OIDCProvider;

  beforeEach(() => {
    oidcProvider = new OIDCProvider();
    jest.clearAllMocks();
  });

  describe('getAuthorizationUrl', () => {
    it('should generate authorization URL with PKCE', () => {
      const config = {
        clientId: 'test-client-id',
        authorizationUrl: 'https://auth.example.com/oauth2/authorize',
        scopes: ['openid', 'profile', 'email'],
      };

      const { url, codeVerifier, nonce } = oidcProvider.getAuthorizationUrl(config as any, 'test-state');

      expect(url).toContain('https://auth.example.com/oauth2/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=openid');
      expect(url).toContain('code_challenge=');
      expect(url).toContain('code_challenge_method=S256');
      expect(codeVerifier).toHaveLength(128);
      expect(nonce).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should throw error if authorizationUrl is missing', () => {
      const config = {
        clientId: 'test-client-id',
      };

      expect(() => oidcProvider.getAuthorizationUrl(config as any, 'state')).toThrow('authorizationUrl');
    });

    it('should throw error if clientId is missing', () => {
      const config = {
        authorizationUrl: 'https://auth.example.com/oauth2/authorize',
      };

      expect(() => oidcProvider.getAuthorizationUrl(config as any, 'state')).toThrow('clientId');
    });
  });

  describe('validateIdToken', () => {
    it('should throw error for invalid token format', () => {
      const config = {
        clientId: 'test-client-id',
      };

      expect(() => oidcProvider.validateIdToken('invalid.token', config as any, '')).toThrow();
    });

    it('should throw error if clientId is missing', () => {
      const config = {};

      expect(() => oidcProvider.validateIdToken('header.payload.signature', config as any, '')).toThrow('clientId');
    });
  });

  describe('generateCodeVerifier', () => {
    it('should generate valid PKCE code verifier', () => {
      // Call private method via reflection (for testing)
      const verifier1 = (oidcProvider as any).generateCodeVerifier();
      const verifier2 = (oidcProvider as any).generateCodeVerifier();

      expect(verifier1).toHaveLength(128);
      expect(verifier2).toHaveLength(128);
      expect(verifier1).not.toBe(verifier2);

      // Should only contain URL-safe characters
      expect(verifier1).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('generateCodeChallenge', () => {
    it('should generate S256 code challenge', () => {
      const verifier = (oidcProvider as any).generateCodeVerifier();
      const challenge = (oidcProvider as any).generateCodeChallenge(verifier);

      // Should be a valid base64url string
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(challenge.length).toBeGreaterThan(20);
    });

    it('should generate same challenge for same verifier', () => {
      const verifier = 'test-verifier-123456789-123456789-123456789-123456789-123456789-123456789-123456789-123456789-123456789-123456789-123456789-123456789';
      const challenge1 = (oidcProvider as any).generateCodeChallenge(verifier);
      const challenge2 = (oidcProvider as any).generateCodeChallenge(verifier);

      expect(challenge1).toBe(challenge2);
    });

    it('should generate different challenge for different verifiers', () => {
      const verifier1 = (oidcProvider as any).generateCodeVerifier();
      const verifier2 = (oidcProvider as any).generateCodeVerifier();

      const challenge1 = (oidcProvider as any).generateCodeChallenge(verifier1);
      const challenge2 = (oidcProvider as any).generateCodeChallenge(verifier2);

      expect(challenge1).not.toBe(challenge2);
    });
  });
});
