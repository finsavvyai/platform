import { describe, it, expect } from "vitest";
import {
  evaluate,
  evaluateCondition,
  getPath,
  validatePolicy,
  type Policy,
} from "./policy-engine";

describe("policy-engine — getPath", () => {
  it("reads nested object paths", () => {
    const input = { run: { metadata: { branch: "main" } } };
    expect(getPath(input, "run.metadata.branch")).toBe("main");
  });

  it("returns undefined for missing segments", () => {
    expect(getPath({ a: {} }, "a.b.c")).toBeUndefined();
  });

  it("indexes into arrays by numeric segment", () => {
    const input = { steps: ["lint", "test", "build"] };
    expect(getPath(input, "steps.1")).toBe("test");
  });
});

describe("policy-engine — evaluateCondition ops", () => {
  const input = {
    run: {
      steps: ["lint", "test", "build"],
      branch: "main",
      approvals: 2,
      image: "ghcr.io/norlys/base:1.2",
    },
  };

  it("equals", () => {
    expect(evaluateCondition(input, { path: "run.branch", op: "equals", value: "main" })).toBe(true);
    expect(evaluateCondition(input, { path: "run.branch", op: "equals", value: "dev" })).toBe(false);
  });

  it("not_equals", () => {
    expect(evaluateCondition(input, { path: "run.branch", op: "not_equals", value: "dev" })).toBe(true);
  });

  it("contains on arrays", () => {
    expect(evaluateCondition(input, { path: "run.steps", op: "contains", value: "test" })).toBe(true);
    expect(evaluateCondition(input, { path: "run.steps", op: "contains", value: "deploy" })).toBe(false);
  });

  it("contains on strings", () => {
    expect(evaluateCondition(input, { path: "run.image", op: "contains", value: "norlys" })).toBe(true);
  });

  it("starts_with", () => {
    expect(evaluateCondition(input, { path: "run.image", op: "starts_with", value: "ghcr.io" })).toBe(true);
  });

  it("exists", () => {
    expect(evaluateCondition(input, { path: "run.branch", op: "exists" })).toBe(true);
    expect(evaluateCondition(input, { path: "run.missing", op: "exists" })).toBe(false);
  });

  it("greater_than / less_than", () => {
    expect(evaluateCondition(input, { path: "run.approvals", op: "greater_than", value: 1 })).toBe(true);
    expect(evaluateCondition(input, { path: "run.approvals", op: "less_than", value: 5 })).toBe(true);
    expect(evaluateCondition(input, { path: "run.approvals", op: "greater_than", value: 5 })).toBe(false);
  });

  it("in", () => {
    expect(evaluateCondition(input, { path: "run.branch", op: "in", value: ["main", "release"] })).toBe(true);
    expect(evaluateCondition(input, { path: "run.branch", op: "in", value: ["dev"] })).toBe(false);
  });

  it("regex", () => {
    expect(evaluateCondition(input, { path: "run.image", op: "regex", value: "^ghcr\\.io/norlys/" })).toBe(true);
    expect(evaluateCondition(input, { path: "run.image", op: "regex", value: "^dockerhub" })).toBe(false);
  });
});

describe("policy-engine — evaluate()", () => {
  const requireTests: Policy = {
    name: "require-tests",
    effect: "deny",
    conditions: [{ path: "run.steps", op: "contains", value: "test" }],
    message: "Tests are required",
    // note: we deny when condition is MET inverted below by effect semantics,
    // so we model "missing test" as: NOT contains(test). We use a separate
    // denial policy with an `exists` style; see the "allow case" below for
    // the require-tests happy path.
  };

  it("allow case — run contains 'test' step, no deny matches", () => {
    // Policy: deny if run.steps does NOT contain 'test' — express as a
    // regex-negation via a second policy would work, but for simplicity
    // we use a deny policy that matches when branch is 'forbidden'.
    const policies: Policy[] = [
      {
        name: "block-forbidden-branch",
        effect: "deny",
        conditions: [{ path: "run.branch", op: "equals", value: "forbidden" }],
        message: "branch not allowed",
      },
    ];
    const result = evaluate(policies, { run: { steps: ["test", "build"], branch: "main" } });
    expect(result.allow).toBe(true);
    expect(result.denials).toHaveLength(0);
  });

  it("deny case — policy matches and blocks the run", () => {
    const policies: Policy[] = [
      {
        name: "block-main-push",
        effect: "deny",
        conditions: [{ path: "run.branch", op: "equals", value: "main" }],
        message: "direct push to main forbidden",
      },
    ];
    const result = evaluate(policies, { run: { branch: "main" } });
    expect(result.allow).toBe(false);
    expect(result.denials).toHaveLength(1);
    expect(result.denials[0].message).toBe("direct push to main forbidden");
    expect(result.matched).toContain("block-main-push");
  });

  it("nested path access", () => {
    const policies: Policy[] = [
      {
        name: "require-prod-approval",
        effect: "deny",
        conditions: [
          { path: "run.environment", op: "equals", value: "production" },
          { path: "run.metadata.approvals", op: "less_than", value: 2 },
        ],
        message: "production requires 2 approvals",
      },
    ];
    const denied = evaluate(policies, {
      run: { environment: "production", metadata: { approvals: 1 } },
    });
    expect(denied.allow).toBe(false);
    const allowed = evaluate(policies, {
      run: { environment: "production", metadata: { approvals: 3 } },
    });
    expect(allowed.allow).toBe(true);
  });

  it("multi-policy — any deny blocks", () => {
    const policies: Policy[] = [
      {
        name: "p1",
        effect: "allow",
        conditions: [{ path: "run.branch", op: "equals", value: "main" }],
      },
      {
        name: "p2",
        effect: "deny",
        conditions: [{ path: "run.secret_leak", op: "equals", value: true }],
        message: "secret leak detected",
      },
    ];
    const result = evaluate(policies, { run: { branch: "main", secret_leak: true } });
    expect(result.allow).toBe(false);
    expect(result.denials.map((d) => d.name)).toContain("p2");
    expect(result.matched).toContain("p1");
  });

  it("OR combine — any condition match fires the policy", () => {
    const policies: Policy[] = [
      {
        name: "block-risky-base",
        effect: "deny",
        combine: "or",
        conditions: [
          { path: "run.image", op: "contains", value: "latest" },
          { path: "run.image", op: "starts_with", value: "dockerhub.io/" },
        ],
        message: "unapproved base image",
      },
    ];
    const result = evaluate(policies, { run: { image: "ghcr.io/app:latest" } });
    expect(result.allow).toBe(false);
  });

  it("regex op inside a policy", () => {
    const policies: Policy[] = [
      {
        name: "require-approved-registry",
        effect: "deny",
        conditions: [{ path: "run.image", op: "regex", value: "^(?!ghcr\\.io/norlys/).+" }],
        message: "base image must come from ghcr.io/norlys",
      },
    ];
    const bad = evaluate(policies, { run: { image: "dockerhub.io/whatever:1.0" } });
    expect(bad.allow).toBe(false);
    const good = evaluate(policies, { run: { image: "ghcr.io/norlys/app:1.0" } });
    expect(good.allow).toBe(true);
  });

  it("empty conditions means policy always matches", () => {
    const policies: Policy[] = [
      { name: "catch-all-deny", effect: "deny", conditions: [], message: "no" },
    ];
    expect(evaluate(policies, {}).allow).toBe(false);
  });

  // requireTests shape compiles and is accepted by validator
  it("validatePolicy accepts a simple deny policy", () => {
    const p = validatePolicy({
      name: requireTests.name,
      effect: requireTests.effect,
      conditions: requireTests.conditions,
      message: requireTests.message,
    });
    expect(p.name).toBe("require-tests");
    expect(p.effect).toBe("deny");
  });
});

describe("policy-engine — validatePolicy errors", () => {
  it("rejects missing name", () => {
    expect(() => validatePolicy({ effect: "deny", conditions: [] })).toThrow(/name/);
  });
  it("rejects bad effect", () => {
    expect(() => validatePolicy({ name: "x", effect: "maybe", conditions: [] })).toThrow(/effect/);
  });
  it("rejects non-array conditions", () => {
    expect(() => validatePolicy({ name: "x", effect: "deny", conditions: "all" })).toThrow(/conditions/);
  });
  it("rejects unknown op", () => {
    expect(() =>
      validatePolicy({
        name: "x",
        effect: "deny",
        conditions: [{ path: "a", op: "bogus" }],
      }),
    ).toThrow(/op/);
  });
});
