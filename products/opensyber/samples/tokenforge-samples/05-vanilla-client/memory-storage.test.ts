/**
 * Tests: TokenForge MemoryStorage
 *
 * Validates the in-memory storage backend that is used for
 * development and testing across all framework adapters.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorage } from '../../packages/tokenforge/src/server/storage/memory.js';
import type { DeviceSession, SecurityEvent } from '../../packages/tokenforge/src/shared/types.js';

function makeSession(overrides: Partial<DeviceSession> = {}): DeviceSession {
  const now = new Date();
  return {
    id: 'device-001',
    session_id: 'session-001',
    user_id: 'user-001',
    public_key: '{"kty":"EC","crv":"P-256"}',
    device_fingerprint: 'fp-abc',
    ip_address: '192.168.1.100',
    country_code: 'US',
    trust_score: 100,
    bound_at: now.toISOString(),
    last_verified_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 86400000).toISOString(),
    revoked: 0,
    revoked_reason: null,
    created_at: now.toISOString(),
    ...overrides,
  };
}

describe('MemoryStorage', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  describe('Sessions', () => {
    it('should create and retrieve a session', async () => {
      const session = makeSession();
      await storage.createSession(session);

      const found = await storage.getSession('session-001', 'device-001');
      expect(found).not.toBeNull();
      expect(found!.user_id).toBe('user-001');
      expect(found!.trust_score).toBe(100);
    });

    it('should not find revoked sessions', async () => {
      await storage.createSession(makeSession({ revoked: 1 }));

      const found = await storage.getSession('session-001', 'device-001');
      expect(found).toBeNull();
    });

    it('should not find session with wrong device ID', async () => {
      await storage.createSession(makeSession());

      const found = await storage.getSession('session-001', 'wrong-device');
      expect(found).toBeNull();
    });

    it('should update trust score', async () => {
      await storage.createSession(makeSession());
      await storage.updateTrustScore('device-001', 75);

      const found = await storage.getSession('session-001', 'device-001');
      expect(found!.trust_score).toBe(75);
    });

    it('should revoke a session', async () => {
      await storage.createSession(makeSession());
      await storage.revokeSession('device-001', 'test_revoke');

      const found = await storage.getSession('session-001', 'device-001');
      expect(found).toBeNull();

      const raw = storage.sessions.find((s) => s.id === 'device-001');
      expect(raw!.revoked).toBe(1);
      expect(raw!.revoked_reason).toBe('test_revoke');
    });

    it('should revoke all user sessions on rebind', async () => {
      await storage.createSession(makeSession({ id: 'dev-1' }));
      await storage.createSession(makeSession({ id: 'dev-2', session_id: 's2' }));
      await storage.revokeUserSessions('user-001');

      expect(storage.sessions.every((s) => s.revoked === 1)).toBe(true);
    });

    it('should list user sessions sorted by bound_at', async () => {
      await storage.createSession(makeSession({
        id: 'dev-1', bound_at: '2024-01-01T00:00:00Z',
      }));
      await storage.createSession(makeSession({
        id: 'dev-2', session_id: 's2', bound_at: '2024-06-01T00:00:00Z',
      }));

      const sessions = await storage.listUserSessions('user-001', 10);
      expect(sessions[0]!.id).toBe('dev-2');
    });

    it('should restore trust score after step-up', async () => {
      await storage.createSession(makeSession({ trust_score: 50 }));
      await storage.restoreTrust('device-001', 'user-001');

      const found = await storage.getSession('session-001', 'device-001');
      expect(found!.trust_score).toBe(100);
    });
  });

  describe('Nonces', () => {
    it('should detect nonce replay', async () => {
      await storage.storeNonce('nonce-1', 60);

      expect(await storage.hasNonce('nonce-1')).toBe(true);
      expect(await storage.hasNonce('nonce-2')).toBe(false);
    });

    it('should expire nonces', async () => {
      await storage.storeNonce('nonce-old', 0);
      // Wait briefly to ensure expiry
      await new Promise((r) => setTimeout(r, 10));

      expect(await storage.hasNonce('nonce-old')).toBe(false);
    });
  });

  describe('Security Events', () => {
    it('should log and list events', async () => {
      const event: SecurityEvent & { id: string } = {
        id: 'evt-1',
        sessionId: 'session-001',
        userId: 'user-001',
        eventType: 'DEVICE_BOUND',
        trustScoreBefore: 0,
        trustScoreAfter: 100,
        ipAddress: '192.168.1.100',
        countryCode: 'US',
        userAgent: 'Test',
        metadata: {},
      };
      await storage.logEvent(event);

      const events = await storage.listEvents('user-001', 10, 0);
      expect(events).toHaveLength(1);
      expect(events[0]!.eventType).toBe('DEVICE_BOUND');
    });

    it('should paginate events', async () => {
      for (let i = 0; i < 5; i++) {
        await storage.logEvent({
          id: `evt-${i}`, sessionId: 's', userId: 'user-001',
          eventType: 'TRUST_SCORE_CHANGE', trustScoreBefore: 100,
          trustScoreAfter: 90, ipAddress: '', countryCode: '',
          userAgent: '', metadata: { i },
        });
      }

      const page1 = await storage.listEvents('user-001', 2, 0);
      const page2 = await storage.listEvents('user-001', 2, 2);
      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
    });
  });

  describe('Step-Up Challenges', () => {
    it('should create and retrieve a challenge', async () => {
      await storage.createChallenge({
        id: 'ch-1', sessionId: 's1', userId: 'user-001',
        reason: 'trust_drop', method: 'totp', status: 'pending',
        expiresAt: new Date(Date.now() + 300000).toISOString(),
        createdAt: new Date().toISOString(), completedAt: null,
      });

      const found = await storage.getChallenge('ch-1', 'user-001');
      expect(found).not.toBeNull();
      expect(found!.method).toBe('totp');
    });

    it('should not return completed challenges', async () => {
      await storage.createChallenge({
        id: 'ch-2', sessionId: 's1', userId: 'user-001',
        reason: 'trust_drop', method: 'email_otp', status: 'completed',
        expiresAt: new Date(Date.now() + 300000).toISOString(),
        createdAt: new Date().toISOString(), completedAt: new Date().toISOString(),
      });

      const found = await storage.getChallenge('ch-2', 'user-001');
      expect(found).toBeNull();
    });

    it('should count recent challenges for rate limiting', async () => {
      for (let i = 0; i < 3; i++) {
        await storage.createChallenge({
          id: `ch-${i}`, sessionId: 's1', userId: 'user-001',
          reason: 'test', method: 'totp', status: 'pending',
          expiresAt: new Date(Date.now() + 300000).toISOString(),
          createdAt: new Date().toISOString(), completedAt: null,
        });
      }

      const count = await storage.countRecentChallenges('user-001', 15);
      expect(count).toBe(3);
    });
  });

  describe('OTP', () => {
    it('should store, retrieve, and delete OTP', async () => {
      await storage.storeOtp('ch-1', '123456', 300);
      expect(await storage.getOtp('ch-1')).toBe('123456');

      await storage.deleteOtp('ch-1');
      expect(await storage.getOtp('ch-1')).toBeNull();
    });

    it('should return null for expired OTP', async () => {
      await storage.storeOtp('ch-2', '654321', 0);
      await new Promise((r) => setTimeout(r, 10));
      expect(await storage.getOtp('ch-2')).toBeNull();
    });
  });
});
