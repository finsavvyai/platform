import {
  PolicyError,
  type EvaluationContext,
  type Rule,
} from "./types.js";

const ALLOWED_TYPES = new Set<Rule["type"]>([
  "file_path_matches",
  "branch_protected",
  "risk_score_above",
  "requires_review_from",
]);

const safeRegex = (source: string): RegExp => {
  try {
    return new RegExp(source);
  } catch {
    throw new PolicyError(
      "policy.rule.invalid_regex",
      `Rule has invalid regex pattern: ${source}`,
    );
  }
};

const filePathMatches = (
  pattern: string,
  ctx: EvaluationContext,
): boolean => {
  const paths = ctx.filePaths ?? [];
  if (paths.length === 0) return false;
  const re = safeRegex(pattern);
  return paths.some((p) => re.test(p));
};

const branchProtected = (ctx: EvaluationContext): boolean => {
  const branch = ctx.branch;
  const list = ctx.protectedBranches ?? [];
  if (!branch || list.length === 0) return false;
  return list.includes(branch);
};

const riskScoreAbove = (
  threshold: number,
  ctx: EvaluationContext,
): boolean => {
  const score = ctx.riskScore;
  if (typeof score !== "number" || Number.isNaN(score)) return false;
  return score > threshold;
};

const requiresReviewFrom = (
  reviewer: string,
  ctx: EvaluationContext,
): boolean => {
  const reviewers = ctx.reviewers ?? [];
  return reviewers.includes(reviewer);
};

export const validateRule = (rule: Rule): void => {
  if (!rule || typeof rule !== "object" || !("type" in rule)) {
    throw new PolicyError("policy.rule.malformed", "Rule is missing type.");
  }
  if (!ALLOWED_TYPES.has(rule.type)) {
    throw new PolicyError(
      "policy.rule.unknown_type",
      `Unknown rule type: ${(rule as { type: string }).type}`,
    );
  }
  if (rule.type === "file_path_matches") {
    if (typeof rule.pattern !== "string" || rule.pattern.length === 0) {
      throw new PolicyError(
        "policy.rule.invalid_pattern",
        "file_path_matches requires non-empty pattern.",
      );
    }
    safeRegex(rule.pattern);
    return;
  }
  if (rule.type === "risk_score_above") {
    if (typeof rule.threshold !== "number" || Number.isNaN(rule.threshold)) {
      throw new PolicyError(
        "policy.rule.invalid_threshold",
        "risk_score_above requires numeric threshold.",
      );
    }
    return;
  }
  if (rule.type === "requires_review_from") {
    if (typeof rule.reviewer !== "string" || rule.reviewer.length === 0) {
      throw new PolicyError(
        "policy.rule.invalid_reviewer",
        "requires_review_from requires non-empty reviewer.",
      );
    }
    return;
  }
};

export const evaluateRule = (rule: Rule, ctx: EvaluationContext): boolean => {
  switch (rule.type) {
    case "file_path_matches":
      return filePathMatches(rule.pattern, ctx);
    case "branch_protected":
      return branchProtected(ctx);
    case "risk_score_above":
      return riskScoreAbove(rule.threshold, ctx);
    case "requires_review_from":
      return requiresReviewFrom(rule.reviewer, ctx);
  }
};
