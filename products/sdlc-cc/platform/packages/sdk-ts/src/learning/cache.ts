// Self-learning SDK cache — LRU in-memory cache with adaptive TTL

export interface CachedResponse<T = unknown> {
  data: T;
  status: number;
  cachedAt: number;
  ttl: number;
  hits: number;
}

export interface CacheOptions {
  maxEntries: number;
  defaultTTL: number;
}

const DEFAULT_OPTIONS: CacheOptions = {
  maxEntries: 1000,
  defaultTTL: 60_000, // 60 seconds
};

/**
 * LRU cache for SDK responses.
 * Keys are SHA-256 hashes of endpoint + params.
 */
export class SDKCache {
  private readonly entries = new Map<string, CachedResponse>();
  private readonly accessOrder: string[] = [];
  private readonly options: CacheOptions;

  constructor(options: Partial<CacheOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Retrieve a cached response if it exists and hasn't expired.
   */
  get<T = unknown>(key: string): CachedResponse<T> | null {
    const entry = this.entries.get(key) as CachedResponse<T> | undefined;
    if (!entry) return null;

    const age = Date.now() - entry.cachedAt;
    if (age > entry.ttl) {
      this.entries.delete(key);
      this.removeFromAccessOrder(key);
      return null;
    }

    entry.hits += 1;
    this.promoteInAccessOrder(key);
    return entry;
  }

  /**
   * Store a response in cache with an optional TTL override.
   */
  set<T = unknown>(
    key: string,
    data: T,
    status: number,
    ttl?: number,
  ): void {
    if (this.entries.size >= this.options.maxEntries && !this.entries.has(key)) {
      this.evict();
    }

    const entry: CachedResponse<T> = {
      data,
      status,
      cachedAt: Date.now(),
      ttl: ttl ?? this.options.defaultTTL,
      hits: 0,
    };

    this.entries.set(key, entry as CachedResponse);
    this.promoteInAccessOrder(key);
  }

  /**
   * Build a deterministic cache key from endpoint and params.
   * Uses a simple FNV-1a-inspired hash (sync, no crypto dependency).
   */
  buildKey(
    endpoint: string,
    params: Record<string, unknown> = {},
  ): string {
    const sortedParams = this.sortObject(params);
    const raw = `${endpoint}|${JSON.stringify(sortedParams)}`;
    return this.fnv1aHash(raw);
  }

  /**
   * Evict the least recently used entry.
   */
  evict(): void {
    if (this.accessOrder.length === 0) return;
    const oldest = this.accessOrder.shift();
    if (oldest) {
      this.entries.delete(oldest);
    }
  }

  /**
   * Remove all expired entries.
   */
  prune(): number {
    const now = Date.now();
    let pruned = 0;

    for (const [key, entry] of this.entries) {
      if (now - entry.cachedAt > entry.ttl) {
        this.entries.delete(key);
        this.removeFromAccessOrder(key);
        pruned += 1;
      }
    }

    return pruned;
  }

  /**
   * Invalidate a specific key or all keys matching a prefix.
   */
  invalidate(keyOrPrefix: string): number {
    if (this.entries.has(keyOrPrefix)) {
      this.entries.delete(keyOrPrefix);
      this.removeFromAccessOrder(keyOrPrefix);
      return 1;
    }

    let removed = 0;
    for (const key of [...this.entries.keys()]) {
      if (key.startsWith(keyOrPrefix)) {
        this.entries.delete(key);
        this.removeFromAccessOrder(key);
        removed += 1;
      }
    }
    return removed;
  }

  /** Clear entire cache. */
  clear(): void {
    this.entries.clear();
    this.accessOrder.length = 0;
  }

  /** Current number of cached entries. */
  get size(): number {
    return this.entries.size;
  }

  // --- Private helpers ---

  private promoteInAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const idx = this.accessOrder.indexOf(key);
    if (idx !== -1) {
      this.accessOrder.splice(idx, 1);
    }
  }

  private sortObject(obj: Record<string, unknown>): Record<string, unknown> {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      const val = obj[key];
      sorted[key] =
        val && typeof val === "object" && !Array.isArray(val)
          ? this.sortObject(val as Record<string, unknown>)
          : val;
    }
    return sorted;
  }

  /**
   * FNV-1a 32-bit hash — fast, deterministic, no async needed.
   */
  private fnv1aHash(str: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  }
}
