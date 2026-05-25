import { describe, expect, it } from "vitest";
import { TokenCounter } from "./accounting.js";

describe("TokenCounter", () => {
  it("starts at zero", () => {
    expect(new TokenCounter().snapshot()).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cachedCalls: 0,
      billedCalls: 0,
    });
  });

  it("accumulates billed tokens", () => {
    const c = new TokenCounter();
    c.recordBilled(10, 20);
    c.recordBilled(3, 4);
    expect(c.snapshot()).toEqual({
      inputTokens: 13,
      outputTokens: 24,
      cachedCalls: 0,
      billedCalls: 2,
    });
  });

  it("recordCached does not change input/output tokens", () => {
    const c = new TokenCounter();
    c.recordBilled(5, 5);
    c.recordCached();
    c.recordCached();
    const s = c.snapshot();
    expect(s.inputTokens).toBe(5);
    expect(s.outputTokens).toBe(5);
    expect(s.cachedCalls).toBe(2);
    expect(s.billedCalls).toBe(1);
  });

  it("rejects negative token counts", () => {
    const c = new TokenCounter();
    expect(() => c.recordBilled(-1, 0)).toThrow();
    expect(() => c.recordBilled(0, -1)).toThrow();
  });

  it("reset zeros all fields", () => {
    const c = new TokenCounter();
    c.recordBilled(1, 1);
    c.recordCached();
    c.reset();
    expect(c.snapshot()).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cachedCalls: 0,
      billedCalls: 0,
    });
  });
});
