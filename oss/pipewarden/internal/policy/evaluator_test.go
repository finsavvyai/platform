package policy

import (
	"testing"
)

func TestEvaluator_RequireTests(t *testing.T) {
	e := NewEvaluator()
	ctx := &PipelineContext{
		Platform: "github",
		Branch:   "main",
		HasTests: false,
		Steps:    []string{"build", "deploy"},
	}

	violations := e.Evaluate(ctx)
	found := false
	for _, v := range violations {
		if v.PolicyID == "require-tests" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected require-tests violation")
	}
}

func TestEvaluator_TestsPassing(t *testing.T) {
	e := NewEvaluator()
	ctx := &PipelineContext{
		Platform: "github",
		Branch:   "main",
		HasTests: true,
		Steps:    []string{"build", "test", "deploy"},
	}

	violations := e.Evaluate(ctx)
	for _, v := range violations {
		if v.PolicyID == "require-tests" {
			t.Error("should not violate require-tests when tests are present")
		}
	}
}

func TestEvaluator_RequireLint(t *testing.T) {
	e := NewEvaluator()
	ctx := &PipelineContext{
		Platform: "gitlab",
		Branch:   "feature/x",
		HasLint:  false,
		Steps:    []string{"build", "test"},
	}

	violations := e.Evaluate(ctx)
	found := false
	for _, v := range violations {
		if v.PolicyID == "require-lint" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected require-lint violation")
	}
}

func TestEvaluator_NoSecretsInEnv(t *testing.T) {
	e := NewEvaluator()
	ctx := &PipelineContext{
		Platform: "github",
		Branch:   "main",
		Secrets:  []string{"API_KEY=secret123", "DB_PASSWORD=mysecretpass"},
	}

	violations := e.Evaluate(ctx)
	found := false
	for _, v := range violations {
		if v.PolicyID == "no-secrets-in-env" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected no-secrets-in-env violation")
	}
}

func TestEvaluator_NoSecretsPass(t *testing.T) {
	e := NewEvaluator()
	ctx := &PipelineContext{
		Platform: "github",
		Branch:   "main",
		Secrets:  []string{"ENVIRONMENT=production", "VERSION=1.0.0"},
	}

	violations := e.Evaluate(ctx)
	for _, v := range violations {
		if v.PolicyID == "no-secrets-in-env" {
			t.Error("should not violate when no secrets are present")
		}
	}
}

func TestEvaluator_BranchProtection(t *testing.T) {
	e := NewEvaluator()
	ctx := &PipelineContext{
		Platform:    "github",
		Branch:      "main",
		Permissions: []string{"push", "admin"},
	}

	violations := e.Evaluate(ctx)
	found := false
	for _, v := range violations {
		if v.PolicyID == "require-branch-protection" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected branch protection violation for main branch with push perms")
	}
}

func TestEvaluator_BranchProtectionFeatureBranch(t *testing.T) {
	e := NewEvaluator()
	ctx := &PipelineContext{
		Platform:    "github",
		Branch:      "feature/test",
		Permissions: []string{"push"},
	}

	violations := e.Evaluate(ctx)
	for _, v := range violations {
		if v.PolicyID == "require-branch-protection" {
			t.Error("should not violate branch protection on feature branch")
		}
	}
}

func TestEvaluator_RequireCodeReview(t *testing.T) {
	e := NewEvaluator()
	ctx := &PipelineContext{
		Platform:    "github",
		Branch:      "main",
		Permissions: []string{"read", "write"},
	}

	violations := e.Evaluate(ctx)
	found := false
	for _, v := range violations {
		if v.PolicyID == "require-code-review" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected code review violation")
	}
}

func TestEvaluator_CodeReviewPresent(t *testing.T) {
	e := NewEvaluator()
	ctx := &PipelineContext{
		Platform:    "github",
		Branch:      "main",
		Permissions: []string{"pull_request_review"},
	}

	violations := e.Evaluate(ctx)
	for _, v := range violations {
		if v.PolicyID == "require-code-review" {
			t.Error("should not violate when review permission is present")
		}
	}
}

func TestEvaluator_NoBroadPermissions(t *testing.T) {
	e := NewEvaluator()
	ctx := &PipelineContext{
		Platform:    "github",
		Branch:      "main",
		Permissions: []string{"*", "admin"},
	}

	violations := e.Evaluate(ctx)
	found := false
	for _, v := range violations {
		if v.PolicyID == "no-broad-permissions" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected no-broad-permissions violation")
	}
}

func TestEvaluator_LeastPrivilegePermissions(t *testing.T) {
	e := NewEvaluator()
	ctx := &PipelineContext{
		Platform:    "github",
		Branch:      "main",
		Permissions: []string{"read:repo", "write:deployments"},
	}

	violations := e.Evaluate(ctx)
	for _, v := range violations {
		if v.PolicyID == "no-broad-permissions" {
			t.Error("should not violate specific permissions")
		}
	}
}

func TestEvaluator_RequireSAST(t *testing.T) {
	e := NewEvaluator()
	ctx := &PipelineContext{
		Platform: "github",
		Branch:   "main",
		HasSAST:  false,
		Steps:    []string{"build", "test", "deploy"},
	}

	violations := e.Evaluate(ctx)
	found := false
	for _, v := range violations {
		if v.PolicyID == "require-sast" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected require-sast violation")
	}
}

func TestEvaluator_SASTDetectedInSteps(t *testing.T) {
	e := NewEvaluator()
	ctx := &PipelineContext{
		Platform: "github",
		Branch:   "main",
		HasSAST:  false,
		Steps:    []string{"build", "test", "security-scan", "deploy"},
	}

	violations := e.Evaluate(ctx)
	for _, v := range violations {
		if v.PolicyID == "require-sast" {
			t.Error("should not violate when sast step is in pipeline")
		}
	}
}

func TestEvaluator_MultipleViolations(t *testing.T) {
	e := NewEvaluator()
	ctx := &PipelineContext{
		Platform:    "github",
		Branch:      "main",
		HasTests:    false,
		HasLint:     false,
		HasSAST:     false,
		Steps:       []string{"build"},
		Permissions: []string{"*"},
		Secrets:     []string{"DATABASE_PASSWORD=secret123"},
	}

	violations := e.Evaluate(ctx)
	if len(violations) < 4 {
		t.Errorf("expected at least 4 violations, got %d", len(violations))
	}
}

func TestEvaluator_AddCustomPolicy(t *testing.T) {
	e := NewEvaluator()
	e.AddPolicy(Policy{
		ID:       "custom-test",
		Name:     "Custom Test",
		Severity: "low",
		CheckFunc: func(ctx *PipelineContext) *Violation {
			if ctx.Branch == "experimental" {
				return &Violation{
					PolicyID:   "custom-test",
					PolicyName: "Custom Test",
					Severity:   "low",
				}
			}
			return nil
		},
	})

	ctx := &PipelineContext{Branch: "experimental"}
	violations := e.Evaluate(ctx)

	found := false
	for _, v := range violations {
		if v.PolicyID == "custom-test" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected custom policy violation")
	}
}

func TestEvaluator_ContainsStep(t *testing.T) {
	tests := []struct {
		name     string
		steps    []string
		keyword  string
		expected bool
	}{
		{"exact match", []string{"test", "build"}, "test", true},
		{"no match", []string{"build", "deploy"}, "test", false},
		{"partial match", []string{"unit-tests", "build"}, "test", true},
		{"case insensitive", []string{"TEST", "build"}, "test", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := containsStep(tt.steps, tt.keyword)
			if result != tt.expected {
				t.Errorf("containsStep(%v, %s) = %v, expected %v", tt.steps, tt.keyword, result, tt.expected)
			}
		})
	}
}
