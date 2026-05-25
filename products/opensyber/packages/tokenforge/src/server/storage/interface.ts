import type { DeviceSession, SecurityEvent } from '../../shared/types.js';

/**
 * Storage interface for TokenForge server.
 * Implement this to use any database/cache backend.
 */
export interface TokenForgeStorage {
  // ─── Device Sessions ─────────────────────────────────────────────────
  /** Find an active (non-revoked) session by sessionId + deviceId */
  getSession(sessionId: string, deviceId: string): Promise<DeviceSession | null>;
  /** Create a new device session */
  createSession(session: DeviceSession): Promise<void>;
  /** Update trust score and last_verified_at for a session */
  updateTrustScore(deviceId: string, trustScore: number): Promise<void>;
  /** Store the DBSC bound cookie hash + expiry for a device session */
  updateBoundCookieHash(deviceId: string, hash: string, expiresAt: string): Promise<void>;
  /** Mark a session as revoked */
  revokeSession(deviceId: string, reason: string): Promise<void>;
  /** Revoke all sessions for a user (called before re-binding) */
  revokeUserSessions(userId: string): Promise<void>;
  /** List a user's sessions (most recent first) */
  listUserSessions(userId: string, limit: number): Promise<DeviceSession[]>;
  /** Restore trust score to 100 after step-up */
  restoreTrust(deviceId: string, userId: string): Promise<void>;

  // ─── Nonces (Replay Prevention) ──────────────────────────────────────
  /** Check if nonce has been used */
  hasNonce(nonce: string): Promise<boolean>;
  /** Store a used nonce with TTL in seconds */
  storeNonce(nonce: string, ttlSeconds: number): Promise<void>;

  // ─── Security Events ─────────────────────────────────────────────────
  /** Insert a security event record */
  logEvent(event: SecurityEvent & { id: string }): Promise<void>;
  /** List security events for a user (for dashboard) */
  listEvents(userId: string, limit: number, offset: number): Promise<(SecurityEvent & { id: string; created_at: string })[]>;

  // ─── Step-Up Challenges ──────────────────────────────────────────────
  /** Create a step-up challenge */
  createChallenge(challenge: StepUpChallengeRecord): Promise<void>;
  /** Get a pending challenge by ID + userId */
  getChallenge(challengeId: string, userId: string): Promise<StepUpChallengeRecord | null>;
  /** Update challenge status */
  updateChallengeStatus(challengeId: string, status: string, completedAt?: string): Promise<void>;
  /** Count recent challenges for rate limiting */
  countRecentChallenges(userId: string, windowMinutes: number): Promise<number>;

  // ─── Activity Histogram (Time-of-Day) ─────────────────────────────────
  /** Retrieve the activity histogram for a user (null if none stored). */
  getActivityHistogram(userId: string): Promise<{ buckets: number[]; totalRequests: number } | null>;
  /** Store the updated activity histogram for a user. */
  setActivityHistogram(userId: string, histogram: { buckets: number[]; totalRequests: number }): Promise<void>;

  // ─── Step-Up OTP (Short-lived KV) ────────────────────────────────────
  /** Store OTP code for a challenge with TTL */
  storeOtp(challengeId: string, code: string, ttlSeconds: number): Promise<void>;
  /** Retrieve and consume OTP code */
  getOtp(challengeId: string): Promise<string | null>;
  /** Delete OTP after verification */
  deleteOtp(challengeId: string): Promise<void>;
}

/** Step-up challenge stored in database */
export interface StepUpChallengeRecord {
  id: string;
  sessionId: string;
  userId: string;
  reason: string;
  method: 'totp' | 'email_otp' | 'passkey';
  status: 'pending' | 'completed' | 'expired' | 'failed';
  expiresAt: string;
  createdAt: string;
  completedAt: string | null;
}
