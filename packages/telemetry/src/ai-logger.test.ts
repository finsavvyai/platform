import { describe, expect, it } from "vitest";
import { InMemoryAiLogger } from "./ai-logger.js";
import type { AiExecutionEvent } from "./types.js";

const event = (overrides: Partial<AiExecutionEvent> = {}): AiExecutionEvent => ({
  traceId: "t",
  spanId: "s",
  provider: "anthropic",
  model: "claude-opus-4-7",
  promptTokens: 100,
  completionTokens: 50,
  latencyMs: 200,
  cost: 0.01,
  cacheHit: false,
  redacted: false,
  ...overrides,
});

describe("InMemoryAiLogger", () => {
  it("records and totals", () => {
    const log = new InMemoryAiLogger();
    log.record(event());
    log.record(event({ promptTokens: 200, cacheHit: true, cost: 0.02 }));
    expect(log.totals()).toEqual({
      promptTokens: 300,
      completionTokens: 100,
      cost: 0.03,
      cacheHits: 1,
    });
  });

  it("starts empty", () => {
    const log = new InMemoryAiLogger();
    expect(log.totals().promptTokens).toBe(0);
  });
});
