import { describe, it, expect } from 'vitest';
import {
  issueChallenge,
  consumeChallenge,
  type ChallengeRecord,
  type ChallengeStore,
} from './dbsc-challenge.js';

class MemStore implements ChallengeStore {
  records = new Map<string, ChallengeRecord>();
  async put(r: ChallengeRecord): Promise<void> {
    this.records.set(r.challengeHash, r);
  }
  async takeIfFresh(hash: string, now: Date): Promise<ChallengeRecord | null> {
    const r = this.records.get(hash);
    if (!r) return null;
    if (new Date(r.expiresAt) < now) return null;
    if (r.consumed) return r; // simulate consumed-flag returning the row
    r.consumed = true;
    return { ...r, consumed: false };
  }
}

describe('issueChallenge / consumeChallenge', () => {
  it('issues a base64url challenge and consumes it once', async () => {
    const store = new MemStore();
    const issued = await issueChallenge(store, { tenantId: 't1', purpose: 'register' });
    expect(issued.challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    const result = await consumeChallenge(store, issued.challenge, {
      tenantId: 't1',
      purpose: 'register',
    });
    expect(result.ok).toBe(true);
  });

  it('rejects malformed challenge', async () => {
    const store = new MemStore();
    const r = await consumeChallenge(store, '!!!not-base64!!!', {
      tenantId: 't1',
      purpose: 'register',
    });
    expect(r).toEqual({ ok: false, reason: 'malformed_challenge' });
  });

  it('rejects unknown challenge', async () => {
    const store = new MemStore();
    const r = await consumeChallenge(store, 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', {
      tenantId: 't1',
      purpose: 'register',
    });
    expect(r.ok).toBe(false);
  });

  it('rejects challenge replay', async () => {
    const store = new MemStore();
    const issued = await issueChallenge(store, { tenantId: 't1', purpose: 'refresh' });
    await consumeChallenge(store, issued.challenge, { tenantId: 't1', purpose: 'refresh' });
    const second = await consumeChallenge(store, issued.challenge, {
      tenantId: 't1',
      purpose: 'refresh',
    });
    expect(second).toEqual({ ok: false, reason: 'challenge_replay' });
  });

  it('rejects tenant mismatch', async () => {
    const store = new MemStore();
    const issued = await issueChallenge(store, { tenantId: 'a', purpose: 'register' });
    const r = await consumeChallenge(store, issued.challenge, {
      tenantId: 'b',
      purpose: 'register',
    });
    expect(r).toEqual({ ok: false, reason: 'challenge_tenant_mismatch' });
  });

  it('rejects purpose mismatch', async () => {
    const store = new MemStore();
    const issued = await issueChallenge(store, { tenantId: 't1', purpose: 'register' });
    const r = await consumeChallenge(store, issued.challenge, {
      tenantId: 't1',
      purpose: 'refresh',
    });
    expect(r).toEqual({ ok: false, reason: 'challenge_purpose_mismatch' });
  });

  it('respects custom ttlSeconds', async () => {
    const store = new MemStore();
    const r = await issueChallenge(store, { tenantId: 't1', purpose: 'register', ttlSeconds: 1 });
    const issued = new Date(r.record.issuedAt).getTime();
    const expires = new Date(r.record.expiresAt).getTime();
    expect(expires - issued).toBe(1000);
  });

  it('rejects with challenge_session_mismatch when expected.sessionId differs from stored', async () => {
    const store = new MemStore();
    const issued = await issueChallenge(store, { tenantId: 't1', purpose: 'refresh', sessionId: 'tf-dbsc-1' });
    const r = await consumeChallenge(store, issued.challenge, {
      tenantId: 't1', purpose: 'refresh', sessionId: 'tf-dbsc-OTHER',
    });
    expect(r).toEqual({ ok: false, reason: 'challenge_session_mismatch' });
  });

  it('issued challenge encodes 32 random bytes (43 base64url chars, no padding)', async () => {
    const store = new MemStore();
    const issued = await issueChallenge(store, { tenantId: 't1', purpose: 'register' });
    expect(issued.challenge).toHaveLength(43);
    expect(issued.challenge).not.toContain('=');
    expect(issued.challenge).not.toContain('+');
    expect(issued.challenge).not.toContain('/');
  });

  it('record.id is a UUID v4 (RFC 4122 8-4-4-4-12 hex)', async () => {
    const store = new MemStore();
    const issued = await issueChallenge(store, { tenantId: 't1', purpose: 'register' });
    expect(issued.record.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('default TTL is 60 seconds when ttlSeconds is omitted', async () => {
    const store = new MemStore();
    const r = await issueChallenge(store, { tenantId: 't1', purpose: 'register' });
    const ttlMs = new Date(r.record.expiresAt).getTime() - new Date(r.record.issuedAt).getTime();
    expect(ttlMs).toBe(60_000);
  });

  it('stores SHA-256 hash of challenge bytes, NOT the value itself (DB-leak protection)', async () => {
    const store = new MemStore();
    const issued = await issueChallenge(store, { tenantId: 't1', purpose: 'register' });
    expect(issued.record.challengeHash).not.toBe(issued.challenge);
    // Hash format = base64url of 32-byte SHA-256 = 43 chars
    expect(issued.record.challengeHash).toHaveLength(43);
  });

  it('two issuances produce different challenges + different hashes (CSPRNG entropy)', async () => {
    const store = new MemStore();
    const a = await issueChallenge(store, { tenantId: 't1', purpose: 'register' });
    const b = await issueChallenge(store, { tenantId: 't1', purpose: 'register' });
    expect(a.challenge).not.toBe(b.challenge);
    expect(a.record.challengeHash).not.toBe(b.record.challengeHash);
    expect(a.record.id).not.toBe(b.record.id);
  });

  it('expired record returns challenge_unknown_or_expired (takeIfFresh returns null past expiresAt)', async () => {
    const store = new MemStore();
    const issued = await issueChallenge(store, { tenantId: 't1', purpose: 'register', ttlSeconds: 1 });
    // Force the stored record to be expired by overriding expiresAt
    const stored = store.records.get(issued.record.challengeHash)!;
    stored.expiresAt = new Date(Date.now() - 1000).toISOString();
    const r = await consumeChallenge(store, issued.challenge, { tenantId: 't1', purpose: 'register' });
    expect(r).toEqual({ ok: false, reason: 'challenge_unknown_or_expired' });
  });

  it('actionHash input flows through to the stored record (per-action binding)', async () => {
    const store = new MemStore();
    const issued = await issueChallenge(store, {
      tenantId: 't1', purpose: 'step_up', actionHash: 'sha256-of-transfer-body-base64url',
    });
    expect(issued.record.actionHash).toBe('sha256-of-transfer-body-base64url');
    // Also defaults to null when omitted (column-shape contract)
    const noAction = await issueChallenge(store, { tenantId: 't1', purpose: 'register' });
    expect(noAction.record.actionHash).toBeNull();
  });

  it('sessionId match: consume succeeds when expected.sessionId equals record.sessionId', async () => {
    const store = new MemStore();
    const issued = await issueChallenge(store, {
      tenantId: 't1', purpose: 'refresh', sessionId: 'tf-dbsc-42',
    });
    const r = await consumeChallenge(store, issued.challenge, {
      tenantId: 't1', purpose: 'refresh', sessionId: 'tf-dbsc-42',
    });
    expect(r.ok).toBe(true);
  });

  it('sessionId omitted by caller: skips the check entirely (allows cross-session use of generic challenge)', async () => {
    // Source line 86: `if (expected.sessionId && ...)` — the check is OPT-IN.
    // A challenge issued with sessionId='X' is consumable by a caller that
    // doesn't pass sessionId, supporting cases where the consumer hasn't yet
    // been bound to a specific session (e.g. register flow before sessionId exists).
    const store = new MemStore();
    const issued = await issueChallenge(store, {
      tenantId: 't1', purpose: 'register', sessionId: 'tf-dbsc-pending',
    });
    const r = await consumeChallenge(store, issued.challenge, {
      tenantId: 't1', purpose: 'register', // no sessionId in expected
    });
    expect(r.ok).toBe(true);
  });
});
