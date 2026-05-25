package intel

import (
	"context"
	"testing"

	"github.com/finsavvyai/pushci/internal/ai"
)

func TestAnalyzeRootCauseLocal(t *testing.T) {
	tests := []struct {
		name     string
		check    string
		output   string
		category string
	}{
		{"go module missing", "build", "go: github.com/foo/bar module github.com/foo/bar not found", "dependency"},
		{"test failure", "test", "--- FAIL: TestFoo", "test"},
		{"permission error", "deploy", "permission denied: ./deploy.sh", "runtime"},
		{"unknown error", "lint", "some random output", "unknown"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rc := AnalyzeRootCause(context.Background(), ai.NewClient(), tt.check, tt.output)
			if rc == nil {
				t.Fatal("expected non-nil root cause")
			}
			if tt.category != "unknown" && rc.Category != tt.category {
				t.Errorf("category = %q, want %q", rc.Category, tt.category)
			}
			if rc.Summary == "" {
				t.Error("expected non-empty summary")
			}
		})
	}
}

func TestParseRootCause(t *testing.T) {
	input := `CATEGORY: dependency
SUMMARY: Missing npm package "lodash"
FILES: package.json, src/utils.ts
FIX: npm install lodash
FIX: Add lodash to package.json dependencies`

	rc := parseRootCause(input)
	if rc.Category != "dependency" {
		t.Errorf("category = %q, want dependency", rc.Category)
	}
	if rc.Summary != `Missing npm package "lodash"` {
		t.Errorf("unexpected summary: %q", rc.Summary)
	}
	if len(rc.AffectedFiles) != 2 {
		t.Errorf("affected files = %d, want 2", len(rc.AffectedFiles))
	}
	if len(rc.FixSteps) != 2 {
		t.Errorf("fix steps = %d, want 2", len(rc.FixSteps))
	}
}
