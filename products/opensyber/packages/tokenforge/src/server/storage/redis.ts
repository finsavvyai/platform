import type { TokenForgeStorage, StepUpChallengeRecord } from './interface.js';
import type { DeviceSession, SecurityEvent } from '../../shared/types.js';

/** Generic Redis client interface — works with ioredis, redis, upstash, etc. */
export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, opts?: { ex?: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
}

/**
 * Redis storage implementation.
 * Stores sessions, events, and challenges as JSON in Redis keys.
 * Best for: session-heavy workloads, sub-millisecond nonce checks.
 */
export class RedisStorage implements TokenForgeStorage {
  constructor(private redis: RedisClient) {}

  private sessionKey(deviceId: string): string { return `tf:session:${deviceId}`; }
  private userSessionsKey(userId: string): string { return `tf:user_sessions:${userId}`; }
  private eventKey(id: string): string { return `tf:event:${id}`; }

  async getSession(sessionId: string, deviceId: string): Promise<DeviceSession | null> {
    const data = await this.redis.get(this.sessionKey(deviceId));
    if (!data) return null;
    const session = JSON.parse(data) as DeviceSession;
    if (session.session_id !== sessionId || session.revoked !== 0) return null;
    return session;
  }

  async createSession(session: DeviceSession): Promise<void> {
    const ttl = Math.max(1, Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000));
    await this.redis.set(this.sessionKey(session.id), JSON.stringify(session), { ex: ttl });
    // Track session in user's session set
    const userSessions = await this.getUserSessionIds(session.user_id);
    userSessions.push(session.id);
    await this.redis.set(this.userSessionsKey(session.user_id), JSON.stringify(userSessions));
  }

  async updateTrustScore(deviceId: string, trustScore: number): Promise<void> {
    const data = await this.redis.get(this.sessionKey(deviceId));
    if (!data) return;
    const session = JSON.parse(data) as DeviceSession;
    session.trust_score = trustScore;
    session.last_verified_at = new Date().toISOString();
    const ttl = Math.max(1, Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000));
    await this.redis.set(this.sessionKey(deviceId), JSON.stringify(session), { ex: ttl });
  }

  async revokeSession(deviceId: string, reason: string): Promise<void> {
    const data = await this.redis.get(this.sessionKey(deviceId));
    if (!data) return;
    const session = JSON.parse(data) as DeviceSession;
    session.revoked = 1;
    session.revoked_reason = reason;
    await this.redis.set(this.sessionKey(deviceId), JSON.stringify(session), { ex: 3600 });
  }

  async revokeUserSessions(userId: string): Promise<void> {
    const ids = await this.getUserSessionIds(userId);
    for (const id of ids) {
      await this.revokeSession(id, 'rebind');
    }
  }

  async listUserSessions(userId: string, limit: number): Promise<DeviceSession[]> {
    const ids = await this.getUserSessionIds(userId);
    const sessions: DeviceSession[] = [];
    for (const id of ids.slice(-limit).reverse()) {
      const data = await this.redis.get(this.sessionKey(id));
      if (data) sessions.push(JSON.parse(data) as DeviceSession);
    }
    return sessions;
  }

  async restoreTrust(deviceId: string, userId: string): Promise<void> {
    const data = await this.redis.get(this.sessionKey(deviceId));
    if (!data) return;
    const session = JSON.parse(data) as DeviceSession;
    if (session.user_id !== userId) return;
    session.trust_score = 100;
    const ttl = Math.max(1, Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000));
    await this.redis.set(this.sessionKey(deviceId), JSON.stringify(session), { ex: ttl });
  }

  async hasNonce(nonce: string): Promise<boolean> {
    return (await this.redis.get(`tf:nonce:${nonce}`)) !== null;
  }

  async storeNonce(nonce: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(`tf:nonce:${nonce}`, '1', { ex: ttlSeconds });
  }

  async logEvent(event: SecurityEvent & { id: string }): Promise<void> {
    const record = { ...event, created_at: new Date().toISOString() };
    await this.redis.set(this.eventKey(event.id), JSON.stringify(record), { ex: 7776000 }); // 90 days
    // Append to user's event list
    const listKey = `tf:user_events:${event.userId}`;
    const existing = await this.redis.get(listKey);
    const ids: string[] = existing ? JSON.parse(existing) : [];
    ids.push(event.id);
    await this.redis.set(listKey, JSON.stringify(ids));
  }

  async listEvents(userId: string, limit: number, offset: number): Promise<(SecurityEvent & { id: string; created_at: string })[]> {
    const listKey = `tf:user_events:${userId}`;
    const existing = await this.redis.get(listKey);
    const ids: string[] = existing ? JSON.parse(existing) : [];
    const slice = ids.reverse().slice(offset, offset + limit);
    const events: (SecurityEvent & { id: string; created_at: string })[] = [];
    for (const id of slice) {
      const data = await this.redis.get(this.eventKey(id));
      if (data) events.push(JSON.parse(data));
    }
    return events;
  }

  async createChallenge(challenge: StepUpChallengeRecord): Promise<void> {
    await this.redis.set(`tf:challenge:${challenge.id}`, JSON.stringify(challenge), { ex: 600 });
  }

  async getChallenge(challengeId: string, userId: string): Promise<StepUpChallengeRecord | null> {
    const data = await this.redis.get(`tf:challenge:${challengeId}`);
    if (!data) return null;
    const challenge = JSON.parse(data) as StepUpChallengeRecord;
    if (challenge.userId !== userId || challenge.status !== 'pending') return null;
    return challenge;
  }

  async updateChallengeStatus(challengeId: string, status: string, completedAt?: string): Promise<void> {
    const data = await this.redis.get(`tf:challenge:${challengeId}`);
    if (!data) return;
    const challenge = JSON.parse(data) as StepUpChallengeRecord;
    challenge.status = status as StepUpChallengeRecord['status'];
    if (completedAt) challenge.completedAt = completedAt;
    await this.redis.set(`tf:challenge:${challengeId}`, JSON.stringify(challenge), { ex: 600 });
  }

  async countRecentChallenges(userId: string, windowMinutes: number): Promise<number> {
    const key = `tf:rate:stepup:${userId}`;
    const count = await this.redis.get(key);
    return count ? parseInt(count, 10) : 0;
  }

  async updateBoundCookieHash(deviceId: string, hash: string, expiresAt: string): Promise<void> {
    const data = await this.redis.get(this.sessionKey(deviceId));
    if (!data) return;
    const session = JSON.parse(data) as DeviceSession & { bound_cookie_hash?: string; bound_cookie_expires_at?: string };
    session.bound_cookie_hash = hash;
    session.bound_cookie_expires_at = expiresAt;
    const ttl = Math.max(1, Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000));
    await this.redis.set(this.sessionKey(deviceId), JSON.stringify(session), { ex: ttl });
  }

  async getActivityHistogram(userId: string): Promise<{ buckets: number[]; totalRequests: number } | null> {
    const data = await this.redis.get(`tf:activity:${userId}`);
    return data ? JSON.parse(data) : null;
  }

  async setActivityHistogram(userId: string, histogram: { buckets: number[]; totalRequests: number }): Promise<void> {
    await this.redis.set(`tf:activity:${userId}`, JSON.stringify(histogram));
  }

  async storeOtp(challengeId: string, code: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(`tf:otp:${challengeId}`, code, { ex: ttlSeconds });
  }

  async getOtp(challengeId: string): Promise<string | null> {
    return this.redis.get(`tf:otp:${challengeId}`);
  }

  async deleteOtp(challengeId: string): Promise<void> {
    await this.redis.del(`tf:otp:${challengeId}`);
  }

  private async getUserSessionIds(userId: string): Promise<string[]> {
    const data = await this.redis.get(this.userSessionsKey(userId));
    return data ? JSON.parse(data) : [];
  }
}
