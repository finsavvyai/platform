package security

import (
	"fmt"
	"strings"
)

func defaultPolicies() []Policy {
	return []Policy{
		{Name: "require-tests", Description: "All tests must pass", Type: "require_tests", Enforce: true},
		{Name: "no-secret-leak", Description: "No secrets in logs", Type: "no_secrets", Enforce: true},
		{Name: "require-review", Description: "Protected deployments require code review approvals", Type: "require_review", Enforce: true},
		{Name: "protected-branch-production", Description: "Production deploys must originate from a protected branch", Type: "protected_branch", Enforce: true},
		{Name: "separation-of-duties", Description: "Production deploys cannot be executed by the change author", Type: "separation_of_duties", Enforce: true},
		{Name: "sbom-required", Description: "Generate SBOM per build", Type: "sbom", Enforce: false},
	}
}

func checkPolicy(p Policy, ctx PolicyContext) *Violation {
	switch p.Type {
	case "require_tests":
		if !ctx.TestsPassed {
			return &Violation{Policy: p.Name, Message: "Tests did not pass"}
		}
	case "no_secrets":
		if ctx.SecretLeak {
			return &Violation{Policy: p.Name, Message: "Secret leak detected in logs"}
		}
	case "require_review":
		required := requiredApprovals(ctx)
		if required > 0 && approvalCount(ctx) < required {
			return &Violation{Policy: p.Name, Message: fmt.Sprintf("At least %d review approval(s) required before deploy", required)}
		}
	case "protected_branch":
		if isProduction(ctx.Environment) && !ctx.ProtectedBranch {
			return &Violation{Policy: p.Name, Message: "Production deploys must originate from a protected branch"}
		}
	case "separation_of_duties":
		if isProduction(ctx.Environment) && ctx.ActorIsAuthor {
			return &Violation{Policy: p.Name, Message: "Production deploy requires a different deployer than the change author"}
		}
	case "sbom":
		if !ctx.HasSBOM {
			return &Violation{Policy: p.Name, Message: "SBOM not generated"}
		}
	}
	return nil
}

func requiredApprovals(ctx PolicyContext) int {
	if ctx.MinimumApprovals > 0 {
		return ctx.MinimumApprovals
	}
	if isProduction(ctx.Environment) {
		return 2
	}
	if strings.EqualFold(ctx.Environment, "staging") {
		return 1
	}
	return 0
}

func approvalCount(ctx PolicyContext) int {
	if ctx.ApprovalCount > 0 {
		return ctx.ApprovalCount
	}
	if ctx.HasReview {
		return 1
	}
	return 0
}
