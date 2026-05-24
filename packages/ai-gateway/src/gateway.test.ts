import { describe, expect, it, vi } from "vitest";
import { InMemorySemanticCache } from "./cache.js";
import { AiGateway } from "./gateway.js";
import type {
  GatewayRequest,
  ModelRef,
  ProviderAdapter,
} from "./types.js";

const ref: ModelRef = { provider: "anthropic", model: "claude-opus-4-7", tier: "frontier" };

const req: GatewayRequest = {
  tenantId: "t1",
  prompt: "hi",
  tier: "frontier",
  maxTokens: 100,
  cacheKey: "k1",
};

const okAdapter = (text = "ok"): ProviderAdapter => ({
  ref,
  complete: vi.fn(async () => ({
    text,
    promptTokens: 1,
    completionTokens: 1,
  })),
});

describe("AiGateway", () => {
  it("rejects empty adapter set", () => {
    expect(() => new AiGateway({ adapters: [] })).toThrow();
  });

  it("completes via adapter", async () => {
    const g = new AiGateway({ adapters: [okAdapter("hello")] });
    const res = await g.complete(req);
    expect(res.text).toBe("hello");
    expect(res.cached).toBe(false);
    expect(res.attempts).toBe(1);
  });

  it("retries on failure", async () => {
    let calls = 0;
    const adapter: ProviderAdapter = {
      ref,
      complete: vi.fn(async () => {
        calls += 1;
        if (calls < 2) throw new Error("flaky");
        return { text: "ok", promptTokens: 1, completionTokens: 1 };
      }),
    };
    const g = new AiGateway({ adapters: [adapter], maxAttempts: 3 });
    const res = await g.complete(req);
    expect(res.attempts).toBe(2);
  });

  it("returns cached response", async () => {
    const cache = new InMemorySemanticCache();
    const g = new AiGateway({ adapters: [okAdapter("first")], cache });
    await g.complete(req);
    const res = await g.complete(req);
    expect(res.cached).toBe(true);
  });
});
