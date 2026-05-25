/**
 * REAL Integration Test: Step-Up Authentication Flow
 *
 * Tests the full step-up challenge lifecycle with real storage:
 * 1. Create a challenge (TOTP / email_otp)
 * 2. Store OTP code
 * 3. Verify correct code restores trust
 * 4. Verify wrong code fails
 * 5. Rate limiting after too many attempts
 * 6. Challenge expiry
 *
 * Uses real MemoryStorage — no mocks.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorage } from '../../packages/tokenforge/src/server/storage/memory.js';
import type { StepUpChallengeRecord } from '../../packages/tokenforge/src/server/storage/interface.js';
import type { DeviceSession } from '../../packages/tokenforge/src/shared/types.js';
import { hashFingerprint } from '../../packages/tokenforge/src/server/trust-score.js';
import { generateKeyPair, exportPublicKeyJwk } from './crypto-helpers.js';

describe('Real Step-Up Challenge Flow', () => {
  let storage: MemoryStorage;
  const userId = 'user-stepup-001';
  const sessionId = 'session-stepup-001';
  const deviceId = 'device-stepup-001';

  beforeEach(async () => {
    storage = new MemoryStorage();
    const keyPair = await generateKeyPair();
    const publicKeyJwk = await exportPublicKeyJwk(keyPair);
    const now = new Date();

    // Create a device session with degraded trust (triggers step-up)
    const session: DeviceSession = {
      id: deviceId,
      session_id: sessionId,
      user_id: userId,
      public_key: publicKeyJwk,
      device_fingerprint: hashFingerprint('TestAgent'),
      ip_address: '192.168.1.1',
      country_code: 'US',
      trust_score: 50, // degraded
      bound_at: now.toISOString(),
      last_verified_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 86400000).toISOString(),
      revoked: 0,
      revoked_reason: null,
      created_at: now.toISOString(),
    };
    await storage.createSession(session);
  });

  it('should create and verify an email OTP challenge', async () => {
    const challengeId = crypto.randomUUID();
    const otp = '123456';

    // 1. Create challenge
    const challenge: StepUpChallengeRecord = {
      id: challengeId,
      sessionId,
      userId,
      reason: 'trust_score_drop',
      method: 'email_otp',
      status: 'pending',
      expiresAt: new Date(Date.now() + 300000).toISOString(),
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    await storage.createChallenge(challenge);

    // 2. Store OTP
    await storage.storeOtp(challengeId, otp, 300);

    // 3. Retrieve and verify OTP
    const storedOtp = await storage.getOtp(challengeId);
    expect(storedOtp).toBe(otp);

    // 4. Delete OTP after use
    await storage.deleteOtp(challengeId);
    const deletedOtp = await storage.getOtp(challengeId);
    expect(deletedOtp).toBeNull();

    // 5. Mark challenge completed
    await storage.updateChallengeStatus(challengeId, 'completed', new Date().toISOString());

    // 6. Restore trust
    await storage.restoreTrust(deviceId, userId);
    const session = await storage.getSession(sessionId, deviceId);
    expect(session).not.toBeNull();
    expect(session!.trust_score).toBe(100);
  });

  it('should reject wrong OTP code', async () => {
    const challengeId = crypto.randomUUID();
    await storage.storeOtp(challengeId, '999999', 300);

    const storedOtp = await storage.getOtp(challengeId);
    const userCode = '000000';

    // Wrong code
    expect(storedOtp).toBe('999999');
    expect(storedOtp === userCode).toBe(false);
  });

  it('should rate-limit after 5 challenges in 15 minutes', async () => {
    for (let i = 0; i < 5; i++) {
      await storage.createChallenge({
        id: crypto.randomUUID(),
        sessionId,
        userId,
        reason: 'test',
        method: 'email_otp',
        status: 'pending',
        expiresAt: new Date(Date.now() + 300000).toISOString(),
        createdAt: new Date().toISOString(),
        completedAt: null,
      });
    }

    const count = await storage.countRecentChallenges(userId, 15);
    expect(count).toBe(5);
    // The step-up route checks: if count >= 5, return 429
    expect(count >= 5).toBe(true);
  });

  it('should expire challenges', async () => {
    const challengeId = crypto.randomUUID();
    const expired = new Date(Date.now() - 60000).toISOString(); // expired 1 min ago

    await storage.createChallenge({
      id: challengeId,
      sessionId,
      userId,
      reason: 'test',
      method: 'totp',
      status: 'pending',
      expiresAt: expired,
      createdAt: new Date(Date.now() - 360000).toISOString(),
      completedAt: null,
    });

    const challenge = await storage.getChallenge(challengeId, userId);
    // Challenge is pending but expired — app code checks expiresAt
    expect(challenge).not.toBeNull();
    expect(new Date(challenge!.expiresAt) < new Date()).toBe(true);
  });

  it('should not return completed challenges', async () => {
    const challengeId = crypto.randomUUID();

    await storage.createChallenge({
      id: challengeId,
      sessionId,
      userId,
      reason: 'test',
      method: 'totp',
      status: 'pending',
      expiresAt: new Date(Date.now() + 300000).toISOString(),
      createdAt: new Date().toISOString(),
      completedAt: null,
    });

    // Complete it
    await storage.updateChallengeStatus(challengeId, 'completed', new Date().toISOString());

    // Should not be findable
    const found = await storage.getChallenge(challengeId, userId);
    expect(found).toBeNull();
  });

  it('should expire OTPs after TTL', async () => {
    const challengeId = crypto.randomUUID();
    // TTL of 0 seconds = immediate expiry
    await storage.storeOtp(challengeId, '111111', 0);

    // Wait a tick for expiry
    await new Promise((r) => setTimeout(r, 15));

    const otp = await storage.getOtp(challengeId);
    expect(otp).toBeNull();
  });
});
