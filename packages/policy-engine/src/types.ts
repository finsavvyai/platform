export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type PolicyDecision = "allow" | "warn" | "deny";

export type PolicyContext = {
  readonly repo: string;
  readonly ref: string;
  readonly actor: string;
  readonly files: readonly string[];
  readonly metadata: Readonly<Record<string, string>>;
};

export type PolicyViolation = {
  readonly ruleId: string;
  readonly severity: Severity;
  readonly message: string;
  readonly file?: string;
};

export type PolicyResult = {
  readonly decision: PolicyDecision;
  readonly violations: readonly PolicyViolation[];
};

export interface PolicyRule {
  readonly id: string;
  readonly severity: Severity;
  evaluate(ctx: PolicyContext): readonly PolicyViolation[];
}

export interface PolicyEngine {
  evaluate(ctx: PolicyContext): PolicyResult;
}
