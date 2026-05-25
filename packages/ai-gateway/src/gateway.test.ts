import { describe, expect, it } from "vitest";
import { NoRouteError } from "./errors.js";
import { AiGateway } from "./gateway.js";
import { baseReq, fastRef, frontierRef, mockAdapter } from "./test-fixtures.js";

describe("AiGateway construction", () => {
  it("rejects empty adapter set", () => {
    expect(() => new AiGateway({ adapters: [] })).toThrow();
  });
});

describe("AiGateway happy path", () => {
  it("routes to tier match and returns tokens", async () => {
    const g = new AiGateway({
      adapters: [mockAdapter(fastRef), mockAdapter(frontierRef, "hi")],
    });
    const res = await g.complete(baseReq);
    expect(res.text).toBe("hi");
    expect(res.cached).toBe(false);
    expect(res.attempts).toBe(1);
    expect(res.inputTokens).toBe(10);
    expect(res.outputTokens).toBe(20);
    expect(res.model.provider).toBe("anthropic");
  });

  it("routes by explicit model name", async () => {
    const a = mockAdapter(fastRef, "fast");
    const b = mockAdapter(
      { ...fastRef, model: "gpt-4o", costPer1kInput: 2.5 },
      "big",
    );
    const g = new AiGateway({ adapters: [a, b] });
    const res = await g.complete({ ...baseReq, tier: "fast", model: "gpt-4o" });
    expect(res.text).toBe("big");
  });
});

describe("AiGateway routing errors", () => {
  it("NoRouteError when no tier matches", async () => {
    const g = new AiGateway({ adapters: [mockAdapter(fastRef)] });
    await expect(g.complete(baseReq)).rejects.toBeInstanceOf(NoRouteError);
  });

  it("NoRouteError when explicit model not found", async () => {
    const g = new AiGateway({ adapters: [mockAdapter(fastRef)] });
    await expect(
      g.complete({ ...baseReq, tier: "fast", model: "ghost" }),
    ).rejects.toBeInstanceOf(NoRouteError);
  });

  it("NoRouteError when policy cost cap excludes all", async () => {
    const g = new AiGateway({
      adapters: [mockAdapter(frontierRef)],
      policy: { maxCostPer1kInput: 1 },
    });
    await expect(g.complete(baseReq)).rejects.toBeInstanceOf(NoRouteError);
  });

  it("NoRouteError when policy latency cap excludes all", async () => {
    const g = new AiGateway({
      adapters: [mockAdapter(frontierRef)],
      policy: { maxLatencyMs: 100 },
    });
    await expect(g.complete(baseReq)).rejects.toBeInstanceOf(NoRouteError);
  });

  it("NoRouteError when preferProvider not in pool", async () => {
    const g = new AiGateway({
      adapters: [mockAdapter(frontierRef)],
      policy: { preferProvider: "openai" },
    });
    await expect(g.complete(baseReq)).rejects.toBeInstanceOf(NoRouteError);
  });
});
