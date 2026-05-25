package policy

import (
	"fmt"
	"strings"
)

// policyRequireTests checks for test step in pipeline.
func policyRequireTests() Policy {
	return Policy{
		ID:          "require-tests",
		Name:        "Require Tests",
		Description: "Pipeline must have a test step",
		Severity:    "high",
		Enforced:    true,
		CheckFunc: func(ctx *PipelineContext) *Violation {
			if !ctx.HasTests && !containsStep(ctx.Steps, "test") {
				return &Violation{
					PolicyID:    "require-tests",
					PolicyName:  "Require Tests",
					Severity:    "high",
					Description: "No test step detected in pipeline",
					Remediation: "Add test step (go test ./..., npm test, pytest, etc.)",
				}
			}
			return nil
		},
	}
}

// policyRequireLint checks for linting step.
func policyRequireLint() Policy {
	return Policy{
		ID:          "require-lint",
		Name:        "Require Linting",
		Description: "Pipeline must have a lint step",
		Severity:    "medium",
		Enforced:    true,
		CheckFunc: func(ctx *PipelineContext) *Violation {
			if !ctx.HasLint && !containsStep(ctx.Steps, "lint") {
				return &Violation{
					PolicyID:    "require-lint",
					PolicyName:  "Require Linting",
					Severity:    "medium",
					Description: "No lint/code quality step detected",
					Remediation: "Add linting step (golangci-lint, eslint, etc.)",
				}
			}
			return nil
		},
	}
}

// policyNoSecretsInEnv checks for hardcoded secrets.
func policyNoSecretsInEnv() Policy {
	return Policy{
		ID:          "no-secrets-in-env",
		Name:        "No Hardcoded Secrets",
		Description: "Environment variables must not contain hardcoded secrets",
		Severity:    "critical",
		Enforced:    true,
		CheckFunc: func(ctx *PipelineContext) *Violation {
			for _, secret := range ctx.Secrets {
				if containsSecretPattern(secret) {
					return &Violation{
						PolicyID:    "no-secrets-in-env",
						PolicyName:  "No Hardcoded Secrets",
						Severity:    "critical",
						Description: fmt.Sprintf("Hardcoded secret detected: %s", maskSecret(secret)),
						Remediation: "Use credential management (GitHub Secrets, GitLab CI/CD vars, vault)",
					}
				}
			}
			return nil
		},
	}
}

// policyRequireBranchProtection checks main branch safety.
func policyRequireBranchProtection() Policy {
	return Policy{
		ID:          "require-branch-protection",
		Name:        "Require Branch Protection",
		Description: "Production deploys from protected branches only",
		Severity:    "high",
		Enforced:    true,
		CheckFunc: func(ctx *PipelineContext) *Violation {
			isMain := strings.ToLower(ctx.Branch) == "main" || strings.ToLower(ctx.Branch) == "master"
			if isMain && (containsPermission(ctx.Permissions, "push") || containsPermission(ctx.Permissions, "admin")) {
				return &Violation{
					PolicyID:    "require-branch-protection",
					PolicyName:  "Require Branch Protection",
					Severity:    "high",
					Description: "Direct push to main branch with elevated permissions",
					Remediation: "Enable branch protection rules requiring reviews",
				}
			}
			return nil
		},
	}
}

// policyRequireSBOM checks for software bill of materials generation.
func policyRequireSBOM() Policy {
	return Policy{
		ID:          "require-sbom",
		Name:        "Require SBOM",
		Description: "Generate Software Bill of Materials",
		Severity:    "medium",
		Enforced:    false,
		CheckFunc: func(ctx *PipelineContext) *Violation {
			if !ctx.HasSBOM && !containsStep(ctx.Steps, "sbom") {
				return &Violation{
					PolicyID:    "require-sbom",
					PolicyName:  "Require SBOM",
					Severity:    "medium",
					Description: "No SBOM generation detected",
					Remediation: "Add SBOM step (cyclonedx, syft)",
				}
			}
			return nil
		},
	}
}

// policyRequireSAST checks for static security scanning.
func policyRequireSAST() Policy {
	return Policy{
		ID:          "require-sast",
		Name:        "Require SAST Scanning",
		Description: "Include static application security testing",
		Severity:    "high",
		Enforced:    true,
		CheckFunc: func(ctx *PipelineContext) *Violation {
			if !ctx.HasSAST && !containsStep(ctx.Steps, "sast") && !containsStep(ctx.Steps, "scan") {
				return &Violation{
					PolicyID:    "require-sast",
					PolicyName:  "Require SAST Scanning",
					Severity:    "high",
					Description: "No SAST tool detected",
					Remediation: "Add SAST tool (semgrep, sonarqube, codeql)",
				}
			}
			return nil
		},
	}
}

// policyRequireCodeReview checks for review permissions.
func policyRequireCodeReview() Policy {
	return Policy{
		ID:          "require-code-review",
		Name:        "Require Code Review",
		Description: "Require approval before merge",
		Severity:    "high",
		Enforced:    true,
		CheckFunc: func(ctx *PipelineContext) *Violation {
			hasReview := containsPermission(ctx.Permissions, "pull_request_review") ||
				containsPermission(ctx.Permissions, "review") ||
				containsPermission(ctx.Permissions, "approve")
			if !hasReview {
				return &Violation{
					PolicyID:    "require-code-review",
					PolicyName:  "Require Code Review",
					Severity:    "high",
					Description: "No code review requirement detected",
					Remediation: "Configure branch protection for reviews",
				}
			}
			return nil
		},
	}
}

// policyNoBroadPermissions checks for least privilege access.
func policyNoBroadPermissions() Policy {
	return Policy{
		ID:          "no-broad-permissions",
		Name:        "Restrict Broad Permissions",
		Description: "Restrict overly permissive access",
		Severity:    "high",
		Enforced:    true,
		CheckFunc: func(ctx *PipelineContext) *Violation {
			for _, perm := range ctx.Permissions {
				if isBroadPermission(perm) {
					return &Violation{
						PolicyID:    "no-broad-permissions",
						PolicyName:  "Restrict Broad Permissions",
						Severity:    "high",
						Description: fmt.Sprintf("Overly broad permission: %s", perm),
						Remediation: "Apply least-privilege principle",
					}
				}
			}
			return nil
		},
	}
}
