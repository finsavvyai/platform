// Legacy PR-check types (preserved for RuleEngine consumers).
export type Severity = "info" | "low" | "medium" | "high" | "critical";

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

export type LegacyDecision = "allow" | "warn" | "deny";

export type PolicyResult = {
  readonly decision: LegacyDecision;
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

// Core authorization model.
export type Effect = "ALLOW" | "DENY";

export type Subject = {
  readonly id: string;
  readonly roles: readonly string[];
  readonly attributes: Readonly<Record<string, string>>;
};

export type Resource = {
  readonly type: string;
  readonly id: string;
  readonly attributes: Readonly<Record<string, string>>;
};

export type Action = string;

export type EvaluationContext = {
  readonly branch?: string;
  readonly protectedBranches?: readonly string[];
  readonly filePaths?: readonly string[];
  readonly riskScore?: number;
  readonly reviewers?: readonly string[];
  readonly attributes?: Readonly<Record<string, string>>;
};

export type FilePathMatchesRule = {
  readonly type: "file_path_matches";
  readonly pattern: string; // regex source
};

export type BranchProtectedRule = {
  readonly type: "branch_protected";
};

export type RiskScoreAboveRule = {
  readonly type: "risk_score_above";
  readonly threshold: number;
};

export type RequiresReviewFromRule = {
  readonly type: "requires_review_from";
  readonly reviewer: string;
};

export type Rule =
  | FilePathMatchesRule
  | BranchProtectedRule
  | RiskScoreAboveRule
  | RequiresReviewFromRule;

export type PolicyStatement = {
  readonly id: string;
  readonly effect: Effect;
  readonly actions: readonly Action[];
  readonly resourceTypes: readonly string[];
  readonly rules: readonly Rule[];
};

export type Policy = {
  readonly id: string;
  readonly version: string;
  readonly statements: readonly PolicyStatement[];
};

export type Decision = {
  readonly effect: Effect;
  readonly policyId: string;
  readonly statementId?: string;
  readonly reason: string;
};

export class PolicyError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PolicyError";
    this.code = code;
  }
}
