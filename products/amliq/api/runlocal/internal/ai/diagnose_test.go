package ai

import (
	"testing"

	"github.com/finsavvyai/pushci/internal/runner"
)

func TestLocalDiagnose(t *testing.T) {
	tests := []struct {
		name       string
		output     string
		wantExpl   string
		wantNil    bool
	}{
		{
			name:     "go module not found",
			output:   "go: module not found: github.com/foo/bar",
			wantExpl: "Go module dependency is missing.",
		},
		{
			name:     "node module missing",
			output:   "Error: Cannot find module 'express'",
			wantExpl: "Node.js dependency is missing.",
		},
		{
			name:     "python import error",
			output:   "ModuleNotFoundError: No module named 'flask'",
			wantExpl: "Python module is not installed.",
		},
		{
			name:     "permission denied",
			output:   "bash: ./script.sh: permission denied",
			wantExpl: "File or directory permission issue.",
		},
		{
			name:     "port in use",
			output:   "listen tcp :8080: address already in use",
			wantExpl: "Port is already bound by another process.",
		},
		{
			name:     "test failure",
			output:   "--- FAIL: TestSomething (0.00s)",
			wantExpl: "One or more tests failed.",
		},
		{
			name:    "unknown error",
			output:  "some random error nobody recognizes",
			wantNil: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := runner.Result{
				Check:  "test",
				Output: tt.output,
				Passed: false,
			}
			d := localDiagnose(r)
			if tt.wantNil {
				if d != nil {
					t.Errorf("expected nil, got %v", d)
				}
				return
			}
			if d == nil {
				t.Fatal("expected diagnosis, got nil")
			}
			if d.Explanation != tt.wantExpl {
				t.Errorf("explanation = %q, want %q", d.Explanation, tt.wantExpl)
			}
		})
	}
}
