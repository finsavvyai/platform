import { describe, it, expect, vi, beforeEach } from 'vitest';
import { D1Storage } from './d1.js';
import type { DeviceSession, SecurityEvent } from '../../shared/types.js';
import type { StepUpChallengeRecord } from './interface.js';

interface RecordedStmt { sql: string; params: unknown[]; verb: 'first' | 'all' | 'run' }

function makeD1(rowsFor: (sql: string) => unknown = () => null) {
  const calls: RecordedStmt[] = [];
  const prepare = vi.fn((sql: string) => {
    let params: unknown[] = [];
    return {
      bind: (...args: unknown[]) => {
        params = args;
        return {
          first: vi.fn(async () => { calls.push({ sql, params, verb: 'first' }); return rowsFor(sql) ?? null; }),
          all: vi.fn(async () => { calls.push({ sql, params, verb: 'all' }); return { results: (rowsFor(sql) as unknown[]) ?? [] }; }),
          run: vi.fn(async () => { calls.push({ sql, params, verb: 'run' }); return { success: true }; }),
        };
      },
    };
  });
  return { prepare, calls } as unknown as { prepare: typeof prepare; calls: RecordedStmt[] } & D1Database;
}

function makeKV() {
  const store = new Map<string, string>();
  return {
    _store: store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
    delete: vi.fn(async (key: string) => { store.delete(key); }),
  } as unknown as KVNamespace & { _store: Map<string, string> };
}

const mkSession = (over: Partial<DeviceSession> = {}): DeviceSession => ({
  id: 'dev_1', user_id: 'user_1', session_id: 'sess_1',
  public_key: '{"kty":"EC"}', metadata: {} as never, ip_address: '1.2.3.4',
  country_code: 'US', device_fingerprint: 'fp',
  bound_at: '2026-05-06T00:00:00Z', expires_at: '2026-05-07T00:00:00Z',
  trust_score: 100, last_verified_at: '2026-05-06T00:00:00Z', revoked: 0,
  ...over,
});

let db: ReturnType<typeof makeD1>;
let kv: ReturnType<typeof makeKV>;
let storage: D1Storage;

beforeEach(() => {
  db = makeD1();
  kv = makeKV();
  storage = new D1Storage(db, kv);
});

describe('D1Storage — sessions (D1 path)', () => {
  it('getSession SELECTs with session_id + id + revoked=0 (cross-session safety)', async () => {
    await storage.getSession('sess_1', 'dev_1');
    const c = db.calls[0]!;
    expect(c.sql).toContain('FROM device_sessions');
    expect(c.sql).toContain('session_id = ?');
    expect(c.sql).toContain('revoked = 0');
    expect(c.params).toEqual(['sess_1', 'dev_1']);
    expect(c.verb).toBe('first');
  });

  it('getSession returns null when D1 returns null', async () => {
    expect(await storage.getSession('s', 'd')).toBeNull();
  });

  it('createSession INSERTs with 9 positional binds in canonical order', async () => {
    await storage.createSession(mkSession());
    const c = db.calls[0]!;
    expect(c.sql).toContain('INSERT INTO device_sessions');
    expect(c.params).toEqual(['dev_1', 'sess_1', 'user_1', '{"kty":"EC"}', 'fp', '1.2.3.4', 'US', 100, '2026-05-07T00:00:00Z']);
    expect(c.verb).toBe('run');
  });

  it('updateTrustScore UPDATEs trust_score + last_verified_at by id', async () => {
    await storage.updateTrustScore('dev_1', 50);
    const c = db.calls[0]!;
    expect(c.sql).toContain("last_verified_at = datetime('now')");
    expect(c.params).toEqual([50, 'dev_1']);
  });

  it('revokeSession sets revoked=1 + revoked_reason', async () => {
    await storage.revokeSession('dev_1', 'manual');
    expect(db.calls[0]!.params).toEqual(['manual', 'dev_1']);
  });

  it('revokeUserSessions only touches active rows (revoked=0 in WHERE)', async () => {
    await storage.revokeUserSessions('user_1');
    const c = db.calls[0]!;
    expect(c.sql).toContain('revoked = 0');
    expect(c.params).toEqual(['user_1']);
  });

  it('listUserSessions ORDER BY bound_at DESC + LIMIT', async () => {
    db = makeD1(() => [mkSession(), mkSession({ id: 'dev_2', session_id: 'sess_2' })]);
    storage = new D1Storage(db, kv);
    const list = await storage.listUserSessions('user_1', 5);
    expect(list).toHaveLength(2);
    expect(db.calls[0]!.sql).toContain('ORDER BY bound_at DESC');
    expect(db.calls[0]!.params).toEqual(['user_1', 5]);
  });

  it('listUserSessions returns [] when results is missing/undefined', async () => {
    expect(await storage.listUserSessions('user_1', 5)).toEqual([]);
  });

  it('restoreTrust UPDATEs only when both id AND user_id match', async () => {
    await storage.restoreTrust('dev_1', 'user_1');
    const c = db.calls[0]!;
    expect(c.sql).toContain('id = ?');
    expect(c.sql).toContain('user_id = ?');
    expect(c.params).toEqual(['dev_1', 'user_1']);
  });
});

describe('D1Storage — KV path (nonces, OTPs)', () => {
  it('hasNonce reads kv with nonce: prefix', async () => {
    await storage.hasNonce('n1');
    expect(kv.get).toHaveBeenCalledWith('nonce:n1');
  });

  it('hasNonce true when KV returns non-null', async () => {
    kv._store.set('nonce:n1', '1');
    expect(await storage.hasNonce('n1')).toBe(true);
  });

  it('storeNonce uses expirationTtl from caller', async () => {
    await storage.storeNonce('n1', 60);
    expect(kv.put).toHaveBeenCalledWith('nonce:n1', '1', { expirationTtl: 60 });
  });

  it('OTP round-trip via KV with step_up_otp: prefix', async () => {
    await storage.storeOtp('c1', '123456', 30);
    expect(kv.put).toHaveBeenCalledWith('step_up_otp:c1', '123456', { expirationTtl: 30 });
    expect(await storage.getOtp('c1')).toBe('123456');
    await storage.deleteOtp('c1');
    expect(kv.delete).toHaveBeenCalledWith('step_up_otp:c1');
  });
});

describe('D1Storage — events + challenges', () => {
  it('logEvent INSERTs with metadata JSON-stringified', async () => {
    const event = { id: 'ev_1', userId: 'u1', sessionId: 's1', eventType: 'trust.block', metadata: { foo: 'bar' } } as SecurityEvent & { id: string };
    await storage.logEvent(event);
    const c = db.calls[0]!;
    expect(c.params[7]).toBe('{"foo":"bar"}');
  });

  it('listEvents ORDER BY created_at DESC + LIMIT/OFFSET', async () => {
    await storage.listEvents('user_1', 25, 50);
    expect(db.calls[0]!.sql).toContain('ORDER BY created_at DESC');
    expect(db.calls[0]!.params).toEqual(['user_1', 25, 50]);
  });

  it('getChallenge filters by status=pending (auth-bypass guard)', async () => {
    const challenge: StepUpChallengeRecord = { id: 'c1', userId: 'u1', sessionId: 's1', reason: 'r', method: 'sms', status: 'pending', expiresAt: 'x', createdAt: 'y' };
    db = makeD1(() => challenge);
    storage = new D1Storage(db, kv);
    await storage.getChallenge('c1', 'u1');
    expect(db.calls[0]!.sql).toContain("status = 'pending'");
    expect(db.calls[0]!.params).toEqual(['c1', 'u1']);
  });

  it('updateChallengeStatus 3-arg variant when completedAt present', async () => {
    await storage.updateChallengeStatus('c1', 'verified', '2026-05-06T00:00:00Z');
    expect(db.calls[0]!.params).toEqual(['verified', '2026-05-06T00:00:00Z', 'c1']);
    expect(db.calls[0]!.sql).toContain('completed_at = ?');
  });

  it('updateChallengeStatus 2-arg variant when completedAt omitted', async () => {
    await storage.updateChallengeStatus('c1', 'expired');
    expect(db.calls[0]!.params).toEqual(['expired', 'c1']);
    expect(db.calls[0]!.sql).not.toContain('completed_at');
  });

  it('countRecentChallenges parses count column from D1 result', async () => {
    db = makeD1(() => ({ count: 4 }));
    storage = new D1Storage(db, kv);
    expect(await storage.countRecentChallenges('user_1', 60)).toBe(4);
  });

  it('countRecentChallenges returns 0 when D1 returns null', async () => {
    expect(await storage.countRecentChallenges('user_1', 60)).toBe(0);
  });
});
