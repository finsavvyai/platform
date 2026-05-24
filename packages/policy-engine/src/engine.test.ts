import { describe, expect, it } from "vitest";
import { RuleEngine } from "./engine.js";
import { FileSizeRule, SecretScanRule } from "./rules.js";
import type { PolicyContext } from "./types.js";

const ctx = (overrides: Partial<PolicyContext> = {}): PolicyContext => ({
  repo: "r",
  ref: "main",
  actor: "u",
  files: [],
  metadata: {},
  ...overrides,
});

describe("RuleEngine", () => {
  it("allows clean PR", () => {
    const engine = new RuleEngine([new FileSizeRule(), new SecretScanRule()]);
    const res = engine.evaluate(ctx({ files: ["src/a.ts"], metadata: { "lines:src/a.ts": "50" } }));
    expect(res.decision).toBe("allow");
    expect(res.violations).toHaveLength(0);
  });

  it("denies oversized file", () => {
    const engine = new RuleEngine([new FileSizeRule(200)]);
    const res = engine.evaluate(ctx({ files: ["big.ts"], metadata: { "lines:big.ts": "500" } }));
    expect(res.decision).toBe("deny");
  });

  it("denies secret leak", () => {
    const engine = new RuleEngine([new SecretScanRule()]);
    const res = engine.evaluate(
      ctx({
        files: ["bad.ts"],
        metadata: { "content:bad.ts": "const k = 'AKIAIOSFODNN7EXAMPLE';" },
      }),
    );
    expect(res.decision).toBe("deny");
    expect(res.violations[0]?.severity).toBe("critical");
  });
});
