import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PostgresStorage, type PostgresClient } from './postgres.js';
import type { DeviceSession, SecurityEvent } from '../../shared/types.js';

interface RecordedCall { sql: string; params?: unknown[] }

function makeClient(rowsFor: (sql: string) => unknown[] = () => []): PostgresClient & { calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  return {
    calls,
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return { rows: rowsFor(sql) as never[] };
    }),
  } as unknown as PostgresClient & { calls: RecordedCall[] };
}

const mkSession = (over: Partial<DeviceSession> = {}): DeviceSession => ({
  id: 'dev_1', user_id: 'user_1', session_id: 'sess_1',
  public_key: '{"kty":"EC"}', metadata: {} as never, ip_address: '1.2.3.4',
  country_code: 'US', device_fingerprint: 'fp',
  bound_at: '2026-05-06T00:00:00Z', expires_at: '2026-05-07T00:00:00Z',
  trust_score: 100, last_verified_at: '2026-05-06T00:00:00Z', revoked: 0,
  ...over,
});

let storage: PostgresStorage;
let client: ReturnType<typeof makeClient>;

beforeEach(() => {
  client = makeClient();
  storage = new PostgresStorage(client);
});

describe('PostgresStorage — sessions', () => {
  it('getSession SELECTs with session_id + id + revoked=0 (cross-session safety baked into SQL)', async () => {
    await storage.getSession('sess_1', 'dev_1');
    const c = client.calls[0]!;
    expect(c.sql).toContain('FROM device_sessions');
    expect(c.sql).toContain('session_id = $1');
    expect(c.sql).toContain('id = $2');
    expect(c.sql).toContain('revoked = 0');
    expect(c.params).toEqual(['sess_1', 'dev_1']);
  });

  it('getSession returns null when no rows', async () => {
    expect(await storage.getSession('sess_1', 'dev_1')).toBeNull();
  });

  it('getSession returns the first row when present', async () => {
    client = makeClient(() => [mkSession()]);
    storage = new PostgresStorage(client);
    const r = await storage.getSession('sess_1', 'dev_1');
    expect(r?.id).toBe('dev_1');
  });

  it('createSession INSERTs with positional params 1..9 in canonical order', async () => {
    await storage.createSession(mkSession());
    const c = client.calls[0]!;
    expect(c.sql).toMatch(/INSERT INTO device_sessions/);
    expect(c.params).toEqual(['dev_1', 'sess_1', 'user_1', '{"kty":"EC"}', 'fp', '1.2.3.4', 'US', 100, '2026-05-07T00:00:00Z']);
  });

  it('updateTrustScore UPDATEs trust_score + last_verified_at by id', async () => {
    await storage.updateTrustScore('dev_1', 50);
    const c = client.calls[0]!;
    expect(c.sql).toContain('UPDATE device_sessions');
    expect(c.sql).toContain('trust_score = $1');
    expect(c.sql).toContain('last_verified_at = NOW()');
    expect(c.params).toEqual([50, 'dev_1']);
  });

  it('revokeSession sets revoked=1 + revoked_reason', async () => {
    await storage.revokeSession('dev_1', 'manual');
    expect(client.calls[0]!.params).toEqual(['manual', 'dev_1']);
    expect(client.calls[0]!.sql).toContain('revoked = 1');
  });

  it('revokeUserSessions only touches active rows (revoked = 0 in WHERE)', async () => {
    await storage.revokeUserSessions('user_1');
    const c = client.calls[0]!;
    expect(c.sql).toContain('WHERE user_id = $1');
    expect(c.sql).toContain('revoked = 0');
    expect(c.params).toEqual(['user_1']);
  });

  it('listUserSessions ORDER BY bound_at DESC + LIMIT', async () => {
    await storage.listUserSessions('user_1', 10);
    const c = client.calls[0]!;
    expect(c.sql).toContain('ORDER BY bound_at DESC');
    expect(c.sql).toContain('LIMIT $2');
    expect(c.params).toEqual(['user_1', 10]);
  });

  it('restoreTrust UPDATEs only when both id AND user_id match (cross-tenant guard in SQL)', async () => {
    await storage.restoreTrust('dev_1', 'user_1');
    const c = client.calls[0]!;
    expect(c.sql).toContain('id = $1');
    expect(c.sql).toContain('user_id = $2');
    expect(c.params).toEqual(['dev_1', 'user_1']);
  });
});

describe('PostgresStorage — nonces', () => {
  it('hasNonce SELECTs with expires_at > NOW() filter', async () => {
    await storage.hasNonce('n1');
    expect(client.calls[0]!.sql).toContain('expires_at > NOW()');
    expect(client.calls[0]!.params).toEqual(['n1']);
  });

  it('hasNonce returns true when at least one row exists', async () => {
    client = makeClient(() => [{ '?column?': 1 }]);
    storage = new PostgresStorage(client);
    expect(await storage.hasNonce('n1')).toBe(true);
  });

  it('storeNonce uses ON CONFLICT DO NOTHING (idempotent insert)', async () => {
    await storage.storeNonce('n1', 60);
    expect(client.calls[0]!.sql).toContain('ON CONFLICT DO NOTHING');
    expect(client.calls[0]!.params).toEqual(['n1', 60]);
  });
});

describe('PostgresStorage — events + challenges + OTP', () => {
  const event = (): SecurityEvent & { id: string } => ({
    id: 'ev_1', userId: 'user_1', sessionId: 'sess_1', deviceId: 'dev_1',
    eventType: 'trust.block', metadata: { foo: 'bar' },
  } as never);

  it('logEvent INSERTs with metadata JSON-stringified', async () => {
    await storage.logEvent(event());
    const c = client.calls[0]!;
    expect(c.sql).toContain('INSERT INTO tf_security_events');
    const params = c.params!;
    // metadata is always the 8th positional arg ($8)
    expect(params[7]).toBe('{"foo":"bar"}');
  });

  it('listEvents ORDER BY created_at DESC + LIMIT/OFFSET', async () => {
    await storage.listEvents('user_1', 25, 50);
    expect(client.calls[0]!.sql).toContain('ORDER BY created_at DESC');
    expect(client.calls[0]!.params).toEqual(['user_1', 25, 50]);
  });

  it('getChallenge filters by id + user_id + status=pending (auth-bypass guard)', async () => {
    await storage.getChallenge('c1', 'user_1');
    const c = client.calls[0]!;
    expect(c.sql).toContain("status = 'pending'");
    expect(c.params).toEqual(['c1', 'user_1']);
  });

  it('updateChallengeStatus runs the 3-arg UPDATE when completedAt is supplied', async () => {
    await storage.updateChallengeStatus('c1', 'verified', '2026-05-06T00:00:00Z');
    expect(client.calls[0]!.params).toEqual(['verified', '2026-05-06T00:00:00Z', 'c1']);
    expect(client.calls[0]!.sql).toContain('completed_at = $2');
  });

  it('updateChallengeStatus runs the 2-arg UPDATE when completedAt is omitted', async () => {
    await storage.updateChallengeStatus('c1', 'expired');
    expect(client.calls[0]!.params).toEqual(['expired', 'c1']);
    expect(client.calls[0]!.sql).not.toContain('completed_at');
  });

  it('countRecentChallenges parses string COUNT result back to number', async () => {
    client = makeClient(() => [{ count: '7' }]);
    storage = new PostgresStorage(client);
    expect(await storage.countRecentChallenges('user_1', 60)).toBe(7);
  });

  it('storeOtp uses ON CONFLICT DO UPDATE (upsert)', async () => {
    await storage.storeOtp('c1', '123456', 60);
    expect(client.calls[0]!.sql).toContain('ON CONFLICT (challenge_id) DO UPDATE');
  });

  it('getOtp returns the code when found, null otherwise', async () => {
    client = makeClient(() => [{ code: '123456' }]);
    storage = new PostgresStorage(client);
    expect(await storage.getOtp('c1')).toBe('123456');
  });

  it('deleteOtp issues DELETE by challenge_id', async () => {
    await storage.deleteOtp('c1');
    expect(client.calls[0]!.sql).toContain('DELETE FROM tf_otps');
    expect(client.calls[0]!.params).toEqual(['c1']);
  });
});
