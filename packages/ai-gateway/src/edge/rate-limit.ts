import type { KvStore, RateLimitDecision } from "./types.js";

/**
 * Sliding-window rate limiter backed by a `KvStore`. Stores per-key request
 * timestamps as a JSON-encoded sorted list, expires entries older than the
 * window, decides allow/deny by count.
 *
 * Design notes:
 *   - Window is enforced lazily on read (no background sweeper required).
 *   - `keyFor` is injected so callers can shape the key (per-IP, per-actor,
 *     per-route, or any composite).
 *   - KV writes use `expirationTtl = ceil(windowMs/1000) + 60` so stale
 *     entries auto-purge even if the key isn't read again.
 */

export type RateLimitConfig = {
  readonly windowMs: number;
  readonly maxRequests: number;
};

export type RateLimiterOptions = {
  readonly kv: KvStore;
  readonly config: RateLimitConfig;
  readonly now?: () => number;
};

type Bucket = { readonly timestamps: number[] };

export class RateLimiter {
  private readonly kv: KvStore;
  private readonly config: RateLimitConfig;
  private readonly now: () => number;

  constructor(opts: RateLimiterOptions) {
    if (opts.config.maxRequests < 1) {
      throw new Error("rate limit maxRequests must be >= 1");
    }
    if (opts.config.windowMs < 1) {
      throw new Error("rate limit windowMs must be >= 1");
    }
    this.kv = opts.kv;
    this.config = opts.config;
    this.now = opts.now ?? Date.now;
  }

  async check(key: string): Promise<RateLimitDecision> {
    const now = this.now();
    const windowStart = now - this.config.windowMs;

    const bucket = await this.readBucket(key);
    const kept = bucket.timestamps.filter((t) => t > windowStart);
    const allowed = kept.length < this.config.maxRequests;
    const next: Bucket = allowed
      ? { timestamps: [...kept, now] }
      : { timestamps: kept };

    await this.kv.put(key, JSON.stringify(next), {
      expirationTtl: Math.ceil(this.config.windowMs / 1000) + 60,
    });

    const oldest = next.timestamps[0];
    const resetEpochMs =
      oldest === undefined ? now + this.config.windowMs : oldest + this.config.windowMs;
    return {
      allowed,
      remaining: Math.max(0, this.config.maxRequests - next.timestamps.length),
      limit: this.config.maxRequests,
      resetEpochMs,
    };
  }

  private async readBucket(key: string): Promise<Bucket> {
    const raw = await this.kv.get(key);
    if (raw === null) return { timestamps: [] };
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        Array.isArray((parsed as { timestamps?: unknown }).timestamps)
      ) {
        const ts = (parsed as { timestamps: unknown[] }).timestamps.filter(
          (n): n is number => typeof n === "number" && Number.isFinite(n),
        );
        return { timestamps: ts };
      }
    } catch {
      // Corrupt entry — reset.
    }
    return { timestamps: [] };
  }
}

/** Build a rate-limit key per (actor, route). Falls back to ip for anonymous. */
export function defaultKeyFor(
  actorOrIp: string,
  route: string,
  prefix = "rl",
): string {
  return `${prefix}:${actorOrIp}:${route}`;
}
