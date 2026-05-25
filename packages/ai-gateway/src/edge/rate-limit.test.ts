import { describe, expect, it } from "vitest";
import { InMemoryKvStore } from "./kv-memory.js";
import { RateLimiter, defaultKeyFor } from "./rate-limit.js";

describe("RateLimiter", () => {
  it("rejects invalid config", () => {
    const kv = new InMemoryKvStore();
    expect(() => new RateLimiter({ kv, config: { windowMs: 1000, maxRequests: 0 } })).toThrow(
      /maxRequests/u,
    );
    expect(() => new RateLimiter({ kv, config: { windowMs: 0, maxRequests: 5 } })).toThrow(
      /windowMs/u,
    );
  });

  it("allows up to maxRequests then denies", async () => {
    let t = 1_000_000;
    const kv = new InMemoryKvStore(() => t);
    const limiter = new RateLimiter({
      kv,
      config: { windowMs: 10_000, maxRequests: 3 },
      now: () => t,
    });
    const r1 = await limiter.check("k");
    const r2 = await limiter.check("k");
    const r3 = await limiter.check("k");
    const r4 = await limiter.check("k");
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
    expect(r4.allowed).toBe(false);
    expect(r1.remaining).toBe(2);
    expect(r4.remaining).toBe(0);
    expect(r4.limit).toBe(3);
  });

  it("resets after window expires", async () => {
    let t = 1_000_000;
    const kv = new InMemoryKvStore(() => t);
    const limiter = new RateLimiter({
      kv,
      config: { windowMs: 1_000, maxRequests: 2 },
      now: () => t,
    });
    await limiter.check("k");
    await limiter.check("k");
    expect((await limiter.check("k")).allowed).toBe(false);
    t += 5_000;
    const r = await limiter.check("k");
    expect(r.allowed).toBe(true);
  });

  it("computes resetEpochMs from oldest in-window timestamp", async () => {
    let t = 100;
    const kv = new InMemoryKvStore(() => t);
    const limiter = new RateLimiter({
      kv,
      config: { windowMs: 1_000, maxRequests: 5 },
      now: () => t,
    });
    const r = await limiter.check("k");
    expect(r.resetEpochMs).toBe(t + 1_000);
  });

  it("starts fresh when KV has no entry", async () => {
    const kv = new InMemoryKvStore();
    const limiter = new RateLimiter({
      kv,
      config: { windowMs: 1_000, maxRequests: 1 },
    });
    const r = await limiter.check("first");
    expect(r.allowed).toBe(true);
  });

  it("recovers from corrupt KV payload", async () => {
    const kv = new InMemoryKvStore();
    await kv.put("k", "{not-json", { expirationTtl: 60 });
    const limiter = new RateLimiter({ kv, config: { windowMs: 1000, maxRequests: 1 } });
    const r = await limiter.check("k");
    expect(r.allowed).toBe(true);
  });

  it("recovers from KV payload with wrong shape", async () => {
    const kv = new InMemoryKvStore();
    await kv.put("k", JSON.stringify({ timestamps: "nope" }), { expirationTtl: 60 });
    const limiter = new RateLimiter({ kv, config: { windowMs: 1000, maxRequests: 1 } });
    const r = await limiter.check("k");
    expect(r.allowed).toBe(true);
  });

  it("filters non-numeric timestamps from stored bucket", async () => {
    const t = 10_000;
    const kv = new InMemoryKvStore(() => t);
    // Two valid in-window timestamps plus garbage entries.
    await kv.put("k", JSON.stringify({ timestamps: [t - 100, "x", null, t - 50] }), {
      expirationTtl: 60,
    });
    const limiter = new RateLimiter({
      kv,
      config: { windowMs: 1_000, maxRequests: 10 },
      now: () => t,
    });
    const r = await limiter.check("k");
    // Two valid in-window timestamps kept; new request adds a third → 7 remaining.
    expect(r.remaining).toBe(7);
  });

  it("defaults `now` to Date.now when omitted", async () => {
    const kv = new InMemoryKvStore();
    const limiter = new RateLimiter({
      kv,
      config: { windowMs: 60_000, maxRequests: 2 },
    });
    const r = await limiter.check("k-default-now");
    expect(r.allowed).toBe(true);
    expect(r.resetEpochMs).toBeGreaterThan(Date.now());
  });
});

describe("defaultKeyFor", () => {
  it("builds a structured rate-limit key", () => {
    expect(defaultKeyFor("u1", "/v1/complete")).toBe("rl:u1:/v1/complete");
  });

  it("supports custom prefix", () => {
    expect(defaultKeyFor("u1", "/x", "edge")).toBe("edge:u1:/x");
  });
});
