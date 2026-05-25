import type { TokenForgeStorage, StepUpChallengeRecord } from './interface.js';
import type { DeviceSession, SecurityEvent } from '../../shared/types.js';

/**
 * TokenForge Cloud Storage — connects to the hosted API at tokenforge.opensyber.cloud.
 * This is the production storage backend for TokenForge SDK users.
 *
 * Requires a TokenForge API key (get one at https://tokenforge.opensyber.cloud/dashboard/settings).
 *
 * @param apiKey - Your TokenForge API key (starts with `tf_`).
 * @param options - Optional configuration (custom API base URL).
 */
export class CloudStorage implements TokenForgeStorage {
  private apiBase: string;
  private apiKey: string;

  constructor(apiKey: string, options?: { apiBase?: string }) {
    if (!apiKey || !apiKey.startsWith('tf_')) {
      throw new Error(
        'TokenForge: Invalid API key. Get one at https://tokenforge.opensyber.cloud/dashboard/settings',
      );
    }
    this.apiKey = apiKey;
    this.apiBase = options?.apiBase ?? 'https://tokenforge-api.opensyber.cloud';
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.apiBase}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      const msg = (err as { message?: string }).message ?? `API error ${res.status}`;
      throw new Error(`TokenForge Cloud: ${msg}`);
    }
    const json = await res.json();
    return (json as { data: T }).data;
  }

  async getSession(
    sessionId: string,
    deviceId: string,
  ): Promise<DeviceSession | null> {
    return this.request('POST', '/v1/storage/get-session', {
      sessionId,
      deviceId,
    });
  }

  async createSession(session: DeviceSession): Promise<void> {
    await this.request('POST', '/v1/storage/create-session', session);
  }

  async updateTrustScore(
    deviceId: string,
    trustScore: number,
  ): Promise<void> {
    await this.request('POST', '/v1/storage/update-trust', {
      deviceId,
      trustScore,
    });
  }

  async revokeSession(deviceId: string, reason: string): Promise<void> {
    await this.request('POST', '/v1/storage/revoke-session', {
      deviceId,
      reason,
    });
  }

  async revokeUserSessions(userId: string): Promise<void> {
    await this.request('POST', '/v1/storage/revoke-user-sessions', {
      userId,
    });
  }

  async listUserSessions(
    userId: string,
    limit: number,
  ): Promise<DeviceSession[]> {
    return this.request('POST', '/v1/storage/list-sessions', {
      userId,
      limit,
    });
  }

  async restoreTrust(deviceId: string, userId: string): Promise<void> {
    await this.request('POST', '/v1/storage/restore-trust', {
      deviceId,
      userId,
    });
  }

  async hasNonce(nonce: string): Promise<boolean> {
    return this.request('POST', '/v1/storage/has-nonce', { nonce });
  }

  async storeNonce(nonce: string, ttlSeconds: number): Promise<void> {
    await this.request('POST', '/v1/storage/store-nonce', {
      nonce,
      ttlSeconds,
    });
  }

  async logEvent(event: SecurityEvent & { id: string }): Promise<void> {
    await this.request('POST', '/v1/storage/log-event', event);
  }

  async listEvents(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<(SecurityEvent & { id: string; created_at: string })[]> {
    return this.request('POST', '/v1/storage/list-events', {
      userId,
      limit,
      offset,
    });
  }

  async createChallenge(challenge: StepUpChallengeRecord): Promise<void> {
    await this.request('POST', '/v1/storage/create-challenge', challenge);
  }

  async getChallenge(
    challengeId: string,
    userId: string,
  ): Promise<StepUpChallengeRecord | null> {
    return this.request('POST', '/v1/storage/get-challenge', {
      challengeId,
      userId,
    });
  }

  async updateChallengeStatus(
    challengeId: string,
    status: string,
    completedAt?: string,
  ): Promise<void> {
    await this.request('POST', '/v1/storage/update-challenge', {
      challengeId,
      status,
      completedAt,
    });
  }

  async countRecentChallenges(
    userId: string,
    windowMinutes: number,
  ): Promise<number> {
    return this.request('POST', '/v1/storage/count-challenges', {
      userId,
      windowMinutes,
    });
  }

  async updateBoundCookieHash(deviceId: string, hash: string, expiresAt: string): Promise<void> {
    await this.request('POST', '/v1/storage/update-bound-cookie-hash', { deviceId, hash, expiresAt });
  }

  async getActivityHistogram(userId: string): Promise<{ buckets: number[]; totalRequests: number } | null> {
    return this.request('POST', '/v1/storage/get-activity-histogram', { userId });
  }

  async setActivityHistogram(userId: string, histogram: { buckets: number[]; totalRequests: number }): Promise<void> {
    await this.request('POST', '/v1/storage/set-activity-histogram', { userId, histogram });
  }

  async storeOtp(
    challengeId: string,
    code: string,
    ttlSeconds: number,
  ): Promise<void> {
    await this.request('POST', '/v1/storage/store-otp', {
      challengeId,
      code,
      ttlSeconds,
    });
  }

  async getOtp(challengeId: string): Promise<string | null> {
    return this.request('POST', '/v1/storage/get-otp', { challengeId });
  }

  async deleteOtp(challengeId: string): Promise<void> {
    await this.request('POST', '/v1/storage/delete-otp', { challengeId });
  }
}
