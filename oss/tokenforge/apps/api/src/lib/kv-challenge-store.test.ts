import { describe, it, expect } from 'vitest';
import { issueChallenge, consumeChallenge } from '@tokenforge/protocol';
import { KvChallengeStore } from './kv-challenge-store.js';
import { InMemoryKv } from './kv-mem.js';

describe('KvChallengeStore', () => {
  it('round-trips an issued challenge once', async () => {
    const kv = new InMemoryKv();
    const store = new KvChallengeStore(kv as unknown as KVNamespace);
    const issued = await issueChallenge(store, { tenantId: 't1', purpose: 'register' });
    const r = await consumeChallenge(store, issued.challenge, {
      tenantId: 't1',
      purpose: 'register',
    });
    expect(r.ok).toBe(true);
  });

  it('rejects replay against the same KV row', async () => {
    const kv = new InMemoryKv();
    const store = new KvChallengeStore(kv as unknown as KVNamespace);
    const issued = await issueChallenge(store, { tenantId: 't1', purpose: 'refresh' });
    const a = await consumeChallenge(store, issued.challenge, {
      tenantId: 't1',
      purpose: 'refresh',
    });
    const b = await consumeChallenge(store, issued.challenge, {
      tenantId: 't1',
      purpose: 'refresh',
    });
    expect(a.ok).toBe(true);
    expect(b).toEqual({ ok: false, reason: 'challenge_replay' });
  });
});
