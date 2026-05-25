/**
 * 100% line + branch coverage for `decideSlidingWindow`. Mesh §10
 * critical-path invariant: a wrong decision in this function is the
 * difference between accepting an abuser or locking out a paying
 * customer.
 */

import { describe, expect, it } from "vitest";
import { decideSlidingWindow } from "./sliding-window.js";
import type { RateLimitConfig } from "./types.js";

const cfg = (over: Partial<RateLimitConfig> = {}): RateLimitConfig => ({
  windowMs: 60_000,
  maxRequests: 5,
  ...over,
});

describe("decideSlidingWindow", () => {
  it("allows when history is empty", () => {
    const d = decideSlidingWindow(1_000_000, cfg(), []);
    expect(d.allowed).toBe(true);
    expect(d.reason).toBeUndefined();
    expect(d.retry_after_ms).toBeUndefined();
  });

  it("allows when in-window count is below max", () => {
    const now = 1_000_000;
    const d = decideSlidingWindow(now, cfg(), [now - 100, now - 200, now - 300]);
    expect(d.allowed).toBe(true);
  });

  it("denies at exact capacity and reports retry_after_ms", () => {
    const now = 1_000_000;
    const history = [now - 5_000, now - 4_000, now - 3_000, now - 2_000, now - 1_000];
    const d = decideSlidingWindow(now, cfg({ maxRequests: 5 }), history);
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("rate_limit.window_exceeded");
    // Oldest in-window was now-5000 → retry = 5000 + 60000 - now from oldest.
    // i.e. (now - 5000) + 60000 - now = 55000.
    expect(d.retry_after_ms).toBe(55_000);
  });

  it("returns retry_after_ms >= 1 when arithmetic would round to 0", () => {
    const now = 1_000_000;
    // History = exactly window-old → after pruning we are at capacity, retry≈0.
    const history = Array.from({ length: 5 }, (_, i) => now - 59_999 + i);
    const d = decideSlidingWindow(now, cfg({ maxRequests: 5 }), history);
    expect(d.allowed).toBe(false);
    expect((d.retry_after_ms ?? 0) >= 1).toBe(true);
  });

  it("prunes expired entries (older than windowMs)", () => {
    const now = 1_000_000;
    // 4 expired + 4 fresh → 4 in window, max 5 → allow.
    const history = [
      now - 120_000, now - 110_000, now - 100_000, now - 70_000,
      now - 100, now - 200, now - 300, now - 400,
    ];
    const d = decideSlidingWindow(now, cfg(), history);
    expect(d.allowed).toBe(true);
  });

  it("tolerates clock skew via skewMs (keeps entries slightly older than window)", () => {
    const now = 1_000_000;
    // Without skew this would prune; with skew=5000, it stays.
    const history = [now - 61_000, now - 100, now - 200];
    const without = decideSlidingWindow(now, cfg({ maxRequests: 3 }), history);
    expect(without.allowed).toBe(true); // count is 2 after prune, below max.
    const withSkew = decideSlidingWindow(now, cfg({ maxRequests: 3, skewMs: 5_000 }), history);
    expect(withSkew.allowed).toBe(false); // count is 3 (entry retained), denied.
  });

  it("clamps future-dated entries (clock skew on store) to now", () => {
    const now = 1_000_000;
    const future = now + 100_000; // 100s in the future
    const d = decideSlidingWindow(now, cfg({ maxRequests: 1 }), [future]);
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("rate_limit.window_exceeded");
  });

  it("drops non-finite timestamps defensively", () => {
    const now = 1_000_000;
    const history = [NaN, Infinity, -Infinity, now - 100];
    const d = decideSlidingWindow(now, cfg({ maxRequests: 2 }), history);
    expect(d.allowed).toBe(true);
  });

  it("returns config_invalid when windowMs <= 0", () => {
    expect(decideSlidingWindow(0, cfg({ windowMs: 0 }), []).reason).toBe(
      "rate_limit.config_invalid",
    );
    expect(decideSlidingWindow(0, cfg({ windowMs: -1 }), []).reason).toBe(
      "rate_limit.config_invalid",
    );
  });

  it("returns config_invalid when maxRequests <= 0", () => {
    expect(decideSlidingWindow(0, cfg({ maxRequests: 0 }), []).reason).toBe(
      "rate_limit.config_invalid",
    );
    expect(decideSlidingWindow(0, cfg({ maxRequests: -5 }), []).reason).toBe(
      "rate_limit.config_invalid",
    );
  });

  it("returns config_invalid when skewMs is negative or non-finite", () => {
    expect(decideSlidingWindow(0, cfg({ skewMs: -1 }), []).reason).toBe(
      "rate_limit.config_invalid",
    );
    expect(decideSlidingWindow(0, cfg({ skewMs: NaN }), []).reason).toBe(
      "rate_limit.config_invalid",
    );
  });

  it("returns config_invalid when now is non-finite", () => {
    expect(decideSlidingWindow(NaN, cfg(), []).reason).toBe(
      "rate_limit.config_invalid",
    );
    expect(decideSlidingWindow(Infinity, cfg(), []).reason).toBe(
      "rate_limit.config_invalid",
    );
  });

  it("treats windowMs of exactly Number.MAX_SAFE_INTEGER as valid", () => {
    const d = decideSlidingWindow(1_000_000, cfg({ windowMs: Number.MAX_SAFE_INTEGER }), []);
    expect(d.allowed).toBe(true);
  });

  it("denies with retry_after_ms = windowMs when oldest in-window entry is now", () => {
    const now = 1_000_000;
    const d = decideSlidingWindow(now, cfg({ maxRequests: 1 }), [now]);
    expect(d.allowed).toBe(false);
    expect(d.retry_after_ms).toBe(60_000);
  });
});
