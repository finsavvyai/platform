package security

import (
	"fmt"
	"strings"
)

// Policy defines a security rule that must pass before deploy.
type Policy struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Type        string `json:"type"`
	Enforce     bool   `json:"enforce"`
}

// PolicyEngine evaluates policies against a pipeline run.
type PolicyEngine struct {
	policies []Policy
}

// NewPolicyEngine creates a policy engine with default policies.
func NewPolicyEngine() *PolicyEngine {
	return &PolicyEngine{policies: defaultPolicies()}
}

// Violation represents a policy failure.
type Violation struct {
	Policy  string `json:"policy"`
	Message string `json:"message"`
}

// PolicyContext holds the data needed for policy evaluation.
type PolicyContext struct {
	Environment      string
	Branch           string
	TestsPassed      bool
	HasReview        bool
	ApprovalCount    int
	MinimumApprovals int
	SecretLeak       bool
	HasSBOM          bool
	ProtectedBranch  bool
	ActorIsAuthor    bool
}

// Evaluate checks all policies against the given context.
func (pe *PolicyEngine) Evaluate(ctx PolicyContext) []Violation {
	var violations []Violation
	for _, p := range pe.policies {
		if !p.Enforce {
			continue
		}
		if v := checkPolicy(p, ctx); v != nil {
			violations = append(violations, *v)
		}
	}
	return violations
}

// AddPolicy adds a custom policy to the engine.
func (pe *PolicyEngine) AddPolicy(p Policy) {
	pe.policies = append(pe.policies, p)
}

// ListPolicies returns all configured policies.
func (pe *PolicyEngine) ListPolicies() []Policy {
	return pe.policies
}

// CanDeploy returns true if all enforced policies pass.
func (pe *PolicyEngine) CanDeploy(ctx PolicyContext) (bool, string) {
	violations := pe.Evaluate(ctx)
	if len(violations) == 0 {
		return true, ""
	}
	return false, fmt.Sprintf("blocked: %s", violations[0].Message)
}

func isProduction(environment string) bool {
	return strings.EqualFold(environment, "production") || strings.EqualFold(environment, "prod")
}
