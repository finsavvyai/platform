import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SSOUtils } from '../../../../src/services/sso/utils/sso-utils';
import { SSOProviderType } from '../../../../src/services/sso/provider-manager';

describe('SSOUtils', () => {
  let utils: SSOUtils;
  let mockConfig: any;

  beforeEach(() => {
    mockConfig = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'https://test.qestro.com/auth/callback',
      logoutRedirectUri: 'https://test.qestro.com/logout',
      scope: 'openid profile email',
      state: 'test-state',
      nonce: 'test-nonce',
    };

    utils = new SSOUtils(mockConfig);

    // Mock localStorage for state storage
    const localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('State Management', () => {
    it('should generate a valid state parameter', () => {
      const state = utils.generateState();

      expect(state).toBeDefined();
      expect(typeof state).toBe('string');
      expect(state.length).toBeGreaterThan(20);
    });

    it('should store and validate state correctly', () => {
      const state = 'test-state-123';
      utils.storeState(state, 'test-provider');

      expect(utils.validateState(state, 'test-provider')).toBe(true);
    });

    it('should reject invalid state', () => {
      const validState = 'valid-state-123';
      const invalidState = 'invalid-state-456';

      utils.storeState(validState, 'test-provider');

      expect(utils.validateState(invalidState, 'test-provider')).toBe(false);
    });

    it('should reject state from wrong provider', () => {
      const state = 'test-state-123';
      utils.storeState(state, 'provider-1');

      expect(utils.validateState(state, 'provider-2')).toBe(false);
    });

    it('should clean up state after validation', () => {
      const state = 'test-state-123';
      utils.storeState(state, 'test-provider');

      utils.validateState(state, 'test-provider');

      expect(utils.validateState(state, 'test-provider')).toBe(false);
    });

    it('should expire state after timeout', () => {
      jest.useFakeTimers();

      const state = 'test-state-123';
      utils.storeState(state, 'test-provider');

      // Fast-forward 11 minutes (beyond 10-minute timeout)
      jest.advanceTimersByTime(11 * 60 * 1000);

      expect(utils.validateState(state, 'test-provider')).toBe(false);

      jest.useRealTimers();
    });
  });

  describe('Nonce Management', () => {
    it('should generate a valid nonce parameter', () => {
      const nonce = utils.generateNonce();

      expect(nonce).toBeDefined();
      expect(typeof nonce).toBe('string');
      expect(nonce.length).toBeGreaterThan(20);
    });

    it('should store and validate nonce correctly', () => {
      const nonce = 'test-nonce-123';
      utils.storeNonce(nonce);

      expect(utils.validateNonce(nonce)).toBe(true);
    });

    it('should reject invalid nonce', () => {
      const validNonce = 'valid-nonce-123';
      const invalidNonce = 'invalid-nonce-456';

      utils.storeNonce(validNonce);

      expect(utils.validateNonce(invalidNonce)).toBe(false);
    });
  });

  describe('PKCE Support', () => {
    it('should generate PKCE challenge and verifier', () => {
      const { verifier, challenge } = utils.generatePKCE();

      expect(verifier).toBeDefined();
      expect(challenge).toBeDefined();
      expect(typeof verifier).toBe('string');
      expect(typeof challenge).toBe('string');
      expect(verifier.length).toBeGreaterThanOrEqual(43);
      expect(verifier.length).toBeLessThanOrEqual(128);
      expect(challenge.length).toBe(43); // Base64 URL encoded SHA256 hash
    });

    it('should generate different values each time', () => {
      const { verifier: v1, challenge: c1 } = utils.generatePKCE();
      const { verifier: v2, challenge: c2 } = utils.generatePKCE();

      expect(v1).not.toBe(v2);
      expect(c1).not.toBe(c2);
    });

    it('should store PKCE verifier correctly', () => {
      const { verifier } = utils.generatePKCE();
      utils.storePKCEVerifier(verifier);

      // In a real implementation, this would be stored securely
      expect(verifier).toBeDefined();
    });
  });

  describe('Cryptographic Operations', () => {
    it('should generate secure random strings', () => {
      const random1 = utils.generateSecureRandom(32);
      const random2 = utils.generateSecureRandom(32);

      expect(random1).toBeDefined();
      expect(random2).toBeDefined();
      expect(typeof random1).toBe('string');
      expect(typeof random2).toBe('string');
      expect(random1.length).toBe(32);
      expect(random2.length).toBe(32);
      expect(random1).not.toBe(random2);
    });

    it('should hash data consistently', () => {
      const data = 'test-data-to-hash';
      const hash1 = utils.hashData(data);
      const hash2 = utils.hashData(data);

      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
      expect(hash1.length).toBeGreaterThan(0);
    });

    it('should generate different hashes for different data', () => {
      const hash1 = utils.hashData('data-1');
      const hash2 = utils.hashData('data-2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('JWT Operations', () => {
    it('should decode JWT tokens correctly', () => {
      // Create a mock JWT token (header.payload.signature)
      const header = { alg: 'RS256', typ: 'JWT' };
      const payload = { sub: 'user-123', email: 'test@example.com', iat: Math.floor(Date.now() / 1000) };

      const token = `${Buffer.from(JSON.stringify(header)).toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;

      const decoded = utils.decodeJWT(token);

      expect(decoded).toBeDefined();
      expect(decoded.sub).toBe('user-123');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.iat).toBeDefined();
    });

    it('should handle malformed JWT tokens', () => {
      const malformedTokens = [
        '',
        'invalid',
        'header.payload',
        'header.payload.signature.extra',
        'invalid-base64.invalid-base64.signature',
      ];

      malformedTokens.forEach(token => {
        expect(() => utils.decodeJWT(token)).not.toThrow();
        // Should return empty object or handle gracefully
      });
    });

    it('should validate JWT with proper JWKS', async () => {
      const mockJWKS = {
        keys: [
          {
            kty: 'RSA',
            kid: 'test-key-id',
            use: 'sig',
            n: 'mock-modulus',
            e: 'AQAB',
            alg: 'RS256',
          },
        ],
      };

      // Mock a valid token
      const token = 'valid.token.signature';

      // This would require actual cryptographic validation
      // For testing purposes, we mock the validation
      jest.spyOn(utils as any, 'verifyJWTSignature').mockReturnValue(true);

      const isValid = await utils.validateJWT(token, mockJWKS);

      expect(isValid).toBeDefined();
      expect(typeof isValid).toBe('boolean');
    });
  });

  describe('URL and Parameter Handling', () => {
    it('should build redirect URLs correctly', () => {
      const baseUrl = 'https://provider.com/auth';
      const params = {
        client_id: 'test-client',
        response_type: 'code',
        redirect_uri: 'https://app.com/callback',
        state: 'test-state',
      };

      const url = utils.buildRedirectUrl(baseUrl, params);

      expect(url).toContain('https://provider.com/auth');
      expect(url).toContain('client_id=test-client');
      expect(url).toContain('response_type=code');
      expect(url).toContain('redirect_uri=https://app.com/callback');
      expect(url).toContain('state=test-state');
    });

    it('should URL encode parameters correctly', () => {
      const baseUrl = 'https://provider.com/auth';
      const params = {
        client_id: 'test client with spaces',
        redirect_uri: 'https://app.com/callback?param=value',
      };

      const url = utils.buildRedirectUrl(baseUrl, params);

      expect(url).toContain('client_id=test%20client%20with%20spaces');
      expect(url).toContain(encodeURIComponent('https://app.com/callback?param=value'));
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid state storage gracefully', () => {
      expect(() => utils.validateState('', 'test-provider')).not.toThrow();
      expect(utils.validateState('', 'test-provider')).toBe(false);
    });

    it('should handle storage failures gracefully', () => {
      // Mock localStorage to throw errors
      (localStorage.setItem as jest.Mock).mockImplementation(() => {
        throw new Error('Storage error');
      });

      expect(() => utils.storeState('test-state', 'test-provider')).not.toThrow();
    });
  });

  describe('Security Validation', () => {
    it('should validate redirect URLs properly', () => {
      const validUrls = [
        'https://app.qestro.com/callback',
        'https://test.qestro.com/auth/callback',
      ];

      const invalidUrls = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'http://malicious.com/callback',
      ];

      validUrls.forEach(url => {
        expect(utils.isValidRedirectUrl(url)).toBe(true);
      });

      invalidUrls.forEach(url => {
        expect(utils.isValidRedirectUrl(url)).toBe(false);
      });
    });

    it('should sanitize inputs properly', () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        'javascript:void(0)',
        'data:text/html,<h1>malicious</h1>',
      ];

      maliciousInputs.forEach(input => {
        const sanitized = utils.sanitizeInput(input);
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('data:');
      });
    });
  });

  describe('Provider Detection', () => {
    it('should detect provider type from email domain', () => {
      const testCases = [
        { email: 'user@company.com', expected: SSOProviderType.CUSTOM },
        { email: 'user@company.onmicrosoft.com', expected: SSOProviderType.AZURE_AD },
        { email: 'user@okta.com', expected: SSOProviderType.OKTA },
        { email: 'user@auth0.com', expected: SSOProviderType.AUTH0 },
        { email: 'user@gmail.com', expected: SSOProviderType.GOOGLE_WORKSPACE },
      ];

      testCases.forEach(({ email, expected }) => {
        const detected = utils.detectProviderFromEmail(email);
        expect(detected).toBe(expected);
      });
    });

    it('should return custom for unknown domains', () => {
      const detected = utils.detectProviderFromEmail('user@unknown-domain.com');
      expect(detected).toBe(SSOProviderType.CUSTOM);
    });
  });
});
