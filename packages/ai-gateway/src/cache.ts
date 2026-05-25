import { createHash } from "node:crypto";
import type { GatewayResponse, SemanticCache } from "./types.js";

export type CacheConfig = {
  /** Max entries retained. Default 256. Bounded (never unbounded). */
  readonly maxEntries?: number;
  /** TTL in ms. Default 5 minutes. */
  readonly ttlMs?: number;
  /** Clock injection for tests. Defaults to Date.now. */
  readonly now?: () => number;
};

type Entry = {
  readonly value: GatewayResponse;
  readonly expiresAt: number;
};

/**
 * Bounded LRU + TTL semantic cache. Keys are `(model, normalized_prompt_hash)`.
 *
 * Eviction order:
 *   1. Lazy TTL eviction on read.
 *   2. LRU eviction on write when at capacity (oldest insertion is evicted).
 *
 * Re-inserting an existing key refreshes its recency (moves to MRU).
 */
export class InMemorySemanticCache implements SemanticCache {
  private readonly store = new Map<string, Entry>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(cfg: CacheConfig = {}) {
    const max = cfg.maxEntries ?? 256;
    if (max < 1) throw new Error("cache maxEntries must be >= 1");
    this.maxEntries = max;
    this.ttlMs = cfg.ttlMs ?? 5 * 60 * 1000;
    this.now = cfg.now ?? Date.now;
  }

  async get(key: string): Promise<GatewayResponse | undefined> {
    const entry = this.store.get(key);
    if (entry === undefined) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return undefined;
    }
    // Refresh recency: re-insert moves key to end of Map iteration order.
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  async set(key: string, value: GatewayResponse): Promise<void> {
    if (this.store.has(key)) this.store.delete(key);
    while (this.store.size >= this.maxEntries) {
      // Map iteration order is insertion order; oldest key is first.
      const oldest = this.store.keys().next().value as string;
      this.store.delete(oldest);
    }
    this.store.set(key, {
      value,
      expiresAt: this.now() + this.ttlMs,
    });
  }

  size(): number {
    return this.store.size;
  }
}

/** Stable cache key from model id + normalized prompt. */
export function deriveCacheKey(model: string, prompt: string): string {
  const normalized = prompt.replace(/\s+/g, " ").trim().toLowerCase();
  const h = createHash("sha256").update(normalized).digest("hex");
  return `${model}:${h}`;
}
