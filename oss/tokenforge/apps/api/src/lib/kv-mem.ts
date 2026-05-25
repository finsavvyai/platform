/**
 * Test-only minimal KVNamespace shim.
 *
 * Implements just `get`, `put`, `delete` — the surface
 * `KvChallengeStore` actually uses. TTL is honoured via wallclock
 * comparison against `expiresAt` carried inside the stored record.
 */

export class InMemoryKv {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const row = this.store.get(key);
    if (!row) return null;
    if (row.expiresAt && row.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return row.value;
  }

  async put(
    key: string,
    value: string,
    opts?: { expirationTtl?: number },
  ): Promise<void> {
    const expiresAt = opts?.expirationTtl ? Date.now() + opts.expirationTtl * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}
