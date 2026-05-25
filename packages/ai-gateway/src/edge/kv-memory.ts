import type { KvStore } from "./types.js";

/**
 * In-memory `KvStore` implementation. Used in tests and as the default when
 * no Cloudflare KV binding is present. Bounded by lazy TTL eviction; not
 * intended for high-cardinality production traffic on a single instance.
 */
export class InMemoryKvStore implements KvStore {
  private readonly store = new Map<string, { value: string; expiresAt: number }>();
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (entry === undefined) return null;
    if (entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async put(
    key: string,
    value: string,
    opts: { expirationTtl: number },
  ): Promise<void> {
    if (opts.expirationTtl <= 0) {
      throw new Error("expirationTtl must be > 0 seconds");
    }
    this.store.set(key, {
      value,
      expiresAt: this.now() + opts.expirationTtl * 1000,
    });
  }

  /** Test helper: number of live entries (no TTL sweep). */
  size(): number {
    return this.store.size;
  }
}
