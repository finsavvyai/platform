import { describe, expect, it } from "vitest";
import { parseCompletionBody } from "./parse-completion.js";
import { EdgeBadRequestError } from "./errors.js";

const tenant = "t-1";

describe("parseCompletionBody", () => {
  it("parses a minimal valid body", () => {
    const req = parseCompletionBody(
      { prompt: "hi", tier: "fast", maxTokens: 10 },
      tenant,
    );
    expect(req.tenantId).toBe(tenant);
    expect(req.prompt).toBe("hi");
    expect(req.tier).toBe("fast");
    expect(req.maxTokens).toBe(10);
    expect(req.model).toBeUndefined();
  });

  it("propagates optional fields when present", () => {
    const req = parseCompletionBody(
      {
        prompt: "hi",
        tier: "frontier",
        maxTokens: 100,
        model: "claude-3",
        cacheKey: "k",
        idempotencyKey: "i",
      },
      tenant,
    );
    expect(req.model).toBe("claude-3");
    expect(req.cacheKey).toBe("k");
    expect(req.idempotencyKey).toBe("i");
  });

  it("rejects non-object body", () => {
    expect(() => parseCompletionBody(null, tenant)).toThrow(EdgeBadRequestError);
    expect(() => parseCompletionBody("string", tenant)).toThrow(EdgeBadRequestError);
    expect(() => parseCompletionBody(42, tenant)).toThrow(EdgeBadRequestError);
  });

  it("rejects missing/empty prompt", () => {
    expect(() => parseCompletionBody({ tier: "fast", maxTokens: 1 }, tenant)).toThrow(
      /prompt/u,
    );
    expect(() =>
      parseCompletionBody({ prompt: "", tier: "fast", maxTokens: 1 }, tenant),
    ).toThrow(/prompt/u);
  });

  it("rejects oversized prompt", () => {
    const big = "x".repeat(100_001);
    expect(() =>
      parseCompletionBody({ prompt: big, tier: "fast", maxTokens: 1 }, tenant),
    ).toThrow(/100k/u);
  });

  it("rejects invalid tier", () => {
    expect(() =>
      parseCompletionBody({ prompt: "x", tier: "ultra", maxTokens: 1 }, tenant),
    ).toThrow(/tier/u);
  });

  it("rejects non-integer maxTokens", () => {
    expect(() =>
      parseCompletionBody({ prompt: "x", tier: "fast", maxTokens: 1.5 }, tenant),
    ).toThrow(/maxTokens/u);
    expect(() =>
      parseCompletionBody({ prompt: "x", tier: "fast", maxTokens: "10" }, tenant),
    ).toThrow(/maxTokens/u);
  });

  it("rejects maxTokens out of range", () => {
    expect(() =>
      parseCompletionBody({ prompt: "x", tier: "fast", maxTokens: 0 }, tenant),
    ).toThrow(/range/u);
    expect(() =>
      parseCompletionBody({ prompt: "x", tier: "fast", maxTokens: 100_000 }, tenant),
    ).toThrow(/range/u);
  });

  it("rejects non-string optional fields", () => {
    expect(() =>
      parseCompletionBody(
        { prompt: "x", tier: "fast", maxTokens: 1, model: 7 },
        tenant,
      ),
    ).toThrow(/model/u);
  });

  it("treats empty string optional as undefined", () => {
    const req = parseCompletionBody(
      { prompt: "x", tier: "fast", maxTokens: 1, model: "" },
      tenant,
    );
    expect(req.model).toBeUndefined();
  });

  it("rejects oversize optional string", () => {
    const big = "x".repeat(1025);
    expect(() =>
      parseCompletionBody(
        { prompt: "x", tier: "fast", maxTokens: 1, model: big },
        tenant,
      ),
    ).toThrow(/too long/u);
  });

  it("treats null optional as undefined", () => {
    const req = parseCompletionBody(
      { prompt: "x", tier: "fast", maxTokens: 1, cacheKey: null },
      tenant,
    );
    expect(req.cacheKey).toBeUndefined();
  });
});
