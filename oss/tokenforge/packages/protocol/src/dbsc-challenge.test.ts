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
    if (r.consumed) return r;
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

  it('rejects sessionId mismatch when expected', async () => {
    const store = new MemStore();
    const issued = await issueChallenge(store, {
      tenantId: 't1', purpose: 'step_up', sessionId: 'sess-A',
    });
    const r = await consumeChallenge(store, issued.challenge, {
      tenantId: 't1', purpose: 'step_up', sessionId: 'sess-B',
    });
    expect(r).toEqual({ ok: false, reason: 'challenge_session_mismatch' });
  });
});
