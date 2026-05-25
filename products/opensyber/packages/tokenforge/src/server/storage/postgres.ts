import type { TokenForgeStorage, StepUpChallengeRecord } from './interface.js';
import type { DeviceSession, SecurityEvent } from '../../shared/types.js';

/** Generic SQL client interface — works with pg, postgres.js, Neon, etc. */
export interface PostgresClient {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

/**
 * PostgreSQL storage implementation.
 * Accepts any client that implements the simple { query } interface.
 * Nonces and OTPs are stored in the same DB (with expiry column).
 */
export class PostgresStorage implements TokenForgeStorage {
  constructor(private client: PostgresClient) {}

  async getSession(sessionId: string, deviceId: string): Promise<DeviceSession | null> {
    const { rows } = await this.client.query<DeviceSession>(
      'SELECT * FROM device_sessions WHERE session_id = $1 AND id = $2 AND revoked = 0',
      [sessionId, deviceId],
    );
    return rows[0] ?? null;
  }

  async createSession(session: DeviceSession): Promise<void> {
    await this.client.query(
      `INSERT INTO device_sessions
       (id, session_id, user_id, public_key, device_fingerprint, ip_address, country_code, trust_score, bound_at, expires_at, revoked)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, 0)`,
      [session.id, session.session_id, session.user_id, session.public_key,
       session.device_fingerprint, session.ip_address, session.country_code,
       session.trust_score, session.expires_at],
    );
  }

  async updateTrustScore(deviceId: string, trustScore: number): Promise<void> {
    await this.client.query(
      'UPDATE device_sessions SET trust_score = $1, last_verified_at = NOW() WHERE id = $2',
      [trustScore, deviceId],
    );
  }

  async revokeSession(deviceId: string, reason: string): Promise<void> {
    await this.client.query(
      'UPDATE device_sessions SET revoked = 1, revoked_reason = $1 WHERE id = $2',
      [reason, deviceId],
    );
  }

  async revokeUserSessions(userId: string): Promise<void> {
    await this.client.query(
      "UPDATE device_sessions SET revoked = 1, revoked_reason = 'rebind' WHERE user_id = $1 AND revoked = 0",
      [userId],
    );
  }

  async listUserSessions(userId: string, limit: number): Promise<DeviceSession[]> {
    const { rows } = await this.client.query<DeviceSession>(
      'SELECT * FROM device_sessions WHERE user_id = $1 ORDER BY bound_at DESC LIMIT $2',
      [userId, limit],
    );
    return rows;
  }

  async restoreTrust(deviceId: string, userId: string): Promise<void> {
    await this.client.query(
      'UPDATE device_sessions SET trust_score = 100 WHERE id = $1 AND user_id = $2',
      [deviceId, userId],
    );
  }

  async hasNonce(nonce: string): Promise<boolean> {
    const { rows } = await this.client.query(
      "SELECT 1 FROM tf_nonces WHERE nonce = $1 AND expires_at > NOW()",
      [nonce],
    );
    return rows.length > 0;
  }

  async storeNonce(nonce: string, ttlSeconds: number): Promise<void> {
    await this.client.query(
      "INSERT INTO tf_nonces (nonce, expires_at) VALUES ($1, NOW() + INTERVAL '1 second' * $2) ON CONFLICT DO NOTHING",
      [nonce, ttlSeconds],
    );
  }

  async logEvent(event: SecurityEvent & { id: string }): Promise<void> {
    await this.client.query(
      `INSERT INTO tf_security_events
       (id, session_id, user_id, event_type, ip_address, country_code, user_agent, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [event.id, event.sessionId, event.userId, event.eventType,
       event.ipAddress, event.countryCode, event.userAgent, JSON.stringify(event.metadata)],
    );
  }

  async listEvents(userId: string, limit: number, offset: number): Promise<(SecurityEvent & { id: string; created_at: string })[]> {
    const { rows } = await this.client.query<SecurityEvent & { id: string; created_at: string }>(
      'SELECT * FROM tf_security_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset],
    );
    return rows;
  }

  async createChallenge(challenge: StepUpChallengeRecord): Promise<void> {
    await this.client.query(
      `INSERT INTO step_up_challenges (id, session_id, user_id, reason, method, status, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [challenge.id, challenge.sessionId, challenge.userId, challenge.reason,
       challenge.method, challenge.status, challenge.expiresAt, challenge.createdAt],
    );
  }

  async getChallenge(challengeId: string, userId: string): Promise<StepUpChallengeRecord | null> {
    const { rows } = await this.client.query<StepUpChallengeRecord>(
      "SELECT * FROM step_up_challenges WHERE id = $1 AND user_id = $2 AND status = 'pending'",
      [challengeId, userId],
    );
    return rows[0] ?? null;
  }

  async updateChallengeStatus(challengeId: string, status: string, completedAt?: string): Promise<void> {
    if (completedAt) {
      await this.client.query(
        'UPDATE step_up_challenges SET status = $1, completed_at = $2 WHERE id = $3',
        [status, completedAt, challengeId],
      );
    } else {
      await this.client.query(
        'UPDATE step_up_challenges SET status = $1 WHERE id = $2',
        [status, challengeId],
      );
    }
  }

  async countRecentChallenges(userId: string, windowMinutes: number): Promise<number> {
    const { rows } = await this.client.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM step_up_challenges WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 minute' * $2",
      [userId, windowMinutes],
    );
    return parseInt(rows[0]?.count ?? '0', 10);
  }

  async updateBoundCookieHash(deviceId: string, hash: string, expiresAt: string): Promise<void> {
    await this.client.query(
      'UPDATE device_sessions SET bound_cookie_hash = $1, bound_cookie_expires_at = $2 WHERE id = $3',
      [hash, expiresAt, deviceId],
    );
  }

  async getActivityHistogram(userId: string): Promise<{ buckets: number[]; totalRequests: number } | null> {
    const { rows } = await this.client.query<{ histogram: string }>(
      'SELECT histogram FROM tf_activity_histograms WHERE user_id = $1',
      [userId],
    );
    return rows[0] ? JSON.parse(rows[0].histogram) : null;
  }

  async setActivityHistogram(userId: string, histogram: { buckets: number[]; totalRequests: number }): Promise<void> {
    await this.client.query(
      `INSERT INTO tf_activity_histograms (user_id, histogram, updated_at)
       VALUES ($1, $2, NOW()) ON CONFLICT (user_id) DO UPDATE SET histogram = $2, updated_at = NOW()`,
      [userId, JSON.stringify(histogram)],
    );
  }

  async storeOtp(challengeId: string, code: string, ttlSeconds: number): Promise<void> {
    await this.client.query(
      "INSERT INTO tf_otps (challenge_id, code, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 second' * $3) ON CONFLICT (challenge_id) DO UPDATE SET code = $2, expires_at = NOW() + INTERVAL '1 second' * $3",
      [challengeId, code, ttlSeconds],
    );
  }

  async getOtp(challengeId: string): Promise<string | null> {
    const { rows } = await this.client.query<{ code: string }>(
      'SELECT code FROM tf_otps WHERE challenge_id = $1 AND expires_at > NOW()',
      [challengeId],
    );
    return rows[0]?.code ?? null;
  }

  async deleteOtp(challengeId: string): Promise<void> {
    await this.client.query('DELETE FROM tf_otps WHERE challenge_id = $1', [challengeId]);
  }
}
