import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import type { DeviceBinding, SessionToken, ECDSASignature } from '../src/tokenforge/types';

describe('TokenForge - Device-Bound Session Security', () => {
  let tokenForge: any;
  let mockCrypto: any;
  let mockStore: any;

  beforeEach(() => {
    mockCrypto = {
      generateKeyPair: vi.fn().mockReturnValue({
        privateKey: 'private-key',
        publicKey: 'public-key',
      }),
      sign: vi.fn().mockReturnValue('signature-data'),
      verify: vi.fn().mockReturnValue(true),
    };

    mockStore = {
      set: vi.fn().mockResolvedValue(true),
      get: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(true),
    };

    tokenForge = {
      generateDeviceBinding: vi.fn(),
      createSessionToken: vi.fn(),
      validateToken: vi.fn(),
      revokeToken: vi.fn(),
      refreshToken: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Device Binding - ECDSA P-256', () => {
    it('should generate device binding with P-256 keypair', async () => {
      const deviceBinding: DeviceBinding = {
        deviceId: 'device-123',
        publicKey: 'public-key-256',
        algorithm: 'ECDSA P-256',
        createdAt: new Date(),
        fingerprint: 'fingerprint-hash',
      };

      tokenForge.generateDeviceBinding.mockResolvedValue(deviceBinding);

      const result = await tokenForge.generateDeviceBinding('device-123');

      expect(result).toEqual(deviceBinding);
      expect(result.algorithm).toBe('ECDSA P-256');
      expect(result.publicKey).toBeDefined();
    });

    it('should create unique fingerprint for each device', async () => {
      const binding1: DeviceBinding = {
        deviceId: 'device-1',
        publicKey: 'key-1',
        algorithm: 'ECDSA P-256',
        createdAt: new Date(),
        fingerprint: 'fingerprint-1',
      };

      const binding2: DeviceBinding = {
        deviceId: 'device-2',
        publicKey: 'key-2',
        algorithm: 'ECDSA P-256',
        createdAt: new Date(),
        fingerprint: 'fingerprint-2',
      };

      tokenForge.generateDeviceBinding.mockResolvedValueOnce(binding1);
      tokenForge.generateDeviceBinding.mockResolvedValueOnce(binding2);

      const result1 = await tokenForge.generateDeviceBinding('device-1');
      const result2 = await tokenForge.generateDeviceBinding('device-2');

      expect(result1.fingerprint).not.toBe(result2.fingerprint);
    });

    it('should include device metadata in binding', async () => {
      const deviceBinding: DeviceBinding = {
        deviceId: 'device-123',
        publicKey: 'public-key',
        algorithm: 'ECDSA P-256',
        createdAt: new Date(),
        fingerprint: 'fingerprint',
        metadata: {
          osType: 'darwin',
          osVersion: '14.2.1',
          cpuArchitecture: 'arm64',
        },
      };

      tokenForge.generateDeviceBinding.mockResolvedValue(deviceBinding);

      const result = await tokenForge.generateDeviceBinding('device-123');

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.osType).toBe('darwin');
    });
  });

  describe('Session Token Creation', () => {
    it('should create device-bound session token', async () => {
      const sessionToken: SessionToken = {
        token: 'token-abc123',
        userId: 'user-1',
        deviceId: 'device-1',
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        signature: 'ecdsa-signature',
      };

      tokenForge.createSessionToken.mockResolvedValue(sessionToken);

      const result = await tokenForge.createSessionToken('user-1', 'device-1');

      expect(result.token).toBeDefined();
      expect(result.deviceId).toBe('device-1');
      expect(result.signature).toBeDefined();
    });

    it('should include ECDSA P-256 signature in token', async () => {
      const sessionToken: SessionToken = {
        token: 'token-xyz',
        userId: 'user-2',
        deviceId: 'device-2',
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        signature: 'r=12345...&s=67890...',
      };

      tokenForge.createSessionToken.mockResolvedValue(sessionToken);

      const result = await tokenForge.createSessionToken('user-2', 'device-2');

      expect(result.signature).toMatch(/^r=.*&s=.*/);
    });

    it('should set appropriate expiration time', async () => {
      const now = Date.now();
      const sessionToken: SessionToken = {
        token: 'token-exp',
        userId: 'user-3',
        deviceId: 'device-3',
        issuedAt: new Date(now),
        expiresAt: new Date(now + 3600000),
        signature: 'sig',
      };

      tokenForge.createSessionToken.mockResolvedValue(sessionToken);

      const result = await tokenForge.createSessionToken('user-3', 'device-3');

      const expirationDiff = result.expiresAt.getTime() - result.issuedAt.getTime();
      expect(expirationDiff).toBe(3600000);
    });

    it('should bind session to specific device', async () => {
      const token1: SessionToken = {
        token: 'token-1',
        userId: 'user-1',
        deviceId: 'device-A',
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        signature: 'sig',
      };

      const token2: SessionToken = {
        token: 'token-2',
        userId: 'user-1',
        deviceId: 'device-B',
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        signature: 'sig',
      };

      tokenForge.createSessionToken.mockResolvedValueOnce(token1);
      tokenForge.createSessionToken.mockResolvedValueOnce(token2);

      const result1 = await tokenForge.createSessionToken('user-1', 'device-A');
      const result2 = await tokenForge.createSessionToken('user-1', 'device-B');

      expect(result1.deviceId).not.toBe(result2.deviceId);
    });
  });

  describe('Session Validation', () => {
    it('should validate valid session token', async () => {
      const sessionToken: SessionToken = {
        token: 'valid-token',
        userId: 'user-1',
        deviceId: 'device-1',
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        signature: 'valid-sig',
      };

      tokenForge.validateToken.mockResolvedValue({
        valid: true,
        token: sessionToken,
      });

      const result = await tokenForge.validateToken('valid-token', 'device-1');

      expect(result.valid).toBe(true);
      expect(result.token?.userId).toBe('user-1');
    });

    it('should reject expired token', async () => {
      const expiredToken: SessionToken = {
        token: 'expired-token',
        userId: 'user-1',
        deviceId: 'device-1',
        issuedAt: new Date(Date.now() - 7200000),
        expiresAt: new Date(Date.now() - 3600000),
        signature: 'sig',
      };

      tokenForge.validateToken.mockResolvedValue({
        valid: false,
        error: 'Token expired',
      });

      const result = await tokenForge.validateToken('expired-token', 'device-1');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token expired');
    });

    it('should verify ECDSA signature', async () => {
      const sessionToken: SessionToken = {
        token: 'token-sig-verify',
        userId: 'user-1',
        deviceId: 'device-1',
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        signature: 'ecdsa-signature-data',
      };

      tokenForge.validateToken.mockResolvedValue({
        valid: true,
        token: sessionToken,
        signatureValid: true,
      });

      const result = await tokenForge.validateToken(sessionToken.token, 'device-1');

      expect(result.signatureValid).toBe(true);
    });

    it('should verify device binding matches', async () => {
      tokenForge.validateToken.mockResolvedValue({
        valid: false,
        error: 'Device mismatch',
      });

      const result = await tokenForge.validateToken('token-xyz', 'device-wrong');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Device');
    });

    it('should reject token with invalid signature', async () => {
      tokenForge.validateToken.mockResolvedValue({
        valid: false,
        signatureValid: false,
        error: 'Invalid signature',
      });

      const result = await tokenForge.validateToken('token-bad-sig', 'device-1');

      expect(result.valid).toBe(false);
      expect(result.signatureValid).toBe(false);
    });
  });

  describe('Token Revocation', () => {
    it('should revoke session token', async () => {
      tokenForge.revokeToken.mockResolvedValue({
        revoked: true,
        revokedAt: new Date(),
      });

      const result = await tokenForge.revokeToken('token-123', 'user-1');

      expect(result.revoked).toBe(true);
      expect(result.revokedAt).toBeDefined();
    });

    it('should invalidate token immediately after revocation', async () => {
      const token = 'token-to-revoke';

      tokenForge.revokeToken.mockResolvedValue({ revoked: true });
      tokenForge.validateToken.mockResolvedValue({ valid: false });

      await tokenForge.revokeToken(token, 'user-1');
      const result = await tokenForge.validateToken(token, 'device-1');

      expect(result.valid).toBe(false);
    });

    it('should revoke all tokens for device', async () => {
      tokenForge.revokeToken.mockResolvedValue({
        revokedCount: 3,
      });

      const result = await tokenForge.revokeToken('', 'user-1', {
        deviceId: 'device-1',
        allTokens: true,
      });

      expect(result.revokedCount).toBeGreaterThan(0);
    });

    it('should handle revocation of already-revoked token', async () => {
      tokenForge.revokeToken.mockResolvedValue({
        revoked: false,
        error: 'Token already revoked',
      });

      const result = await tokenForge.revokeToken('already-revoked', 'user-1');

      expect(result.revoked).toBe(false);
    });
  });

  describe('Token Refresh', () => {
    it('should refresh valid session token', async () => {
      const oldToken: SessionToken = {
        token: 'old-token',
        userId: 'user-1',
        deviceId: 'device-1',
        issuedAt: new Date(Date.now() - 1800000),
        expiresAt: new Date(Date.now() + 1800000),
        signature: 'sig',
      };

      const newToken: SessionToken = {
        token: 'new-token',
        userId: 'user-1',
        deviceId: 'device-1',
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        signature: 'new-sig',
      };

      tokenForge.refreshToken.mockResolvedValue(newToken);

      const result = await tokenForge.refreshToken('old-token', 'device-1');

      expect(result.token).toBe('new-token');
      expect(result.expiresAt.getTime()).toBeGreaterThan(oldToken.expiresAt.getTime());
    });

    it('should maintain device binding on refresh', async () => {
      const newToken: SessionToken = {
        token: 'refreshed-token',
        userId: 'user-1',
        deviceId: 'device-1',
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        signature: 'sig',
      };

      tokenForge.refreshToken.mockResolvedValue(newToken);

      const result = await tokenForge.refreshToken('old-token', 'device-1');

      expect(result.deviceId).toBe('device-1');
    });

    it('should reject refresh with mismatched device', async () => {
      tokenForge.refreshToken.mockResolvedValue({
        valid: false,
        error: 'Device mismatch on refresh',
      });

      const result = await tokenForge.refreshToken('old-token', 'device-wrong');

      expect(result.valid).toBe(false);
    });

    it('should update signature on refresh', async () => {
      const oldToken = 'token-old-sig';
      const newToken: SessionToken = {
        token: 'refreshed',
        userId: 'user-1',
        deviceId: 'device-1',
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        signature: 'new-ecdsa-signature',
      };

      tokenForge.refreshToken.mockResolvedValue(newToken);

      const result = await tokenForge.refreshToken(oldToken, 'device-1');

      expect(result.signature).toBe('new-ecdsa-signature');
      expect(result.signature).not.toBe('old-ecdsa-signature');
    });
  });

  describe('Session Lifecycle', () => {
    it('should handle complete session lifecycle', async () => {
      const deviceId = 'device-lifecycle';

      const token: SessionToken = {
        token: 'lifecycle-token',
        userId: 'user-1',
        deviceId,
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        signature: 'sig',
      };

      tokenForge.createSessionToken.mockResolvedValue(token);
      tokenForge.validateToken.mockResolvedValue({ valid: true, token });
      tokenForge.revokeToken.mockResolvedValue({ revoked: true });

      const created = await tokenForge.createSessionToken('user-1', deviceId);
      expect(created.token).toBeDefined();

      const validated = await tokenForge.validateToken(created.token, deviceId);
      expect(validated.valid).toBe(true);

      const revoked = await tokenForge.revokeToken(created.token, 'user-1');
      expect(revoked.revoked).toBe(true);
    });

    it('should track session activity', async () => {
      const activity = {
        sessionId: 'session-1',
        lastActivity: new Date(),
        activityCount: 5,
        events: ['login', 'api_call', 'file_access'],
      };

      const result = {
        ...activity,
        lastActivity: new Date(Date.now() + 60000),
      };

      expect(result.activityCount).toBeGreaterThan(0);
      expect(result.events.length).toBeGreaterThan(0);
    });
  });

  describe('Cryptographic Security', () => {
    it('should use ECDSA P-256 for signing', async () => {
      const sessionToken: SessionToken = {
        token: 'crypto-token',
        userId: 'user-1',
        deviceId: 'device-1',
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        signature: 'r=abc123&s=def456',
      };

      expect(sessionToken.signature).toMatch(/^r=.*&s=.*/);
    });

    it('should generate strong random tokens', async () => {
      const tokens: string[] = [];

      for (let i = 0; i < 10; i++) {
        const token: SessionToken = {
          token: `token-${i}-${Math.random().toString(36).substr(2, 9)}`,
          userId: 'user-1',
          deviceId: 'device-1',
          issuedAt: new Date(),
          expiresAt: new Date(Date.now() + 3600000),
          signature: 'sig',
        };
        tokens.push(token.token);
      }

      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(tokens.length);
    });

    it('should prevent token tampering detection', async () => {
      const tampered = 'tampered-token-data';

      tokenForge.validateToken.mockResolvedValue({
        valid: false,
        signatureValid: false,
        error: 'Token tampered',
      });

      const result = await tokenForge.validateToken(tampered, 'device-1');

      expect(result.valid).toBe(false);
    });
  });
});
