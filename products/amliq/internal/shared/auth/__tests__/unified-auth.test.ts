import { UnifiedAuthService, sharedAuthConfig } from '../unified-auth';

describe('UnifiedAuthService', () => {
  const secretKey = 'test-secret-key-for-unit-tests';
  let authService: UnifiedAuthService;

  beforeEach(() => {
    authService = new UnifiedAuthService({ secretKey });
  });

  describe('constructor', () => {
    it('uses default issuer and audience', () => {
      const token = authService.generateToken({
        user_id: 'u1', email: 'test@test.com', role: 'admin', sub: 'u1',
      });
      const claims = authService.verifyToken(token);
      expect(claims?.iss).toBe('finsavvy-shield');
      expect(claims?.aud).toBe('finsavvy-api');
    });

    it('uses custom issuer and audience', () => {
      const custom = new UnifiedAuthService({
        secretKey, issuer: 'custom-issuer', audience: 'custom-audience',
      });
      const token = custom.generateToken({
        user_id: 'u1', email: 'test@test.com', role: 'admin', sub: 'u1',
      });
      const claims = custom.verifyToken(token);
      expect(claims?.iss).toBe('custom-issuer');
      expect(claims?.aud).toBe('custom-audience');
    });
  });

  describe('generateToken', () => {
    it('returns a JWT with three dot-separated parts', () => {
      const token = authService.generateToken({
        user_id: 'u1', email: 'test@test.com', role: 'developer', sub: 'u1',
      });
      const parts = token.split('.');
      expect(parts.length).toBe(3);
      parts.forEach((p) => expect(p.length).toBeGreaterThan(0));
    });

    it('sets iat to current time', () => {
      const before = Math.floor(Date.now() / 1000);
      const token = authService.generateToken({
        user_id: 'u1', email: 'test@test.com', role: 'admin', sub: 'u1',
      });
      const after = Math.floor(Date.now() / 1000);
      const claims = authService.verifyToken(token);
      expect(claims?.iat).toBeGreaterThanOrEqual(before);
      expect(claims?.iat).toBeLessThanOrEqual(after);
    });

    it('sets exp based on expiresInSeconds', () => {
      const before = Math.floor(Date.now() / 1000);
      const token = authService.generateToken({
        user_id: 'u1', email: 'test@test.com', role: 'admin', sub: 'u1',
      }, 7200);
      const claims = authService.verifyToken(token);
      expect(claims?.exp).toBeGreaterThanOrEqual(before + 7200);
    });

    it('defaults expiry to 3600 seconds', () => {
      const before = Math.floor(Date.now() / 1000);
      const token = authService.generateToken({
        user_id: 'u1', email: 'test@test.com', role: 'admin', sub: 'u1',
      });
      const claims = authService.verifyToken(token);
      expect(claims?.exp).toBeGreaterThanOrEqual(before + 3600);
    });

    it('includes subscription tier in claims', () => {
      const token = authService.generateToken({
        user_id: 'u1', email: 'test@test.com', role: 'admin',
        subscription_tier: 'enterprise', sub: 'u1',
      });
      expect(authService.verifyToken(token)?.subscription_tier).toBe('enterprise');
    });

    it('sets sub to user_id', () => {
      const token = authService.generateToken({
        user_id: 'user-123', email: 'test@test.com', role: 'admin', sub: 'user-123',
      });
      expect(authService.verifyToken(token)?.sub).toBe('user-123');
    });
  });

  describe('verifyToken', () => {
    it('verifies a valid token', () => {
      const token = authService.generateToken({
        user_id: 'u1', email: 'alice@test.com', role: 'developer', sub: 'u1',
      });
      const claims = authService.verifyToken(token);
      expect(claims).not.toBeNull();
      expect(claims?.user_id).toBe('u1');
      expect(claims?.email).toBe('alice@test.com');
      expect(claims?.role).toBe('developer');
    });

    it('returns null for malformed token', () => {
      expect(authService.verifyToken('not.a.valid-token')).toBeNull();
    });

    it('returns null for token with wrong number of parts', () => {
      expect(authService.verifyToken('only-one-part')).toBeNull();
      expect(authService.verifyToken('two.parts')).toBeNull();
      expect(authService.verifyToken('a.b.c.d')).toBeNull();
    });

    it('returns null for token signed with different secret', () => {
      const other = new UnifiedAuthService({ secretKey: 'different-key' });
      const token = other.generateToken({
        user_id: 'u1', email: 'test@test.com', role: 'admin', sub: 'u1',
      });
      expect(authService.verifyToken(token)).toBeNull();
    });

    it('returns null for expired token', () => {
      const token = authService.generateToken({
        user_id: 'u1', email: 'test@test.com', role: 'admin', sub: 'u1',
      }, -10);
      expect(authService.verifyToken(token)).toBeNull();
    });
  });

  describe('generateAPIKey', () => {
    it('generates key with fs_test prefix for non-enterprise', () => {
      expect(authService.generateAPIKey('u1', 'free').key).toMatch(/^fs_test_/);
    });

    it('generates key with fs_live prefix for enterprise', () => {
      expect(authService.generateAPIKey('u1', 'enterprise').key).toMatch(/^fs_live_/);
    });

    it('returns keyData with correct user_id', () => {
      const { keyData } = authService.generateAPIKey('user-42', 'startup');
      expect(keyData.user_id).toBe('user-42');
      expect(keyData.tier).toBe('startup');
      expect(keyData.is_active).toBe(true);
    });

    it('sets rate limit based on tier', () => {
      expect(authService.generateAPIKey('u1', 'free').keyData.rate_limit).toBe(100);
      expect(authService.generateAPIKey('u1', 'startup').keyData.rate_limit).toBe(1000);
      expect(authService.generateAPIKey('u1', 'growth').keyData.rate_limit).toBe(5000);
      expect(authService.generateAPIKey('u1', 'enterprise').keyData.rate_limit).toBe(50000);
    });

    it('generates unique keys on repeated calls', () => {
      const k1 = authService.generateAPIKey('u1', 'free');
      const k2 = authService.generateAPIKey('u1', 'free');
      expect(k1.key).not.toBe(k2.key);
      expect(k1.keyData.key_id).not.toBe(k2.keyData.key_id);
    });
  });

  describe('hashAPIKey', () => {
    it('returns a hex string', () => {
      expect(authService.hashAPIKey('fs_test_abc123')).toMatch(/^[0-9a-f]+$/);
    });

    it('returns consistent hash for same input', () => {
      const h1 = authService.hashAPIKey('fs_test_key');
      expect(authService.hashAPIKey('fs_test_key')).toBe(h1);
    });

    it('returns different hash for different input', () => {
      expect(authService.hashAPIKey('key_a')).not.toBe(authService.hashAPIKey('key_b'));
    });
  });
});

describe('sharedAuthConfig', () => {
  it('has expected default values', () => {
    expect(sharedAuthConfig.issuer).toBe('finsavvy-shield');
    expect(sharedAuthConfig.audience).toBe('finsavvy-api');
    expect(sharedAuthConfig.accessTokenTTL).toBe(3600);
    expect(sharedAuthConfig.refreshTokenTTL).toBe(604800);
  });
});
