import type { KvStore } from "./types.js";

/**
 * HTTP-level response cache for the edge layer. Sibling to (not replacement
 * for) `InMemorySemanticCache` — that one caches structured `GatewayResponse`
 * objects keyed by normalized prompt; this one caches raw response bodies +
 * headers keyed by (method, path, query, actor) so identical requests skip
 * the gateway entirely.
 *
 * GET-only by default. POSTs are typically prompt completions and should be
 * served from the semantic cache inside `AiGateway`, not here.
 */

export type ResponseCacheConfig = {
  readonly ttlSeconds: number;
  /** If true, include actor id in cache key (per-actor cache). Default true. */
  readonly perActor?: boolean;
};

export type CachedResponse = {
  readonly status: number;
  readonly body: string;
  readonly contentType: string;
  readonly etag: string;
  readonly storedAtMs: number;
};

export class EdgeResponseCache {
  private readonly kv: KvStore;
  private readonly cfg: ResponseCacheConfig;
  private readonly now: () => number;

  constructor(kv: KvStore, cfg: ResponseCacheConfig, now: () => number = Date.now) {
    if (cfg.ttlSeconds < 1) throw new Error("ttlSeconds must be >= 1");
    this.kv = kv;
    this.cfg = cfg;
    this.now = now;
  }

  buildKey(method: string, path: string, query: string, actor: string): string {
    const includeActor = this.cfg.perActor !== false;
    const a = includeActor ? actor : "_";
    return `edgecache:${a}:${method}:${path}${query ? `?${query}` : ""}`;
  }

  async get(key: string): Promise<CachedResponse | null> {
    const raw = await this.kv.get(key);
    if (raw === null) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<CachedResponse>;
      if (
        typeof parsed.status === "number" &&
        typeof parsed.body === "string" &&
        typeof parsed.contentType === "string" &&
        typeof parsed.etag === "string" &&
        typeof parsed.storedAtMs === "number"
      ) {
        const ageMs = this.now() - parsed.storedAtMs;
        if (ageMs > this.cfg.ttlSeconds * 1000) return null;
        return parsed as CachedResponse;
      }
    } catch {
      // Corrupt — treat as miss.
    }
    return null;
  }

  async set(key: string, entry: Omit<CachedResponse, "storedAtMs">): Promise<void> {
    const full: CachedResponse = { ...entry, storedAtMs: this.now() };
    await this.kv.put(key, JSON.stringify(full), {
      expirationTtl: this.cfg.ttlSeconds,
    });
  }
}

/** Build an etag from a body string. Stable, non-cryptographic. */
export function buildEtag(body: string): string {
  // FNV-1a 32-bit. Fast, deterministic, no crypto.subtle required.
  let h = 0x811c9dc5;
  for (let i = 0; i < body.length; i++) {
    h ^= body.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Coerce to unsigned 32-bit and hex.
  return `"${(h >>> 0).toString(16).padStart(8, "0")}"`;
}
