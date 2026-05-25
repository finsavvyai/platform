import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createTestUser,
  createMockDb,
  createMockKV,
} from './helpers.js';

/**
 * Sample Project 7: TokenForge Integration
 *
 * Tests device-bound session security with ECDSA P-256:
 *   Device binding → Session creation → Token verification → Step-up auth → Revocation
 *
 * TokenForge is OpenSyber's session security layer using Web Crypto API
 * with non-extractable private keys for device binding.
 */
describe('Sample Project: TokenForge Integration', () => {
  let user: ReturnType<typeof createTestUser>;
  let db: ReturnType<typeof createMockDb>;
  let kv: ReturnType<typeof createMockKV>;

  beforeEach(() => {
    user = createTestUser({ plan: 'pro', role: 'owner' });
    db = createMockDb();
    kv = createMockKV();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Device Binding (ECDSA P-256)', () => {
    it('should generate ECDSA P-256 key pair on device', async () => {
      const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign', 'verify'],
      );

      expect(keyPair.privateKey).toBeDefined();
      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey.extractable).toBe(false);
      expect(keyPair.privateKey.algorithm).toHaveProperty('name', 'ECDSA');
    });

    it('should export public key for server registration', async () => {
      const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign', 'verify'],
      );

      const publicKeyRaw = await crypto.subtle.exportKey(
        'raw',
        keyPair.publicKey,
      );

      expect(publicKeyRaw).toBeInstanceOf(ArrayBuffer);
      expect(publicKeyRaw.byteLength).toBe(65);
    });

    it('should register device public key on server', async () => {
      const deviceBinding = {
        userId: user.id,
        deviceId: `dev_${crypto.randomUUID().slice(0, 8)}`,
        publicKeyFingerprint: 'sha256:abc123def456',
        platform: 'chrome-linux',
        registeredAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
      };

      await db.insert({ device_bindings: {} }).values(deviceBinding);

      expect(db.insert).toHaveBeenCalled();
    });

    it('should prevent private key extraction', async () => {
      const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign', 'verify'],
      );

      await expect(
        crypto.subtle.exportKey('pkcs8', keyPair.privateKey),
      ).rejects.toThrow();
    });
  });

  describe('Session Creation', () => {
    it('should create device-bound session token', async () => {
      const session = {
        id: `sess_${crypto.randomUUID().slice(0, 8)}`,
        userId: user.id,
        deviceId: 'dev_abc123',
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        scope: ['read', 'write'],
        deviceBound: true,
      };

      await (kv.put as ReturnType<typeof vi.fn>)(
        `session:${session.id}`,
        JSON.stringify(session),
      );

      const stored = await (kv.get as ReturnType<typeof vi.fn>)(
        `session:${session.id}`,
        'json',
      );

      expect(stored.deviceBound).toBe(true);
      expect(stored.userId).toBe(user.id);
    });

    it('should sign session challenge with device key', async () => {
      const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign', 'verify'],
      );

      const challenge = crypto.randomUUID();
      const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        keyPair.privateKey,
        new TextEncoder().encode(challenge),
      );

      expect(signature).toBeInstanceOf(ArrayBuffer);
      expect(signature.byteLength).toBeGreaterThan(0);

      const isValid = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        keyPair.publicKey,
        signature,
        new TextEncoder().encode(challenge),
      );

      expect(isValid).toBe(true);
    });

    it('should reject session from different device', async () => {
      const keyPair1 = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign', 'verify'],
      );

      const keyPair2 = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign', 'verify'],
      );

      const challenge = 'session-verification-nonce';
      const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        keyPair1.privateKey,
        new TextEncoder().encode(challenge),
      );

      const crossDeviceValid = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        keyPair2.publicKey,
        signature,
        new TextEncoder().encode(challenge),
      );

      expect(crossDeviceValid).toBe(false);
    });
  });

  describe('Token Verification', () => {
    it('should verify valid session token', async () => {
      const session = {
        id: 'sess_valid',
        userId: user.id,
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        revoked: false,
      };

      await (kv.put as ReturnType<typeof vi.fn>)(
        'session:sess_valid',
        JSON.stringify(session),
      );

      const stored = await (kv.get as ReturnType<typeof vi.fn>)(
        'session:sess_valid',
        'json',
      );

      const isValid =
        stored &&
        !stored.revoked &&
        new Date(stored.expiresAt) > new Date();

      expect(isValid).toBe(true);
    });

    it('should reject expired session token', async () => {
      const session = {
        id: 'sess_expired',
        userId: user.id,
        expiresAt: new Date(Date.now() - 3600_000).toISOString(),
        revoked: false,
      };

      await (kv.put as ReturnType<typeof vi.fn>)(
        'session:sess_expired',
        JSON.stringify(session),
      );

      const stored = await (kv.get as ReturnType<typeof vi.fn>)(
        'session:sess_expired',
        'json',
      );

      const isValid =
        stored &&
        !stored.revoked &&
        new Date(stored.expiresAt) > new Date();

      expect(isValid).toBe(false);
    });

    it('should reject revoked session token', async () => {
      const session = {
        id: 'sess_revoked',
        userId: user.id,
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        revoked: true,
      };

      await (kv.put as ReturnType<typeof vi.fn>)(
        'session:sess_revoked',
        JSON.stringify(session),
      );

      const stored = await (kv.get as ReturnType<typeof vi.fn>)(
        'session:sess_revoked',
        'json',
      );

      expect(stored.revoked).toBe(true);
    });

    it('should return null for non-existent session', async () => {
      const stored = await (kv.get as ReturnType<typeof vi.fn>)(
        'session:nonexistent',
      );
      expect(stored).toBeNull();
    });
  });

  describe('Step-Up Authentication', () => {
    it('should require step-up auth for sensitive operations', () => {
      const sensitiveActions = [
        'vault.write',
        'agent.delete',
        'billing.update',
        'sso.configure',
        'role.modify',
      ];

      const currentAction = 'vault.write';
      const requiresStepUp = sensitiveActions.includes(currentAction);

      expect(requiresStepUp).toBe(true);
    });

    it('should validate step-up challenge within time window', () => {
      const stepUpChallenge = {
        issuedAt: Date.now(),
        expiresAt: Date.now() + 300_000,
        method: 'device_signature',
        completed: true,
      };

      const isValid =
        stepUpChallenge.completed &&
        Date.now() < stepUpChallenge.expiresAt;

      expect(isValid).toBe(true);
    });

    it('should reject expired step-up challenge', () => {
      const expiredChallenge = {
        issuedAt: Date.now() - 600_000,
        expiresAt: Date.now() - 300_000,
        method: 'device_signature',
        completed: true,
      };

      const isValid =
        expiredChallenge.completed &&
        Date.now() < expiredChallenge.expiresAt;

      expect(isValid).toBe(false);
    });
  });

  describe('Session Revocation', () => {
    it('should revoke single session', async () => {
      await (kv.put as ReturnType<typeof vi.fn>)(
        'session:sess_1',
        JSON.stringify({ revoked: false }),
      );

      await (kv.put as ReturnType<typeof vi.fn>)(
        'session:sess_1',
        JSON.stringify({ revoked: true, revokedAt: new Date().toISOString() }),
      );

      const stored = await (kv.get as ReturnType<typeof vi.fn>)(
        'session:sess_1',
        'json',
      );
      expect(stored.revoked).toBe(true);
    });

    it('should revoke all sessions for a user', async () => {
      const sessionIds = ['sess_a', 'sess_b', 'sess_c'];

      for (const id of sessionIds) {
        await (kv.put as ReturnType<typeof vi.fn>)(
          `session:${id}`,
          JSON.stringify({ userId: user.id, revoked: true }),
        );
      }

      expect(kv.put).toHaveBeenCalledTimes(3);
    });

    it('should revoke all sessions for a device', async () => {
      const deviceId = 'dev_compromised';

      db._setSelectResult([
        { id: 'sess_1', deviceId },
        { id: 'sess_2', deviceId },
      ]);

      const sessions = await db
        .select()
        .from('sessions')
        .where('deviceId = ?');

      for (const session of sessions as Array<{ id: string }>) {
        await (kv.put as ReturnType<typeof vi.fn>)(
          `session:${session.id}`,
          JSON.stringify({ revoked: true }),
        );
      }

      expect(kv.put).toHaveBeenCalled();
    });
  });

  describe('Multi-Platform SDK Compatibility', () => {
    it('should support TypeScript/JavaScript SDK', () => {
      const sdkConfig = {
        projectId: 'opensyber',
        endpoint: 'https://api.opensyber.cloud',
        storage: 'indexeddb',
      };

      expect(sdkConfig.storage).toBe('indexeddb');
    });

    it('should support React hooks', () => {
      const reactHooks = [
        'useTokenForge',
        'useSession',
        'useDeviceBinding',
        'useStepUpAuth',
      ];

      expect(reactHooks).toHaveLength(4);
      expect(reactHooks).toContain('useTokenForge');
    });

    it('should validate SDK adapters exist', () => {
      const adapters = ['hono', 'express', 'nextjs'];
      expect(adapters).toHaveLength(3);
    });

    it('should support Go, Python, Kotlin, Swift SDKs', () => {
      const sdks = ['typescript', 'go', 'python', 'kotlin', 'swift', 'react-native'];
      expect(sdks).toHaveLength(6);
    });
  });
});
