import type { TokenForgeStorage, StepUpChallengeRecord } from './interface.js';
import type { DeviceSession, SecurityEvent } from '../../shared/types.js';

/**
 * Cloudflare D1 + KV storage implementation.
 * Uses D1 for sessions/events/challenges, KV for nonces + OTPs.
 */
export class D1Storage implements TokenForgeStorage {
  constructor(
    private db: D1Database,
    private kv: KVNamespace,
  ) {}

  async getSession(sessionId: string, deviceId: string): Promise<DeviceSession | null> {
    return (await this.db
      .prepare('SELECT * FROM device_sessions WHERE session_id = ? AND id = ? AND revoked = 0')
      .bind(sessionId, deviceId)
      .first()) as DeviceSession | null;
  }

  async createSession(session: DeviceSession): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO device_sessions
         (id, session_id, user_id, public_key, device_fingerprint, ip_address, country_code, trust_score, bound_at, expires_at, revoked)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, 0)`,
      )
      .bind(
        session.id, session.session_id, session.user_id,
        session.public_key, session.device_fingerprint,
        session.ip_address, session.country_code,
        session.trust_score, session.expires_at,
      )
      .run();
  }

  async updateTrustScore(deviceId: string, trustScore: number): Promise<void> {
    await this.db
      .prepare("UPDATE device_sessions SET trust_score = ?, last_verified_at = datetime('now') WHERE id = ?")
      .bind(trustScore, deviceId)
      .run();
  }

  async revokeSession(deviceId: string, reason: string): Promise<void> {
    await this.db
      .prepare('UPDATE device_sessions SET revoked = 1, revoked_reason = ? WHERE id = ?')
      .bind(reason, deviceId)
      .run();
  }

  async revokeUserSessions(userId: string): Promise<void> {
    await this.db
      .prepare("UPDATE device_sessions SET revoked = 1, revoked_reason = 'rebind' WHERE user_id = ? AND revoked = 0")
      .bind(userId)
      .run();
  }

  async listUserSessions(userId: string, limit: number): Promise<DeviceSession[]> {
    const result = await this.db
      .prepare('SELECT * FROM device_sessions WHERE user_id = ? ORDER BY bound_at DESC LIMIT ?')
      .bind(userId, limit)
      .all();
    return (result.results ?? []) as unknown as DeviceSession[];
  }

  async restoreTrust(deviceId: string, userId: string): Promise<void> {
    await this.db
      .prepare('UPDATE device_sessions SET trust_score = 100 WHERE id = ? AND user_id = ?')
      .bind(deviceId, userId)
      .run();
  }

  async hasNonce(nonce: string): Promise<boolean> {
    return (await this.kv.get(`nonce:${nonce}`)) !== null;
  }

  async storeNonce(nonce: string, ttlSeconds: number): Promise<void> {
    await this.kv.put(`nonce:${nonce}`, '1', { expirationTtl: ttlSeconds });
  }

  async logEvent(event: SecurityEvent & { id: string }): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO tf_security_events
         (id, session_id, user_id, event_type, ip_address, country_code, user_agent, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      )
      .bind(
        event.id, event.sessionId, event.userId, event.eventType,
        event.ipAddress, event.countryCode, event.userAgent,
        JSON.stringify(event.metadata),
      )
      .run();
  }

  async listEvents(userId: string, limit: number, offset: number): Promise<(SecurityEvent & { id: string; created_at: string })[]> {
    const result = await this.db
      .prepare('SELECT * FROM tf_security_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .bind(userId, limit, offset)
      .all();
    return (result.results ?? []) as unknown as (SecurityEvent & { id: string; created_at: string })[];
  }

  async createChallenge(challenge: StepUpChallengeRecord): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO step_up_challenges (id, session_id, user_id, reason, method, status, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        challenge.id, challenge.sessionId, challenge.userId,
        challenge.reason, challenge.method, challenge.status,
        challenge.expiresAt, challenge.createdAt,
      )
      .run();
  }

  async getChallenge(challengeId: string, userId: string): Promise<StepUpChallengeRecord | null> {
    return (await this.db
      .prepare("SELECT * FROM step_up_challenges WHERE id = ? AND user_id = ? AND status = 'pending'")
      .bind(challengeId, userId)
      .first()) as StepUpChallengeRecord | null;
  }

  async updateChallengeStatus(challengeId: string, status: string, completedAt?: string): Promise<void> {
    if (completedAt) {
      await this.db
        .prepare('UPDATE step_up_challenges SET status = ?, completed_at = ? WHERE id = ?')
        .bind(status, completedAt, challengeId)
        .run();
    } else {
      await this.db
        .prepare('UPDATE step_up_challenges SET status = ? WHERE id = ?')
        .bind(status, challengeId)
        .run();
    }
  }

  async countRecentChallenges(userId: string, windowMinutes: number): Promise<number> {
    const result = await this.db
      .prepare(
        `SELECT COUNT(*) as count FROM step_up_challenges
         WHERE user_id = ? AND created_at > datetime('now', '-' || ? || ' minutes')`,
      )
      .bind(userId, windowMinutes)
      .first();
    return (result as { count: number } | null)?.count ?? 0;
  }

  async updateBoundCookieHash(deviceId: string, hash: string, expiresAt: string): Promise<void> {
    await this.db
      .prepare('UPDATE device_sessions SET bound_cookie_hash = ?, bound_cookie_expires_at = ? WHERE id = ?')
      .bind(hash, expiresAt, deviceId)
      .run();
  }

  async getActivityHistogram(userId: string): Promise<{ buckets: number[]; totalRequests: number } | null> {
    const data = await this.kv.get(`tf:activity:${userId}`);
    return data ? JSON.parse(data) : null;
  }

  async setActivityHistogram(userId: string, histogram: { buckets: number[]; totalRequests: number }): Promise<void> {
    await this.kv.put(`tf:activity:${userId}`, JSON.stringify(histogram));
  }

  async storeOtp(challengeId: string, code: string, ttlSeconds: number): Promise<void> {
    await this.kv.put(`step_up_otp:${challengeId}`, code, { expirationTtl: ttlSeconds });
  }

  async getOtp(challengeId: string): Promise<string | null> {
    return this.kv.get(`step_up_otp:${challengeId}`);
  }

  async deleteOtp(challengeId: string): Promise<void> {
    await this.kv.delete(`step_up_otp:${challengeId}`);
  }
}
