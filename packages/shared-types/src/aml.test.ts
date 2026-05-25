import { describe, expect, it } from "vitest";
import { isDecision, isScore } from "./aml.js";

describe("isDecision", () => {
  it.each(["clear", "review", "block"] as const)("accepts %s", (v) => {
    expect(isDecision(v)).toBe(true);
  });

  it.each(["", "approve", "deny", null, undefined, 0, 1, {}, []])(
    "rejects %p",
    (v) => {
      expect(isDecision(v)).toBe(false);
    },
  );
});

describe("isScore", () => {
  it.each([0, 0.5, 1])("accepts %p", (v) => {
    expect(isScore(v)).toBe(true);
  });

  it.each([-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY, "0.5", null])(
    "rejects %p",
    (v) => {
      expect(isScore(v)).toBe(false);
    },
  );
});
