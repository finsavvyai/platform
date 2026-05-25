/**
 * Shared test helpers for TokenForge sample projects.
 * Provides MemoryStorage and mock crypto for testing.
 */
import { MemoryStorage } from '@opensyber/tokenforge/storage';
import type { DeviceSession } from '@opensyber/tokenforge/shared';

export { MemoryStorage };

/** Create a pre-seeded MemoryStorage with a bound device session. */
export function createSeededStorage(overrides?: Partial<DeviceSession>): {
  storage: MemoryStorage;
  session: DeviceSession;
} {
  const storage = new MemoryStorage();
  const now = new Date();
  const session: DeviceSession = {
    id: 'device-001',
    session_id: 'session-001',
    user_id: 'user-001',
    public_key: '{}',
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
  storage.sessions.push(session);
  return { storage, session };
}

/** Create expired session for testing expiry handling. */
export function createExpiredStorage(): {
  storage: MemoryStorage;
  session: DeviceSession;
} {
  return createSeededStorage({
    expires_at: new Date(Date.now() - 3600000).toISOString(),
  });
}

/** Create revoked session for testing revocation handling. */
export function createRevokedStorage(): {
  storage: MemoryStorage;
  session: DeviceSession;
} {
  return createSeededStorage({ revoked: 1, revoked_reason: 'admin_revoked' });
}
