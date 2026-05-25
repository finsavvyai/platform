/**
 * @finsavvyai/cf-stack — KV cache utilities
 */

export interface KVCacheOptions {
  ttl?: number;
  prefix?: string;
}

export class KVCache {
  private kv: KVNamespace;
  private prefix: string;

  constructor(kv: KVNamespace, options: KVCacheOptions = {}) {
    this.kv = kv;
    this.prefix = options.prefix || '';
  }

  private key(k: string): string {
    return this.prefix ? `${this.prefix}:${k}` : k;
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.kv.get(this.key(key));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const options: KVNamespacePutOptions = {};
    if (ttl) options.expirationTtl = ttl;
    await this.kv.put(this.key(key), JSON.stringify(value), options);
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(this.key(key));
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }
}
