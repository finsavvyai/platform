package policy

import (
	"strings"
)

// Policy defines a pipeline security policy rule.
type Policy struct {
	ID          string
	Name        string
	Description string
	Severity    string // critical, high, medium, low
	Enforced    bool
	CheckFunc   func(pipeline *PipelineContext) *Violation
}

// PipelineContext contains pipeline metadata for policy evaluation.
type PipelineContext struct {
	Platform    string   `json:"platform"`
	Branch      string   `json:"branch"`
	HasTests    bool     `json:"has_tests"`
	HasLint     bool     `json:"has_lint"`
	HasSAST     bool     `json:"has_sast"`
	HasSBOM     bool     `json:"has_sbom"`
	Permissions []string `json:"permissions"`
	Secrets     []string `json:"secrets"`
	Steps       []string `json:"steps"`
}

// Violation represents a policy violation.
type Violation struct {
	PolicyID    string `json:"policy_id"`
	PolicyName  string `json:"policy_name"`
	Severity    string `json:"severity"`
	Description string `json:"description"`
	Remediation string `json:"remediation"`
}

// Evaluator runs policies against pipeline context.
type Evaluator struct {
	policies []Policy
}

// NewEvaluator creates a new policy evaluator with default policies.
func NewEvaluator() *Evaluator {
	e := &Evaluator{
		policies: []Policy{},
	}
	e.loadDefaultPolicies()
	return e
}

// AddPolicy adds a custom policy to the evaluator.
func (e *Evaluator) AddPolicy(p Policy) {
	e.policies = append(e.policies, p)
}

// Evaluate runs all policies against the given pipeline context.
func (e *Evaluator) Evaluate(ctx *PipelineContext) []Violation {
	var violations []Violation

	for _, policy := range e.policies {
		if violation := policy.CheckFunc(ctx); violation != nil {
			violations = append(violations, *violation)
		}
	}

	return violations
}

// loadDefaultPolicies initializes default security policies.
func (e *Evaluator) loadDefaultPolicies() {
	e.AddPolicy(policyRequireTests())
	e.AddPolicy(policyRequireLint())
	e.AddPolicy(policyNoSecretsInEnv())
	e.AddPolicy(policyRequireBranchProtection())
	e.AddPolicy(policyRequireSBOM())
	e.AddPolicy(policyRequireSAST())
	e.AddPolicy(policyRequireCodeReview())
	e.AddPolicy(policyNoBroadPermissions())
}

// Helper functions

func containsStep(steps []string, keyword string) bool {
	keyword = strings.ToLower(keyword)
	for _, step := range steps {
		if strings.Contains(strings.ToLower(step), keyword) {
			return true
		}
	}
	return false
}

func containsPermission(permissions []string, keyword string) bool {
	keyword = strings.ToLower(keyword)
	for _, perm := range permissions {
		if strings.Contains(strings.ToLower(perm), keyword) {
			return true
		}
	}
	return false
}

func containsSecretPattern(s string) bool {
	patterns := []string{
		"password", "secret", "token", "key", "credential", "auth",
		"AKIA", "ghp_", "gho_", "ghs_", "glpat-", "xoxb-", "xoxp-",
	}
	s = strings.ToLower(s)
	for _, pattern := range patterns {
		if strings.Contains(s, strings.ToLower(pattern)) {
			return true
		}
	}
	return false
}

func isBroadPermission(perm string) bool {
	broadPerms := []string{"*", "admin", "sudo", "root"}
	perm = strings.ToLower(perm)
	for _, broad := range broadPerms {
		if perm == broad || strings.Contains(perm, ":*") {
			return true
		}
	}
	return false
}

func maskSecret(secret string) string {
	if len(secret) <= 4 {
		return "****"
	}
	return secret[:4] + "****"
}
