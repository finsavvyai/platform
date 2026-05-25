import { describe, expect, it } from "vitest";
import {
  fromOpenAiBody,
  isAbort,
  joinUrl,
  safeText,
  toOpenAiBody,
} from "./http-internal.js";
import type { CompletionRequest } from "./types.js";

describe("joinUrl", () => {
  it("joins with no slash on either side", () => {
    expect(joinUrl("https://x.test", "v1/chat")).toBe("https://x.test/v1/chat");
  });
  it("handles trailing slash on base", () => {
    expect(joinUrl("https://x.test/", "/v1/chat")).toBe("https://x.test/v1/chat");
  });
  it("handles leading slash on path only", () => {
    expect(joinUrl("https://x.test", "/v1/chat")).toBe("https://x.test/v1/chat");
  });
});

describe("isAbort", () => {
  it("returns false for non-objects", () => {
    expect(isAbort(null)).toBe(false);
    expect(isAbort("x")).toBe(false);
    expect(isAbort(42)).toBe(false);
  });
  it("returns false for object without name=AbortError", () => {
    expect(isAbort({ name: "OtherError" })).toBe(false);
    expect(isAbort({})).toBe(false);
  });
  it("returns true for AbortError-shaped value", () => {
    expect(isAbort({ name: "AbortError" })).toBe(true);
  });
});

describe("safeText", () => {
  it("returns body text on success", async () => {
    const r = new Response("hello");
    expect(await safeText(r)).toBe("hello");
  });
  it("returns sentinel on .text() rejection", async () => {
    const fake = { text: () => Promise.reject(new Error("boom")) } as unknown as Response;
    expect(await safeText(fake)).toBe("<no body>");
  });
});

describe("toOpenAiBody", () => {
  const base: CompletionRequest = {
    model: "m",
    messages: [{ role: "user", content: "hi" }],
    tenantId: "t",
  };
  it("emits required fields and stream=false", () => {
    const b = toOpenAiBody(base);
    expect(b).toMatchObject({ model: "m", stream: false });
  });
  it("includes every optional field when set", () => {
    const b = toOpenAiBody({
      ...base,
      temperature: 0.1,
      top_p: 0.9,
      max_tokens: 42,
      stop: ["\n"],
      tools: [
        {
          type: "function",
          function: { name: "fn", parameters: { type: "object" } },
        },
      ],
      tool_choice: "auto",
    });
    expect(b.temperature).toBe(0.1);
    expect(b.top_p).toBe(0.9);
    expect(b.max_tokens).toBe(42);
    expect(b.stop).toEqual(["\n"]);
    expect(b.tool_choice).toBe("auto");
    expect(Array.isArray(b.tools)).toBe(true);
  });
});

describe("fromOpenAiBody", () => {
  it("backfills missing id/model/created/usage/choices", () => {
    const r = fromOpenAiBody("cluster", "fallback-model", {});
    expect(r.id).toBe("");
    expect(r.model).toBe("fallback-model");
    expect(typeof r.created).toBe("number");
    expect(r.choices).toEqual([]);
    expect(r.usage.total_tokens).toBe(0);
  });
  it("uses provided id/model/created/choices/usage", () => {
    const r = fromOpenAiBody("cluster", "fb", {
      id: "x",
      model: "real",
      created: 123,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "yo" },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    });
    expect(r.id).toBe("x");
    expect(r.model).toBe("real");
    expect(r.created).toBe(123);
    expect(r.usage.total_tokens).toBe(3);
    expect(r.providerId).toBe("cluster");
  });
});
