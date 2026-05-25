import { describe, expect, it } from "vitest";
import { InMemoryAiLogger } from "./ai-logger.js";
import { REDACTED } from "./redact.js";
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

  it("scrubs token-shaped substrings in string fields", () => {
    const log = new InMemoryAiLogger();
    log.record(
      event({
        // Misuse: caller jammed a token into `model`. Must be scrubbed.
        model: "claude-opus-4-7 sk-ant-aaaaaaaaaaaaaaaa",
      }),
    );
    expect(log.events[0].model).not.toContain("sk-ant-aaaaaaaaaaaaaaaa");
    expect(log.events[0].model).toContain(REDACTED);
  });

  it("respects custom redactKeys for arbitrary extension fields", () => {
    const log = new InMemoryAiLogger({ redactKeys: ["prompt"] });
    // Cast: extension fields are common in practice via downstream wrappers.
    const ext = { ...event(), prompt: "user supplied secret prompt" } as unknown as AiExecutionEvent;
    log.record(ext);
    expect((log.events[0] as unknown as { prompt: string }).prompt).toBe(
      REDACTED,
    );
  });

  it("totals on empty logger returns zeros", () => {
    const log = new InMemoryAiLogger();
    expect(log.totals()).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      cost: 0,
      cacheHits: 0,
    });
  });
});
