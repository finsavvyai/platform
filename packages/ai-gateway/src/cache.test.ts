import { describe, expect, it } from "vitest";
import { InMemorySemanticCache, deriveCacheKey } from "./cache.js";
import type { GatewayResponse, ModelRef } from "./types.js";

const ref: ModelRef = { provider: "anthropic", model: "claude", tier: "frontier" };

function res(text: string): GatewayResponse {
  return {
    model: ref,
    text,
    promptTokens: 1,
    completionTokens: 1,
    inputTokens: 1,
    outputTokens: 1,
    cached: false,
    attempts: 1,
  };
}

describe("InMemorySemanticCache TTL", () => {
  it("returns value before expiry", async () => {
    let t = 0;
    const c = new InMemorySemanticCache({ ttlMs: 1000, now: () => t });
    await c.set("k", res("v"));
    t = 500;
    expect((await c.get("k"))?.text).toBe("v");
  });

  it("evicts after TTL on read", async () => {
    let t = 0;
    const c = new InMemorySemanticCache({ ttlMs: 1000, now: () => t });
    await c.set("k", res("v"));
    t = 1001;
    expect(await c.get("k")).toBeUndefined();
    expect(c.size()).toBe(0);
  });
});

describe("InMemorySemanticCache LRU", () => {
  it("evicts oldest when at capacity", async () => {
    const c = new InMemorySemanticCache({ maxEntries: 2, ttlMs: 60_000 });
    await c.set("a", res("A"));
    await c.set("b", res("B"));
    await c.set("c", res("C"));
    expect(await c.get("a")).toBeUndefined();
    expect((await c.get("b"))?.text).toBe("B");
    expect((await c.get("c"))?.text).toBe("C");
    expect(c.size()).toBe(2);
  });

  it("refreshes recency on get so MRU survives", async () => {
    const c = new InMemorySemanticCache({ maxEntries: 2, ttlMs: 60_000 });
    await c.set("a", res("A"));
    await c.set("b", res("B"));
    await c.get("a"); // touch a -> a becomes MRU, b becomes LRU
    await c.set("c", res("C"));
    expect((await c.get("a"))?.text).toBe("A");
    expect(await c.get("b")).toBeUndefined();
  });

  it("re-setting same key replaces and refreshes recency", async () => {
    const c = new InMemorySemanticCache({ maxEntries: 2, ttlMs: 60_000 });
    await c.set("a", res("A1"));
    await c.set("b", res("B"));
    await c.set("a", res("A2"));
    await c.set("c", res("C"));
    expect((await c.get("a"))?.text).toBe("A2");
    expect(await c.get("b")).toBeUndefined();
  });

  it("returns undefined for unknown key", async () => {
    const c = new InMemorySemanticCache();
    expect(await c.get("missing")).toBeUndefined();
  });

  it("rejects maxEntries < 1", () => {
    expect(() => new InMemorySemanticCache({ maxEntries: 0 })).toThrow();
  });
});

describe("deriveCacheKey", () => {
  it("normalizes whitespace + case", () => {
    expect(deriveCacheKey("m", "  Hello   World  ")).toBe(
      deriveCacheKey("m", "hello world"),
    );
  });

  it("keys differ per model", () => {
    expect(deriveCacheKey("a", "x")).not.toBe(deriveCacheKey("b", "x"));
  });

  it("keys differ per prompt", () => {
    expect(deriveCacheKey("m", "x")).not.toBe(deriveCacheKey("m", "y"));
  });

  it("key shape is `${model}:${hex}`", () => {
    const k = deriveCacheKey("m", "x");
    expect(k.startsWith("m:")).toBe(true);
    expect(k.slice(2)).toMatch(/^[0-9a-f]{64}$/);
  });
});
