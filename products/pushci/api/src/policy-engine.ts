// PushCI policy engine — lightweight in-process policy evaluator.
//
// Rego-inspired JSON DSL. Designed to run in Cloudflare Workers (no fs,
// no child_process, just JS). A compiled subset covering allow/deny +
// conditions is enough for ~90% of Norlys-style policies while staying
// dependency-free. Customers who need full Rego should point PushCI at a
// remote OPA server (see policy-opa-remote.ts).

export type PolicyEffect = "allow" | "deny";

export type PolicyOp =
  | "equals"
  | "not_equals"
  | "contains"
  | "starts_with"
  | "exists"
  | "greater_than"
  | "less_than"
  | "in"
  | "regex";

export interface PolicyCondition {
  path: string;
  op: PolicyOp;
  value?: unknown;
}

export interface Policy {
  id?: string;
  name: string;
  description?: string;
  effect: PolicyEffect;
  conditions: PolicyCondition[];
  message?: string;
  // Optional: logical combinator for conditions. Default "and".
  combine?: "and" | "or";
}

export interface PolicyDenial {
  name: string;
  message: string;
}

export interface PolicyEvaluation {
  allow: boolean;
  denials: PolicyDenial[];
  matched: string[];
}

// Look up a nested value by dotted path ("run.metadata.branch").
// Array indices are supported via numeric segments ("run.steps.0").
export function getPath(input: unknown, path: string): unknown {
  if (!path) return input;
  const parts = path.split(".");
  let cur: unknown = input;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== "object") return undefined;
    const idx = Number(p);
    if (!Number.isNaN(idx) && Array.isArray(cur)) {
      cur = (cur as unknown[])[idx];
    } else {
      cur = (cur as Record<string, unknown>)[p];
    }
  }
  return cur;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function containsValue(haystack: unknown, needle: unknown): boolean {
  if (Array.isArray(haystack)) {
    return haystack.some((item) => {
      if (typeof item === "string" && typeof needle === "string") {
        return item === needle || item.includes(needle);
      }
      return item === needle;
    });
  }
  if (typeof haystack === "string" && typeof needle === "string") {
    return haystack.includes(needle);
  }
  if (haystack && typeof haystack === "object" && typeof needle === "string") {
    return Object.prototype.hasOwnProperty.call(haystack, needle);
  }
  return false;
}

export function evaluateCondition(input: unknown, cond: PolicyCondition): boolean {
  const actual = getPath(input, cond.path);
  const expected = cond.value;

  switch (cond.op) {
    case "equals":
      return actual === expected;
    case "not_equals":
      return actual !== expected;
    case "exists":
      return actual !== undefined && actual !== null;
    case "contains":
      return containsValue(actual, expected);
    case "starts_with":
      return typeof actual === "string" && typeof expected === "string" && actual.startsWith(expected);
    case "greater_than": {
      const a = asNumber(actual);
      const b = asNumber(expected);
      return a !== null && b !== null && a > b;
    }
    case "less_than": {
      const a = asNumber(actual);
      const b = asNumber(expected);
      return a !== null && b !== null && a < b;
    }
    case "in":
      if (!Array.isArray(expected)) return false;
      return (expected as unknown[]).some((v) => v === actual);
    case "regex": {
      if (typeof actual !== "string" || typeof expected !== "string") return false;
      try {
        const re = new RegExp(expected);
        return re.test(actual);
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

function policyMatches(policy: Policy, input: unknown): boolean {
  const combine = policy.combine ?? "and";
  if (policy.conditions.length === 0) return true;
  if (combine === "or") {
    return policy.conditions.some((c) => evaluateCondition(input, c));
  }
  return policy.conditions.every((c) => evaluateCondition(input, c));
}

// Validate a Policy object at runtime. Throws a helpful error on bad input.
export function validatePolicy(raw: unknown): Policy {
  if (!raw || typeof raw !== "object") throw new Error("policy must be an object");
  const p = raw as Record<string, unknown>;
  if (typeof p.name !== "string" || !p.name) throw new Error("policy.name is required");
  if (p.effect !== "allow" && p.effect !== "deny") {
    throw new Error("policy.effect must be 'allow' or 'deny'");
  }
  if (!Array.isArray(p.conditions)) throw new Error("policy.conditions must be an array");
  const okOps: PolicyOp[] = [
    "equals", "not_equals", "contains", "starts_with",
    "exists", "greater_than", "less_than", "in", "regex",
  ];
  for (const c of p.conditions as unknown[]) {
    if (!c || typeof c !== "object") throw new Error("condition must be an object");
    const cc = c as Record<string, unknown>;
    if (typeof cc.path !== "string") throw new Error("condition.path must be a string");
    if (typeof cc.op !== "string" || !okOps.includes(cc.op as PolicyOp)) {
      throw new Error(`condition.op must be one of ${okOps.join(", ")}`);
    }
  }
  return {
    id: typeof p.id === "string" ? p.id : undefined,
    name: p.name,
    description: typeof p.description === "string" ? p.description : undefined,
    effect: p.effect,
    conditions: p.conditions as PolicyCondition[],
    message: typeof p.message === "string" ? p.message : undefined,
    combine: p.combine === "or" ? "or" : "and",
  };
}

// Evaluate a set of policies against an input. Any matching "deny"
// policy blocks the run. If no deny matches, we allow by default.
// "allow" policies are informational (audit trail of which policies
// green-lit the run).
export function evaluate(policies: Policy[], input: unknown): PolicyEvaluation {
  const denials: PolicyDenial[] = [];
  const matched: string[] = [];

  for (const policy of policies) {
    if (!policyMatches(policy, input)) continue;
    matched.push(policy.name);
    if (policy.effect === "deny") {
      denials.push({
        name: policy.name,
        message: policy.message ?? `Policy '${policy.name}' denied the request`,
      });
    }
  }

  return {
    allow: denials.length === 0,
    denials,
    matched,
  };
}
