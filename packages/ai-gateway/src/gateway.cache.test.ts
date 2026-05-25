import { describe, expect, it } from "vitest";
import { InMemorySemanticCache } from "./cache.js";
import { AiGateway } from "./gateway.js";
import { baseReq, frontierRef, mockAdapter } from "./test-fixtures.js";

describe("AiGateway cache + accounting integration", () => {
  it("cache hit does NOT count tokens", async () => {
    const cache = new InMemorySemanticCache();
    const a = mockAdapter(frontierRef, "cached");
    const g = new AiGateway({ adapters: [a], cache });
    await g.complete(baseReq);
    const before = g.usage();
    const second = await g.complete(baseReq);
    const after = g.usage();
    expect(second.cached).toBe(true);
    expect(after.inputTokens).toBe(before.inputTokens);
    expect(after.outputTokens).toBe(before.outputTokens);
    expect(after.cachedCalls).toBe(1);
    expect(a.complete).toHaveBeenCalledTimes(1);
  });

  it("token counter sums across distinct billed calls", async () => {
    const g = new AiGateway({ adapters: [mockAdapter(frontierRef)] });
    await g.complete(baseReq);
    await g.complete({ ...baseReq, prompt: "other prompt" });
    const u = g.usage();
    expect(u.inputTokens).toBe(20);
    expect(u.outputTokens).toBe(40);
    expect(u.billedCalls).toBe(2);
    expect(u.cachedCalls).toBe(0);
  });

  it("resetUsage zeros counters", async () => {
    const g = new AiGateway({ adapters: [mockAdapter(frontierRef)] });
    await g.complete(baseReq);
    g.resetUsage();
    expect(g.usage()).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cachedCalls: 0,
      billedCalls: 0,
    });
  });

  it("explicit cacheKey takes precedence over derived key", async () => {
    const cache = new InMemorySemanticCache();
    const g = new AiGateway({ adapters: [mockAdapter(frontierRef)], cache });
    await g.complete({ ...baseReq, cacheKey: "explicit-key" });
    const res = await g.complete({
      ...baseReq,
      prompt: "completely different prompt",
      cacheKey: "explicit-key",
    });
    expect(res.cached).toBe(true);
  });
});
