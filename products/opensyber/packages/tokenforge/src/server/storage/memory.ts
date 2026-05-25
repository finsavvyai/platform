import type { TokenForgeStorage, StepUpChallengeRecord } from './interface.js';
import type { DeviceSession, SecurityEvent } from '../../shared/types.js';

/**
 * In-memory storage for testing and development.
 * Not suitable for production — data is lost on restart.
 */
export class MemoryStorage implements TokenForgeStorage {
  sessions: DeviceSession[] = [];
  events: (SecurityEvent & { id: string; created_at: string })[] = [];
  challenges: StepUpChallengeRecord[] = [];
  private nonces = new Map<string, number>(); // nonce → expiry timestamp
  private otps = new Map<string, { code: string; expiresAt: number }>();
  private histograms = new Map<string, { buckets: number[]; totalRequests: number }>();

  async getSession(sessionId: string, deviceId: string): Promise<DeviceSession | null> {
    return this.sessions.find(
      (s) => s.session_id === sessionId && s.id === deviceId && s.revoked === 0,
    ) ?? null;
  }

  async createSession(session: DeviceSession): Promise<void> {
    this.sessions.push({ ...session });
  }

  async updateTrustScore(deviceId: string, trustScore: number): Promise<void> {
    const s = this.sessions.find((s) => s.id === deviceId);
    if (s) {
      s.trust_score = trustScore;
      s.last_verified_at = new Date().toISOString();
    }
  }

  async updateBoundCookieHash(deviceId: string, hash: string, expiresAt: string): Promise<void> {
    const s = this.sessions.find((s) => s.id === deviceId);
    if (s) {
      s.bound_cookie_hash = hash;
      s.bound_cookie_expires_at = expiresAt;
    }
  }

  async revokeSession(deviceId: string, reason: string): Promise<void> {
    const s = this.sessions.find((s) => s.id === deviceId);
    if (s) {
      s.revoked = 1;
      s.revoked_reason = reason;
    }
  }

  async revokeUserSessions(userId: string): Promise<void> {
    for (const s of this.sessions) {
      if (s.user_id === userId && s.revoked === 0) {
        s.revoked = 1;
        s.revoked_reason = 'rebind';
      }
    }
  }

  async listUserSessions(userId: string, limit: number): Promise<DeviceSession[]> {
    return this.sessions
      .filter((s) => s.user_id === userId)
      .sort((a, b) => b.bound_at.localeCompare(a.bound_at))
      .slice(0, limit);
  }

  async restoreTrust(deviceId: string, userId: string): Promise<void> {
    const s = this.sessions.find((s) => s.id === deviceId && s.user_id === userId);
    if (s) s.trust_score = 100;
  }

  async hasNonce(nonce: string): Promise<boolean> {
    const expiry = this.nonces.get(nonce);
    if (!expiry) return false;
    if (Date.now() > expiry) {
      this.nonces.delete(nonce);
      return false;
    }
    return true;
  }

  async storeNonce(nonce: string, ttlSeconds: number): Promise<void> {
    this.nonces.set(nonce, Date.now() + ttlSeconds * 1000);
  }

  async logEvent(event: SecurityEvent & { id: string }): Promise<void> {
    this.events.push({ ...event, created_at: new Date().toISOString() });
  }

  async listEvents(userId: string, limit: number, offset: number): Promise<(SecurityEvent & { id: string; created_at: string })[]> {
    return this.events
      .filter((e) => e.userId === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(offset, offset + limit);
  }

  async createChallenge(challenge: StepUpChallengeRecord): Promise<void> {
    this.challenges.push({ ...challenge });
  }

  async getChallenge(challengeId: string, userId: string): Promise<StepUpChallengeRecord | null> {
    return this.challenges.find(
      (c) => c.id === challengeId && c.userId === userId && c.status === 'pending',
    ) ?? null;
  }

  async updateChallengeStatus(challengeId: string, status: string, completedAt?: string): Promise<void> {
    const c = this.challenges.find((c) => c.id === challengeId);
    if (c) {
      c.status = status as StepUpChallengeRecord['status'];
      if (completedAt) c.completedAt = completedAt;
    }
  }

  async countRecentChallenges(userId: string, windowMinutes: number): Promise<number> {
    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
    return this.challenges.filter(
      (c) => c.userId === userId && c.createdAt > cutoff,
    ).length;
  }

  async getActivityHistogram(userId: string): Promise<{ buckets: number[]; totalRequests: number } | null> {
    return this.histograms.get(`tf:activity:${userId}`) ?? null;
  }

  async setActivityHistogram(userId: string, histogram: { buckets: number[]; totalRequests: number }): Promise<void> {
    this.histograms.set(`tf:activity:${userId}`, { ...histogram, buckets: [...histogram.buckets] });
  }

  async storeOtp(challengeId: string, code: string, ttlSeconds: number): Promise<void> {
    this.otps.set(challengeId, { code, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async getOtp(challengeId: string): Promise<string | null> {
    const entry = this.otps.get(challengeId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.otps.delete(challengeId);
      return null;
    }
    return entry.code;
  }

  async deleteOtp(challengeId: string): Promise<void> {
    this.otps.delete(challengeId);
  }
}
