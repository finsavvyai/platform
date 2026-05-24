import type {
  PolicyContext,
  PolicyDecision,
  PolicyEngine,
  PolicyResult,
  PolicyRule,
  PolicyViolation,
  Severity,
} from "./types.js";

const DENY_AT: Severity[] = ["high", "critical"];
const WARN_AT: Severity[] = ["medium"];

const worstDecision = (violations: readonly PolicyViolation[]): PolicyDecision => {
  if (violations.some((v) => DENY_AT.includes(v.severity))) return "deny";
  if (violations.some((v) => WARN_AT.includes(v.severity))) return "warn";
  return "allow";
};

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
