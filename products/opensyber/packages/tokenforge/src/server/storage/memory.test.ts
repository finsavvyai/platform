import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryStorage } from './memory.js';
import type { DeviceSession } from '../../shared/types.js';

function makeSession(overrides: Partial<DeviceSession> = {}): DeviceSession {
  return {
    id: 'dev-1',
    session_id: 'sess-1',
    user_id: 'user-1',
    public_key: '{}',
    device_fingerprint: 'fp-abc',
    ip_address: '1.2.3.4',
    country_code: 'US',
    trust_score: 100,
    bound_at: new Date().toISOString(),
    last_verified_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400_000).toISOString(),
    revoked: 0,
    revoked_reason: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('MemoryStorage', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  describe('sessions', () => {
    it('creates and retrieves a session', async () => {
      const session = makeSession();
      await storage.createSession(session);
      const found = await storage.getSession('sess-1', 'dev-1');
      expect(found).not.toBeNull();
      expect(found!.user_id).toBe('user-1');
    });

    it('returns null for non-existent session', async () => {
      const found = await storage.getSession('no-exist', 'no-dev');
      expect(found).toBeNull();
    });

    it('returns null for revoked session', async () => {
      await storage.createSession(makeSession());
      await storage.revokeSession('dev-1', 'test');
      const found = await storage.getSession('sess-1', 'dev-1');
      expect(found).toBeNull();
    });

    it('updateTrustScore modifies the score', async () => {
      await storage.createSession(makeSession());
      await storage.updateTrustScore('dev-1', 75);
      const found = await storage.getSession('sess-1', 'dev-1');
      expect(found!.trust_score).toBe(75);
    });

    it('revokeSession marks it revoked with reason', async () => {
      await storage.createSession(makeSession());
      await storage.revokeSession('dev-1', 'suspicious');
      const session = storage.sessions.find((s) => s.id === 'dev-1');
      expect(session!.revoked).toBe(1);
      expect(session!.revoked_reason).toBe('suspicious');
    });

    it('revokeUserSessions revokes all active sessions for user', async () => {
      await storage.createSession(makeSession({ id: 'a', session_id: 's1' }));
      await storage.createSession(makeSession({ id: 'b', session_id: 's2' }));
      await storage.createSession(
        makeSession({ id: 'c', session_id: 's3', user_id: 'other' }),
      );
      await storage.revokeUserSessions('user-1');

      const a = storage.sessions.find((s) => s.id === 'a');
      const b = storage.sessions.find((s) => s.id === 'b');
      const c = storage.sessions.find((s) => s.id === 'c');
      expect(a!.revoked).toBe(1);
      expect(b!.revoked).toBe(1);
      expect(c!.revoked).toBe(0);
    });
  });

  describe('nonces', () => {
    it('round-trips hasNonce/storeNonce', async () => {
      expect(await storage.hasNonce('n1')).toBe(false);
      await storage.storeNonce('n1', 60);
      expect(await storage.hasNonce('n1')).toBe(true);
    });

    it('nonce expires after TTL', async () => {
      vi.useFakeTimers();
      try {
        await storage.storeNonce('n2', 5);
        expect(await storage.hasNonce('n2')).toBe(true);
        vi.advanceTimersByTime(6_000);
        expect(await storage.hasNonce('n2')).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('events', () => {
    it('logEvent and listEvents round-trip', async () => {
      await storage.logEvent({
        id: 'evt-1',
        sessionId: 'sess-1',
        userId: 'user-1',
        eventType: 'DEVICE_BOUND',
        trustScoreBefore: 0,
        trustScoreAfter: 100,
        ipAddress: '1.2.3.4',
        countryCode: 'US',
        userAgent: 'test',
        metadata: {},
      });
      const events = await storage.listEvents('user-1', 10, 0);
      expect(events).toHaveLength(1);
      expect(events[0]!.eventType).toBe('DEVICE_BOUND');
      expect(events[0]!.created_at).toBeDefined();
    });
  });

  describe('challenges', () => {
    it('createChallenge and getChallenge round-trip', async () => {
      const challenge = {
        id: 'ch-1',
        sessionId: 'sess-1',
        userId: 'user-1',
        reason: 'trust_drop',
        method: 'totp' as const,
        status: 'pending' as const,
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
        createdAt: new Date().toISOString(),
        completedAt: null,
      };
      await storage.createChallenge(challenge);
      const found = await storage.getChallenge('ch-1', 'user-1');
      expect(found).not.toBeNull();
      expect(found!.method).toBe('totp');
    });

    it('getChallenge returns null for completed challenge', async () => {
      const challenge = {
        id: 'ch-2',
        sessionId: 'sess-1',
        userId: 'user-1',
        reason: 'test',
        method: 'email_otp' as const,
        status: 'pending' as const,
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
        createdAt: new Date().toISOString(),
        completedAt: null,
      };
      await storage.createChallenge(challenge);
      await storage.updateChallengeStatus('ch-2', 'completed', new Date().toISOString());
      const found = await storage.getChallenge('ch-2', 'user-1');
      expect(found).toBeNull();
    });
  });

  describe('OTP', () => {
    it('storeOtp/getOtp/deleteOtp round-trip', async () => {
      await storage.storeOtp('ch-1', '123456', 300);
      expect(await storage.getOtp('ch-1')).toBe('123456');
      await storage.deleteOtp('ch-1');
      expect(await storage.getOtp('ch-1')).toBeNull();
    });

    it('getOtp returns null for non-existent', async () => {
      expect(await storage.getOtp('nope')).toBeNull();
    });

    it('OTP expires after TTL', async () => {
      vi.useFakeTimers();
      try {
        await storage.storeOtp('ch-2', '654321', 5);
        expect(await storage.getOtp('ch-2')).toBe('654321');
        vi.advanceTimersByTime(6_000);
        expect(await storage.getOtp('ch-2')).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
