import type { DeploymentPolicy } from "./types";

export interface DeploymentEvaluationContext {
  environment: string;
  testsPassed: boolean;
  reviewCount: number;
  protectedBranch: boolean;
  actorIsAuthor: boolean;
  secretLeak: boolean;
  hasSBOM: boolean;
}

export interface DeploymentEvaluation {
  allowed: boolean;
  reason: string;
  violations: string[];
}

export function evaluateDeploymentPolicy(
  policy: DeploymentPolicy,
  context: DeploymentEvaluationContext
): DeploymentEvaluation {
  const violations: string[] = [];

  if (!context.testsPassed) {
    violations.push("Tests did not pass");
  }
  if (context.secretLeak) {
    violations.push("Secret leak detected in logs");
  }
  if (policy.required_review_approvals > 0 && context.reviewCount < policy.required_review_approvals) {
    violations.push(`At least ${policy.required_review_approvals} review approval(s) required before deploy`);
  }
  if (policy.require_protected_branch && !context.protectedBranch) {
    violations.push("Production deploys must originate from a protected branch");
  }
  if (policy.require_separation_of_duties && context.actorIsAuthor) {
    violations.push("Production deploy requires a different deployer than the change author");
  }

  return {
    allowed: violations.length === 0,
    reason: violations[0] ?? "",
    violations,
  };
}
