// Unit tests for the Rate-limit Durable Object (I-002 fix).
// Strong consistency is inherent to the DO runtime — here we just verify
// the in-memory counter logic is correct across the 60s window.
// License: Apache-2.0

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RateLimiterDO, checkRateLimit } from "./rate-limit-do";

function makeState(): never {
  return {
    storage: { get: async () => undefined },
  } as unknown as never;
}

describe("RateLimiterDO.incrAndCheck", () => {
  let do_: RateLimiterDO;

  beforeEach(() => {
    do_ = new RateLimiterDO(makeState());
  });

  it("allows the first N calls and blocks the N+1st", () => {
    for (let i = 0; i < 5; i++) {
      const r = do_.incrAndCheck("1.2.3.4", 5);
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(4 - i);
    }
    const blocked = do_.incrAndCheck("1.2.3.4", 5);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("tracks counters per IP independently", () => {
    for (let i = 0; i < 3; i++) do_.incrAndCheck("1.1.1.1", 3);
    const blockedA = do_.incrAndCheck("1.1.1.1", 3);
    const allowedB = do_.incrAndCheck("2.2.2.2", 3);
    expect(blockedA.allowed).toBe(false);
    expect(allowedB.allowed).toBe(true);
  });

  it("resets the window after 60s", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00Z"));
    for (let i = 0; i < 3; i++) do_.incrAndCheck("1.2.3.4", 3);
    expect(do_.incrAndCheck("1.2.3.4", 3).allowed).toBe(false);
    vi.setSystemTime(new Date("2026-04-17T00:01:01Z")); // +61s
    expect(do_.incrAndCheck("1.2.3.4", 3).allowed).toBe(true);
    vi.useRealTimers();
  });
});

describe("RateLimiterDO.fetch HTTP adapter", () => {
  it("returns 400 on missing ip/limit", async () => {
    const do_ = new RateLimiterDO(makeState());
    const res = await do_.fetch(
      new Request("https://x/incr", {
        method: "POST",
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 405 on GET", async () => {
    const do_ = new RateLimiterDO(makeState());
    const res = await do_.fetch(new Request("https://x/incr", { method: "GET" }));
    expect(res.status).toBe(405);
  });

  it("round-trips via checkRateLimit helper", async () => {
    const do_ = new RateLimiterDO(makeState());
    const stub = {
      fetch: (url: string, init?: RequestInit) => do_.fetch(new Request(url, init)),
    };
    const r1 = await checkRateLimit(stub, "5.5.5.5", 2);
    expect(r1.allowed).toBe(true);
    const r2 = await checkRateLimit(stub, "5.5.5.5", 2);
    expect(r2.allowed).toBe(true);
    const r3 = await checkRateLimit(stub, "5.5.5.5", 2);
    expect(r3.allowed).toBe(false);
  });
});

afterEach(() => {
  vi.useRealTimers();
});
