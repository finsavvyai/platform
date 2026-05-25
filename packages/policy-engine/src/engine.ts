import { evaluateRule, validateRule } from "./rulePredicates.js";
import {
  PolicyError,
  type Action,
  type Decision,
  type EvaluationContext,
  type LegacyDecision,
  type Policy,
  type PolicyContext,
  type PolicyEngine as LegacyPolicyEngineShape,
  type PolicyResult,
  type PolicyRule,
  type PolicyStatement,
  type PolicyViolation,
  type Resource,
  type Severity,
  type Subject,
} from "./types.js";

// Re-export legacy interface shape (kept for source compatibility).
export type PolicyEngine = LegacyPolicyEngineShape;

const DENY_AT: readonly Severity[] = ["high", "critical"];
const WARN_AT: readonly Severity[] = ["medium"];

const worstDecision = (
  violations: readonly PolicyViolation[],
): LegacyDecision => {
  if (violations.some((v) => DENY_AT.includes(v.severity))) return "deny";
  if (violations.some((v) => WARN_AT.includes(v.severity))) return "warn";
  return "allow";
};

// Legacy PR-check engine. Preserved so existing rules (FileSizeRule,
// SecretScanRule) keep working. The new authorization evaluator lives below.
export class RuleEngine implements PolicyEngine {
  constructor(private readonly rules: readonly PolicyRule[]) {}

  evaluate(ctx: PolicyContext): PolicyResult {
    const violations: PolicyViolation[] = [];
    for (const rule of this.rules) {
      violations.push(...rule.evaluate(ctx));
    }
    return { decision: worstDecision(violations), violations };
  }
}

// --- Authorization evaluator ---

const validatePolicy = (policy: Policy): void => {
  if (!policy || typeof policy !== "object") {
    throw new PolicyError("policy.malformed", "Policy is not an object.");
  }
  if (typeof policy.id !== "string" || policy.id.length === 0) {
    throw new PolicyError("policy.missing_id", "Policy.id is required.");
  }
  if (typeof policy.version !== "string" || policy.version.length === 0) {
    throw new PolicyError(
      "policy.missing_version",
      "Policy.version is required.",
    );
  }
  if (!Array.isArray(policy.statements)) {
    throw new PolicyError(
      "policy.statements_invalid",
      "Policy.statements must be an array.",
    );
  }
  for (const s of policy.statements) {
    if (!s || (s.effect !== "ALLOW" && s.effect !== "DENY")) {
      throw new PolicyError(
        "policy.statement.invalid_effect",
        "Statement.effect must be ALLOW or DENY.",
      );
    }
    if (!Array.isArray(s.actions) || !Array.isArray(s.resourceTypes)) {
      throw new PolicyError(
        "policy.statement.invalid_shape",
        "Statement requires actions[] and resourceTypes[].",
      );
    }
    if (!Array.isArray(s.rules)) {
      throw new PolicyError(
        "policy.statement.invalid_rules",
        "Statement.rules must be an array.",
      );
    }
    for (const r of s.rules) validateRule(r);
  }
};

const matchesTarget = (
  stmt: PolicyStatement,
  resource: Resource,
  action: Action,
): boolean => {
  const typeOk =
    stmt.resourceTypes.includes("*") || stmt.resourceTypes.includes(resource.type);
  const actionOk =
    stmt.actions.includes("*") || stmt.actions.includes(action);
  return typeOk && actionOk;
};

const allRulesMatch = (
  stmt: PolicyStatement,
  ctx: EvaluationContext,
): boolean => {
  // Empty rules => target match alone is enough.
  for (const rule of stmt.rules) {
    if (!evaluateRule(rule, ctx)) return false;
  }
  return true;
};

// Decision algorithm: first-matching-statement wins. Rationale: deterministic
// trace for audit logs; statement order in policy doc is authoritative.
// Default decision is DENY when no statement matches (safe default).
export const evaluatePolicy = (
  policy: Policy,
  _subject: Subject,
  resource: Resource,
  action: Action,
  ctx: EvaluationContext,
): Decision => {
  validatePolicy(policy);
  for (const stmt of policy.statements) {
    if (!matchesTarget(stmt, resource, action)) continue;
    if (!allRulesMatch(stmt, ctx)) continue;
    return {
      effect: stmt.effect,
      policyId: policy.id,
      statementId: stmt.id,
      reason: `statement ${stmt.id} matched`,
    };
  }
  return {
    effect: "DENY",
    policyId: policy.id,
    reason: "no matching statement; default deny",
  };
};

// Multi-policy combiner. DENY trumps ALLOW. Empty input => default DENY.
export const combine = (decisions: readonly Decision[]): Decision => {
  if (decisions.length === 0) {
    return {
      effect: "DENY",
      policyId: "<combined>",
      reason: "no decisions provided; default deny",
    };
  }
  const deny = decisions.find((d) => d.effect === "DENY");
  if (deny) return deny;
  return decisions[0]!;
};
