package security

import "testing"

func TestPolicyEngineDefaults(t *testing.T) {
	pe := NewPolicyEngine()
	policies := pe.ListPolicies()
	if len(policies) != 6 {
		t.Errorf("policies = %d, want 6", len(policies))
	}
}

func TestPolicyEvaluatePass(t *testing.T) {
	pe := NewPolicyEngine()
	ctx := PolicyContext{TestsPassed: true, SecretLeak: false}
	violations := pe.Evaluate(ctx)
	if len(violations) != 0 {
		t.Errorf("violations = %d, want 0", len(violations))
	}
}

func TestPolicyEvaluateFail(t *testing.T) {
	pe := NewPolicyEngine()
	ctx := PolicyContext{TestsPassed: false, SecretLeak: true}
	violations := pe.Evaluate(ctx)
	if len(violations) != 2 {
		t.Errorf("violations = %d, want 2", len(violations))
	}
}

func TestCanDeploy(t *testing.T) {
	pe := NewPolicyEngine()
	ok, _ := pe.CanDeploy(PolicyContext{TestsPassed: true})
	if !ok {
		t.Error("expected deploy allowed")
	}
	ok, msg := pe.CanDeploy(PolicyContext{TestsPassed: false})
	if ok {
		t.Error("expected deploy blocked")
	}
	if msg == "" {
		t.Error("expected block reason")
	}
}

func TestProductionDeployRequiresApprovalsAndProtectedBranch(t *testing.T) {
	pe := NewPolicyEngine()

	ok, msg := pe.CanDeploy(PolicyContext{
		Environment:     "production",
		TestsPassed:     true,
		ApprovalCount:   1,
		ProtectedBranch: false,
	})
	if ok {
		t.Fatal("expected production deploy to be blocked")
	}
	if msg == "" {
		t.Fatal("expected block reason")
	}

	ok, msg = pe.CanDeploy(PolicyContext{
		Environment:     "production",
		TestsPassed:     true,
		ApprovalCount:   2,
		ProtectedBranch: true,
	})
	if !ok {
		t.Fatalf("expected production deploy allowed, got %q", msg)
	}
}

func TestProductionDeployBlocksAuthorExecution(t *testing.T) {
	pe := NewPolicyEngine()
	ok, msg := pe.CanDeploy(PolicyContext{
		Environment:     "production",
		TestsPassed:     true,
		ApprovalCount:   2,
		ProtectedBranch: true,
		ActorIsAuthor:   true,
	})
	if ok {
		t.Fatal("expected self-deploy to be blocked")
	}
	if msg == "" {
		t.Fatal("expected block reason for self-deploy")
	}
}

func TestScanForSecrets(t *testing.T) {
	tests := []struct {
		name    string
		content string
		count   int
	}{
		{"api key", `api_key = "ABCDEFGHIJKLMNOP"`, 1},
		{"github token", `token: ghp_abcdefghijklmnopqrstuvwxyz1234567890`, 1},
		{"clean code", `const x = "hello"`, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			findings := ScanForSecrets("test.go", tt.content)
			if len(findings) != tt.count {
				t.Errorf("findings = %d, want %d", len(findings), tt.count)
			}
		})
	}
}
