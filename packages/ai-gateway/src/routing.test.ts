import { describe, expect, it, vi } from "vitest";
import { NoRouteError } from "./errors.js";
import { selectAdapter } from "./routing.js";
import type { GatewayRequest, ModelRef, ProviderAdapter } from "./types.js";

function mk(ref: ModelRef): ProviderAdapter {
  return {
    ref,
    complete: vi.fn(async () => ({ text: "", promptTokens: 0, completionTokens: 0 })),
  };
}

const fast: ModelRef = {
  provider: "openai",
  model: "gpt-4o-mini",
  tier: "fast",
  costPer1kInput: 0.15,
  latencyMsP50: 200,
};
const frontier: ModelRef = {
  provider: "anthropic",
  model: "claude-opus-4-7",
  tier: "frontier",
  costPer1kInput: 15,
  latencyMsP50: 800,
};
const frontierCheap: ModelRef = {
  provider: "google",
  model: "gemini-pro",
  tier: "frontier",
  costPer1kInput: 7,
  latencyMsP50: 400,
};

const req = (over: Partial<GatewayRequest> = {}): GatewayRequest => ({
  tenantId: "t",
  prompt: "p",
  tier: "frontier",
  maxTokens: 10,
  ...over,
});

describe("selectAdapter", () => {
  it("throws NoRouteError when adapter list is empty", () => {
    expect(() => selectAdapter([], req())).toThrow(NoRouteError);
  });

  it("matches by tier, picks first", () => {
    const a = selectAdapter([mk(fast), mk(frontier), mk(frontierCheap)], req());
    expect(a.ref.provider).toBe("anthropic");
  });

  it("filters by explicit model name", () => {
    const a = selectAdapter(
      [mk(frontier), mk(frontierCheap)],
      req({ model: "gemini-pro" }),
    );
    expect(a.ref.provider).toBe("google");
  });

  it("NoRouteError when model not found at all", () => {
    expect(() =>
      selectAdapter([mk(frontier)], req({ model: "missing" })),
    ).toThrow(NoRouteError);
  });

  it("respects preferProvider policy", () => {
    const a = selectAdapter(
      [mk(frontier), mk(frontierCheap)],
      req(),
      { preferProvider: "google" },
    );
    expect(a.ref.provider).toBe("google");
  });

  it("NoRouteError when preferProvider absent in tier pool", () => {
    expect(() =>
      selectAdapter([mk(frontier)], req(), { preferProvider: "openai" }),
    ).toThrow(NoRouteError);
  });

  it("respects cost cap", () => {
    const a = selectAdapter(
      [mk(frontier), mk(frontierCheap)],
      req(),
      { maxCostPer1kInput: 10 },
    );
    expect(a.ref.provider).toBe("google");
  });

  it("excludes adapters missing cost metadata under cost cap", () => {
    const noCost: ModelRef = { provider: "local", model: "x", tier: "frontier" };
    expect(() =>
      selectAdapter([mk(noCost)], req(), { maxCostPer1kInput: 100 }),
    ).toThrow(NoRouteError);
  });

  it("respects latency cap", () => {
    const a = selectAdapter(
      [mk(frontier), mk(frontierCheap)],
      req(),
      { maxLatencyMs: 500 },
    );
    expect(a.ref.provider).toBe("google");
  });

  it("excludes adapters missing latency metadata under latency cap", () => {
    const noLat: ModelRef = { provider: "local", model: "x", tier: "frontier" };
    expect(() =>
      selectAdapter([mk(noLat)], req(), { maxLatencyMs: 9999 }),
    ).toThrow(NoRouteError);
  });

  it("NoRouteError when tier missing", () => {
    expect(() => selectAdapter([mk(fast)], req())).toThrow(NoRouteError);
  });
});
