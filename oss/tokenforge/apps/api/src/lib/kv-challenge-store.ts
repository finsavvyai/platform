/**
 * Cloudflare KV-backed `ChallengeStore` for the DBSC nonce flow.
 *
 * Keys are namespaced `ch:<challengeHash>`. KV `expirationTtl` does
 * the bulk eviction; `takeIfFresh` still re-checks `expiresAt` to
 * catch the window where KV has not yet propagated TTL eviction
 * across colos.
 */

import type { ChallengeStore, ChallengeRecord } from '@tokenforge/protocol';

const KEY_PREFIX = 'ch:';
const RETAIN_AFTER_USE_SECONDS = 90;

export class KvChallengeStore implements ChallengeStore {
  constructor(private readonly kv: KVNamespace) {}

  async put(record: ChallengeRecord): Promise<void> {
    const ttl = Math.max(60, ttlSeconds(record));
    await this.kv.put(KEY_PREFIX + record.challengeHash, JSON.stringify(record), {
      expirationTtl: ttl,
    });
  }

  async takeIfFresh(hash: string, now: Date): Promise<ChallengeRecord | null> {
    const raw = await this.kv.get(KEY_PREFIX + hash);
    if (!raw) return null;
    const record = JSON.parse(raw) as ChallengeRecord;
    if (new Date(record.expiresAt) < now) {
      await this.kv.delete(KEY_PREFIX + hash);
      return null;
    }
    if (record.consumed) return record;
    const consumed: ChallengeRecord = { ...record, consumed: true };
    await this.kv.put(KEY_PREFIX + hash, JSON.stringify(consumed), {
      expirationTtl: RETAIN_AFTER_USE_SECONDS,
    });
    return record;
  }
}

function ttlSeconds(record: ChallengeRecord): number {
  const issued = new Date(record.issuedAt).getTime();
  const expires = new Date(record.expiresAt).getTime();
  return Math.ceil((expires - issued) / 1000) + RETAIN_AFTER_USE_SECONDS;
}
