import { vi } from "vitest";
import type { GatewayRequest, ModelRef, ProviderAdapter } from "./types.js";

export const frontierRef: ModelRef = {
  provider: "anthropic",
  model: "claude-opus-4-7",
  tier: "frontier",
  costPer1kInput: 15,
  costPer1kOutput: 75,
  latencyMsP50: 800,
};

export const fastRef: ModelRef = {
  provider: "openai",
  model: "gpt-4o-mini",
  tier: "fast",
  costPer1kInput: 0.15,
  costPer1kOutput: 0.6,
  latencyMsP50: 200,
};

export const baseReq: GatewayRequest = {
  tenantId: "t1",
  prompt: "hello world",
  tier: "frontier",
  maxTokens: 100,
};

export function mockAdapter(ref: ModelRef, text = "ok"): ProviderAdapter {
  return {
    ref,
    complete: vi.fn(async () => ({
      text,
      promptTokens: 10,
      completionTokens: 20,
    })),
  };
}

/** Retry config that skips real sleeping and yields zero jitter. */
export const noWait = { sleep: async () => {}, jitter: () => 0 };
