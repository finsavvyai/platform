import { describe, expect, it } from "vitest";
import { evaluateRule, validateRule } from "./rulePredicates.js";
import { PolicyError, type EvaluationContext } from "./types.js";

const ctx = (overrides: Partial<EvaluationContext> = {}): EvaluationContext => ({
  ...overrides,
});

describe("file_path_matches", () => {
  it("true when any path matches", () => {
    expect(
      evaluateRule(
        { type: "file_path_matches", pattern: "^src/" },
        ctx({ filePaths: ["src/a.ts", "docs/b.md"] }),
      ),
    ).toBe(true);
  });
  it("false on empty paths", () => {
    expect(
      evaluateRule(
        { type: "file_path_matches", pattern: "^src/" },
        ctx({ filePaths: [] }),
      ),
    ).toBe(false);
  });
  it("false when no path matches", () => {
    expect(
      evaluateRule(
        { type: "file_path_matches", pattern: "^docs/" },
        ctx({ filePaths: ["src/a.ts"] }),
      ),
    ).toBe(false);
  });
  it("false when filePaths missing", () => {
    expect(
      evaluateRule(
        { type: "file_path_matches", pattern: "^src/" },
        ctx(),
      ),
    ).toBe(false);
  });
});

describe("branch_protected", () => {
  it("false when no branch", () => {
    expect(
      evaluateRule({ type: "branch_protected" }, ctx({ protectedBranches: ["main"] })),
    ).toBe(false);
  });
  it("false when list empty", () => {
    expect(
      evaluateRule({ type: "branch_protected" }, ctx({ branch: "main" })),
    ).toBe(false);
  });
  it("true when listed", () => {
    expect(
      evaluateRule(
        { type: "branch_protected" },
        ctx({ branch: "main", protectedBranches: ["main", "release"] }),
      ),
    ).toBe(true);
  });
});

describe("risk_score_above", () => {
  it("true above threshold", () => {
    expect(
      evaluateRule({ type: "risk_score_above", threshold: 50 }, ctx({ riskScore: 75 })),
    ).toBe(true);
  });
  it("false at threshold", () => {
    expect(
      evaluateRule({ type: "risk_score_above", threshold: 50 }, ctx({ riskScore: 50 })),
    ).toBe(false);
  });
  it("false when score missing or NaN", () => {
    expect(
      evaluateRule({ type: "risk_score_above", threshold: 50 }, ctx()),
    ).toBe(false);
    expect(
      evaluateRule(
        { type: "risk_score_above", threshold: 50 },
        ctx({ riskScore: Number.NaN }),
      ),
    ).toBe(false);
  });
});

describe("requires_review_from", () => {
  it("true when reviewer present", () => {
    expect(
      evaluateRule(
        { type: "requires_review_from", reviewer: "alice" },
        ctx({ reviewers: ["bob", "alice"] }),
      ),
    ).toBe(true);
  });
  it("false when reviewer absent or empty list", () => {
    expect(
      evaluateRule(
        { type: "requires_review_from", reviewer: "alice" },
        ctx({ reviewers: ["bob"] }),
      ),
    ).toBe(false);
    expect(
      evaluateRule(
        { type: "requires_review_from", reviewer: "alice" },
        ctx(),
      ),
    ).toBe(false);
  });
});

describe("validateRule", () => {
  it("rejects null/undefined rule", () => {
    expect(() => validateRule(null as never)).toThrow(PolicyError);
  });
  it("rejects unknown type", () => {
    expect(() =>
      validateRule({ type: "nope" } as never),
    ).toThrow(/Unknown rule type/);
  });
  it("rejects empty file_path pattern", () => {
    expect(() =>
      validateRule({ type: "file_path_matches", pattern: "" }),
    ).toThrow(PolicyError);
  });
  it("rejects invalid regex pattern", () => {
    expect(() =>
      validateRule({ type: "file_path_matches", pattern: "([" }),
    ).toThrow(/invalid regex/);
  });
  it("accepts valid file_path_matches", () => {
    expect(() =>
      validateRule({ type: "file_path_matches", pattern: "^src/" }),
    ).not.toThrow();
  });
  it("accepts valid branch_protected (no extra fields)", () => {
    expect(() => validateRule({ type: "branch_protected" })).not.toThrow();
  });
  it("rejects non-numeric threshold", () => {
    expect(() =>
      validateRule({
        type: "risk_score_above",
        threshold: "high" as unknown as number,
      }),
    ).toThrow(PolicyError);
    expect(() =>
      validateRule({ type: "risk_score_above", threshold: Number.NaN }),
    ).toThrow(PolicyError);
  });
  it("accepts valid risk_score_above", () => {
    expect(() =>
      validateRule({ type: "risk_score_above", threshold: 10 }),
    ).not.toThrow();
  });
  it("rejects empty reviewer", () => {
    expect(() =>
      validateRule({ type: "requires_review_from", reviewer: "" }),
    ).toThrow(PolicyError);
  });
  it("accepts valid requires_review_from", () => {
    expect(() =>
      validateRule({ type: "requires_review_from", reviewer: "alice" }),
    ).not.toThrow();
  });
});
