import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeChallengeStore } from './challenge-store.js';
import type { Variables } from '../../types.js';
import type { ChallengeRecord } from '@opensyber/tokenforge/server/internal';

interface DbState {
  rows: Array<Record<string, unknown>>;
  inserts: Array<Record<string, unknown>>;
  updateChanges: number; // .meta.changes simulated value
}

function makeDb(state: DbState): Variables['db'] {
  return {
    insert: vi.fn(() => ({
      values: vi.fn(async (v: Record<string, unknown>) => { state.inserts.push(v); }),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => state.rows),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => ({ meta: { changes: state.updateChanges } })),
      })),
    })),
  } as unknown as Variables['db'];
}

const baseRecord = (over: Partial<ChallengeRecord> = {}): ChallengeRecord => ({
  id: 'ch_1',
  tenantId: 't1',
  challengeHash: 'hash_abc',
  purpose: 'register',
  sessionId: null,
  actionHash: null,
  issuedAt: '2026-05-04T00:00:00.000Z',
  expiresAt: '2026-05-04T00:05:00.000Z',
  consumed: false,
  ...over,
});

describe('challenge store — put', () => {
  let state: DbState;
  beforeEach(() => { state = { rows: [], inserts: [], updateChanges: 1 }; });

  it('persists all fields, mapping null sessionId/actionHash explicitly', async () => {
    const store = makeChallengeStore(makeDb(state));
    await store.put(baseRecord({ sessionId: undefined, actionHash: undefined }));
    expect(state.inserts).toHaveLength(1);
    expect(state.inserts[0]).toMatchObject({
      id: 'ch_1', tenantId: 't1', challengeHash: 'hash_abc',
      purpose: 'register', sessionId: null, actionHash: null,
      consumed: false,
    });
  });
});

describe('challenge store — takeIfFresh', () => {
  let state: DbState;
  beforeEach(() => { state = { rows: [], inserts: [], updateChanges: 1 }; });

  it('returns null when no row matches the hash', async () => {
    const store = makeChallengeStore(makeDb(state));
    const out = await store.takeIfFresh('hash_missing', new Date('2026-05-04T00:01:00Z'));
    expect(out).toBeNull();
  });

  it('returns null when the row has already expired', async () => {
    state.rows = [{
      id: 'ch_1', tenantId: 't1', challengeHash: 'hash_abc',
      purpose: 'register', sessionId: null, actionHash: null,
      issuedAt: '2026-05-04T00:00:00Z',
      expiresAt: '2026-05-04T00:00:30Z', // past at "now"
      consumed: false,
    }];
    const store = makeChallengeStore(makeDb(state));
    const result = await store.takeIfFresh('hash_abc', new Date('2026-05-04T00:01:00Z'));
    expect(result).toBeNull();
  });

  it('returns record with consumed=false on first take (guard reports 1 change)', async () => {
    state.rows = [{
      id: 'ch_1', tenantId: 't1', challengeHash: 'hash_abc',
      purpose: 'register', sessionId: null, actionHash: null,
      issuedAt: '2026-05-04T00:00:00Z',
      expiresAt: '2026-05-04T00:05:00Z',
      consumed: false,
    }];
    state.updateChanges = 1;
    const store = makeChallengeStore(makeDb(state));
    const out = await store.takeIfFresh('hash_abc', new Date('2026-05-04T00:01:00Z'));
    expect(out).not.toBeNull();
    expect(out!.consumed).toBe(false);
  });

  it('returns record with consumed=true when guard reports 0 changes (race lost — already consumed)', async () => {
    state.rows = [{
      id: 'ch_1', tenantId: 't1', challengeHash: 'hash_abc',
      purpose: 'register', sessionId: null, actionHash: null,
      issuedAt: '2026-05-04T00:00:00Z',
      expiresAt: '2026-05-04T00:05:00Z',
      consumed: false,
    }];
    state.updateChanges = 0; // another worker beat us to it
    const store = makeChallengeStore(makeDb(state));
    const out = await store.takeIfFresh('hash_abc', new Date('2026-05-04T00:01:00Z'));
    expect(out).not.toBeNull();
    expect(out!.consumed).toBe(true);
  });

  it('returns record with consumed=true when the row was already marked consumed pre-update (replay)', async () => {
    state.rows = [{
      id: 'ch_1', tenantId: 't1', challengeHash: 'hash_abc',
      purpose: 'register', sessionId: null, actionHash: null,
      issuedAt: '2026-05-04T00:00:00Z',
      expiresAt: '2026-05-04T00:05:00Z',
      consumed: true, // already spent
    }];
    state.updateChanges = 0;
    const store = makeChallengeStore(makeDb(state));
    const out = await store.takeIfFresh('hash_abc', new Date('2026-05-04T00:01:00Z'));
    expect(out).not.toBeNull();
    expect(out!.consumed).toBe(true);
  });

  it('preserves sessionId/actionHash on the returned record (used by callers)', async () => {
    state.rows = [{
      id: 'ch_1', tenantId: 't1', challengeHash: 'hash_abc',
      purpose: 'refresh', sessionId: 'sess_42', actionHash: 'sha:body-hash',
      issuedAt: '2026-05-04T00:00:00Z',
      expiresAt: '2026-05-04T00:05:00Z',
      consumed: false,
    }];
    state.updateChanges = 1;
    const store = makeChallengeStore(makeDb(state));
    const out = await store.takeIfFresh('hash_abc', new Date('2026-05-04T00:01:00Z'));
    expect(out!.sessionId).toBe('sess_42');
    expect(out!.actionHash).toBe('sha:body-hash');
    expect(out!.purpose).toBe('refresh');
  });

  it('falls back to wasConsumed when driver omits meta.changes (consumed=false → first take ok)', async () => {
    // Some Drizzle drivers / D1 binding versions don't return `meta.changes`.
    // The source falls back to `wasConsumed ? 0 : 1` so the same guarded
    // logic still works. Pin the fallback path: row not previously
    // consumed AND no meta → treated as a successful first take.
    const dbNoMeta = {
      insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{
              id: 'ch_1', tenantId: 't1', challengeHash: 'hash_abc',
              purpose: 'register', sessionId: null, actionHash: null,
              issuedAt: '2026-05-04T00:00:00Z', expiresAt: '2026-05-04T00:05:00Z',
              consumed: false,
            }]),
          })),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn(async () => ({})) })), // NO meta key
      })),
    } as unknown as Variables['db'];
    const store = makeChallengeStore(dbNoMeta);
    const out = await store.takeIfFresh('hash_abc', new Date('2026-05-04T00:01:00Z'));
    expect(out).not.toBeNull();
    expect(out!.consumed).toBe(false);
  });

  it('meta-omitted driver + wasConsumed=true → returns consumed=true (replay detection still works)', async () => {
    const dbNoMeta = {
      insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{
              id: 'ch_1', tenantId: 't1', challengeHash: 'hash_abc',
              purpose: 'register', sessionId: null, actionHash: null,
              issuedAt: '2026-05-04T00:00:00Z', expiresAt: '2026-05-04T00:05:00Z',
              consumed: true, // already spent
            }]),
          })),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn(async () => ({})) })),
      })),
    } as unknown as Variables['db'];
    const store = makeChallengeStore(dbNoMeta);
    const out = await store.takeIfFresh('hash_abc', new Date('2026-05-04T00:01:00Z'));
    expect(out!.consumed).toBe(true);
  });
});
