import { describe, expect, it } from "vitest";
import { combine, evaluatePolicy } from "./engine.js";
import {
  PolicyError,
  type Decision,
  type EvaluationContext,
  type Policy,
  type Resource,
  type Subject,
} from "./types.js";

const subj: Subject = { id: "u1", roles: ["dev"], attributes: {} };
const res = (overrides: Partial<Resource> = {}): Resource => ({
  type: "repo",
  id: "r1",
  attributes: {},
  ...overrides,
});
const ctx = (overrides: Partial<EvaluationContext> = {}): EvaluationContext => ({
  ...overrides,
});

const policy = (overrides: Partial<Policy> = {}): Policy => ({
  id: "p1",
  version: "1",
  statements: [],
  ...overrides,
});

describe("evaluatePolicy: default deny", () => {
  it("denies when policy has no statements", () => {
    const d = evaluatePolicy(policy(), subj, res(), "read", ctx());
    expect(d.effect).toBe("DENY");
    expect(d.reason).toContain("default deny");
  });

  it("denies when no statement target matches", () => {
    const p = policy({
      statements: [
        {
          id: "s1",
          effect: "ALLOW",
          actions: ["write"],
          resourceTypes: ["repo"],
          rules: [],
        },
      ],
    });
    const d = evaluatePolicy(p, subj, res(), "read", ctx());
    expect(d.effect).toBe("DENY");
  });

  it("allows when target matches and no rules", () => {
    const p = policy({
      statements: [
        {
          id: "s1",
          effect: "ALLOW",
          actions: ["*"],
          resourceTypes: ["*"],
          rules: [],
        },
      ],
    });
    const d = evaluatePolicy(p, subj, res(), "read", ctx());
    expect(d.effect).toBe("ALLOW");
    expect(d.statementId).toBe("s1");
  });
});

describe("evaluatePolicy: first-match wins", () => {
  it("returns first matching statement effect", () => {
    const p = policy({
      statements: [
        {
          id: "deny-prot",
          effect: "DENY",
          actions: ["push"],
          resourceTypes: ["repo"],
          rules: [{ type: "branch_protected" }],
        },
        {
          id: "allow-push",
          effect: "ALLOW",
          actions: ["push"],
          resourceTypes: ["repo"],
          rules: [],
        },
      ],
    });
    const c = ctx({ branch: "main", protectedBranches: ["main"] });
    const d = evaluatePolicy(p, subj, res(), "push", c);
    expect(d.effect).toBe("DENY");
    expect(d.statementId).toBe("deny-prot");
  });

  it("skips statement when any rule fails", () => {
    const p = policy({
      statements: [
        {
          id: "s1",
          effect: "DENY",
          actions: ["push"],
          resourceTypes: ["repo"],
          rules: [
            { type: "branch_protected" },
            { type: "risk_score_above", threshold: 50 },
          ],
        },
        {
          id: "s2",
          effect: "ALLOW",
          actions: ["push"],
          resourceTypes: ["repo"],
          rules: [],
        },
      ],
    });
    const c = ctx({ branch: "main", protectedBranches: ["main"], riskScore: 10 });
    const d = evaluatePolicy(p, subj, res(), "push", c);
    expect(d.effect).toBe("ALLOW");
    expect(d.statementId).toBe("s2");
  });
});

describe("evaluatePolicy: malformed input", () => {
  it("rejects non-object policy", () => {
    expect(() =>
      evaluatePolicy(null as unknown as Policy, subj, res(), "read", ctx()),
    ).toThrow(PolicyError);
  });
  it("rejects missing id/version/statements", () => {
    expect(() =>
      evaluatePolicy({ id: "", version: "1", statements: [] }, subj, res(), "x", ctx()),
    ).toThrow(/Policy.id/);
    expect(() =>
      evaluatePolicy({ id: "p", version: "", statements: [] }, subj, res(), "x", ctx()),
    ).toThrow(/Policy.version/);
    expect(() =>
      evaluatePolicy(
        { id: "p", version: "1", statements: "no" as never } as Policy,
        subj, res(), "x", ctx(),
      ),
    ).toThrow(/statements/);
  });
  it("rejects bad statement shapes", () => {
    expect(() =>
      evaluatePolicy(
        policy({ statements: [{ id: "s", effect: "MAYBE" as never, actions: [], resourceTypes: [], rules: [] }] }),
        subj, res(), "x", ctx(),
      ),
    ).toThrow(/effect/);
    expect(() =>
      evaluatePolicy(
        policy({ statements: [{ id: "s", effect: "ALLOW", actions: "x" as never, resourceTypes: [], rules: [] }] }),
        subj, res(), "x", ctx(),
      ),
    ).toThrow(/actions/);
    expect(() =>
      evaluatePolicy(
        policy({ statements: [{ id: "s", effect: "ALLOW", actions: [], resourceTypes: [], rules: "x" as never }] }),
        subj, res(), "x", ctx(),
      ),
    ).toThrow(/rules/);
  });
});

describe("combine", () => {
  const allow: Decision = { effect: "ALLOW", policyId: "p1", reason: "ok" };
  const deny: Decision = { effect: "DENY", policyId: "p2", reason: "no" };

  it("default-denies empty input", () => {
    expect(combine([]).effect).toBe("DENY");
  });
  it("returns DENY when any input denies", () => {
    expect(combine([allow, deny]).effect).toBe("DENY");
    expect(combine([deny, allow]).policyId).toBe("p2");
  });
  it("returns first ALLOW when all allow", () => {
    const d = combine([allow, { ...allow, policyId: "p3" }]);
    expect(d.effect).toBe("ALLOW");
    expect(d.policyId).toBe("p1");
  });
});
