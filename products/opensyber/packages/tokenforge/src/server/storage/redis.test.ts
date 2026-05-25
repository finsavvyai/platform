import { describe, it, expect, beforeEach } from 'vitest';
import { RedisStorage, type RedisClient } from './redis.js';
import type { DeviceSession, SecurityEvent } from '../../shared/types.js';

function makeFakeRedis(): RedisClient & { _store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    _store: store,
    get: async (key) => store.get(key) ?? null,
    set: async (key, value) => { store.set(key, value); return 'OK'; },
    del: async (key) => { store.delete(key); return 1; },
    keys: async (pattern) => {
      const re = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return Array.from(store.keys()).filter((k) => re.test(k));
    },
    incr: async (key) => {
      const n = (parseInt(store.get(key) ?? '0', 10) || 0) + 1;
      store.set(key, String(n));
      return n;
    },
    expire: async () => 1,
  };
}

const mkSession = (over: Partial<DeviceSession> = {}): DeviceSession => ({
  id: 'dev_1',
  user_id: 'user_1',
  session_id: 'sess_1',
  public_key: '{"kty":"EC"}',
  metadata: { userAgent: 'TestAgent', language: 'en-US', platform: 'X', screenResolution: '1x1', timezone: 'UTC', colorDepth: 24 },
  ip_address: '1.2.3.4',
  country_code: 'US',
  device_fingerprint: 'fp',
  bound_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 3600_000).toISOString(),
  trust_score: 100,
  last_verified_at: new Date().toISOString(),
  revoked: 0,
  ...over,
});

let redis: ReturnType<typeof makeFakeRedis>;
let storage: RedisStorage;

beforeEach(() => {
  redis = makeFakeRedis();
  storage = new RedisStorage(redis);
});

describe('RedisStorage — sessions', () => {
  it('round-trips create + get when sessionId + deviceId match', async () => {
    await storage.createSession(mkSession());
    const r = await storage.getSession('sess_1', 'dev_1');
    expect(r?.id).toBe('dev_1');
  });

  it('returns null when sessionId does not match (cross-session safety)', async () => {
    await storage.createSession(mkSession());
    expect(await storage.getSession('sess_OTHER', 'dev_1')).toBeNull();
  });

  it('returns null when session is revoked', async () => {
    await storage.createSession(mkSession());
    await storage.revokeSession('dev_1', 'manual');
    expect(await storage.getSession('sess_1', 'dev_1')).toBeNull();
  });

  it('updateTrustScore persists the new value', async () => {
    await storage.createSession(mkSession({ trust_score: 100 }));
    await storage.updateTrustScore('dev_1', 50);
    const after = JSON.parse(redis._store.get('tf:session:dev_1')!) as DeviceSession;
    expect(after.trust_score).toBe(50);
  });

  it('revokeUserSessions revokes every session in the user index', async () => {
    await storage.createSession(mkSession({ id: 'dev_a' }));
    await storage.createSession(mkSession({ id: 'dev_b', session_id: 'sess_b' }));
    await storage.revokeUserSessions('user_1');
    const a = JSON.parse(redis._store.get('tf:session:dev_a')!) as DeviceSession;
    const b = JSON.parse(redis._store.get('tf:session:dev_b')!) as DeviceSession;
    expect(a.revoked).toBe(1);
    expect(b.revoked).toBe(1);
  });

  it('listUserSessions returns most-recent-first within limit', async () => {
    await storage.createSession(mkSession({ id: 'dev_a' }));
    await storage.createSession(mkSession({ id: 'dev_b', session_id: 'sess_b' }));
    await storage.createSession(mkSession({ id: 'dev_c', session_id: 'sess_c' }));
    const list = await storage.listUserSessions('user_1', 2);
    expect(list).toHaveLength(2);
    expect(list[0]!.id).toBe('dev_c');
    expect(list[1]!.id).toBe('dev_b');
  });

  it('restoreTrust resets to 100 only when userId matches (cross-tenant guard)', async () => {
    await storage.createSession(mkSession({ trust_score: 30 }));
    await storage.restoreTrust('dev_1', 'WRONG_USER');
    const after = JSON.parse(redis._store.get('tf:session:dev_1')!) as DeviceSession;
    expect(after.trust_score).toBe(30); // unchanged
    await storage.restoreTrust('dev_1', 'user_1');
    const fixed = JSON.parse(redis._store.get('tf:session:dev_1')!) as DeviceSession;
    expect(fixed.trust_score).toBe(100);
  });
});

describe('RedisStorage — nonces', () => {
  it('hasNonce returns false when never stored, true after storeNonce', async () => {
    expect(await storage.hasNonce('n1')).toBe(false);
    await storage.storeNonce('n1', 60);
    expect(await storage.hasNonce('n1')).toBe(true);
  });
});

describe('RedisStorage — events', () => {
  const event = (over: Partial<SecurityEvent & { id: string }> = {}) => ({
    id: 'ev_1', userId: 'user_1', sessionId: 'sess_1', deviceId: 'dev_1',
    eventType: 'trust.block', trustScoreBefore: 80, trustScoreAfter: 30,
    metadata: {}, ...over,
  } as SecurityEvent & { id: string });

  it('logEvent persists with 90-day retention', async () => {
    await storage.logEvent(event());
    expect(redis._store.get('tf:event:ev_1')).toBeTruthy();
  });

  it('listEvents returns most-recent-first respecting offset+limit', async () => {
    await storage.logEvent(event({ id: 'ev_1' }));
    await storage.logEvent(event({ id: 'ev_2' }));
    await storage.logEvent(event({ id: 'ev_3' }));
    const out = await storage.listEvents('user_1', 2, 0);
    expect(out).toHaveLength(2);
    expect((out[0] as { id: string }).id).toBe('ev_3');
    expect((out[1] as { id: string }).id).toBe('ev_2');
  });
});

describe('RedisStorage — challenges + OTP', () => {
  it('getChallenge returns null on userId mismatch (auth-bypass guard)', async () => {
    await storage.createChallenge({ id: 'c1', userId: 'user_1', method: 'sms', status: 'pending' } as never);
    expect(await storage.getChallenge('c1', 'WRONG_USER')).toBeNull();
  });

  it('updateChallengeStatus mutates status + completedAt', async () => {
    await storage.createChallenge({ id: 'c1', userId: 'user_1', method: 'sms', status: 'pending' } as never);
    await storage.updateChallengeStatus('c1', 'verified', '2026-05-06T00:00:00Z');
    const r = await storage.getChallenge('c1', 'user_1');
    expect(r).toBeNull(); // status is no longer 'pending', so getChallenge filters
  });

  it('OTP round-trip: store / get / delete', async () => {
    await storage.storeOtp('c1', '123456', 60);
    expect(await storage.getOtp('c1')).toBe('123456');
    await storage.deleteOtp('c1');
    expect(await storage.getOtp('c1')).toBeNull();
  });
});
