package heal

import (
	"testing"
)

func TestStrategies(t *testing.T) {
	tests := []struct {
		name    string
		output  string
		pattern string
	}{
		{"go dep", "no required module provides foo", "go-missing-dep"},
		{"go mod not found", "module not found bar", "go-missing-dep"},
		{"node dep", "Cannot find module 'express'", "node-missing-dep"},
		{"node module", "MODULE_NOT_FOUND", "node-missing-dep"},
		{"python dep", "ModuleNotFoundError: No module named 'flask'", "python-missing-dep"},
		{"python alt", "No module named 'requests'", "python-missing-dep"},
		{"go fmt", "gofmt -d file.go", "go-fmt"},
		{"prettier", "prettier Check failed", "prettier-fmt"},
		{"go lock", "go.sum is out of sync", "go-lockfile"},
		{"npm lock", "npm warn old package-lock", "npm-lockfile"},
		{"perm", "permission denied: './run.sh'", "permission-denied"},
		{"port", "address already in use :3000", "port-in-use"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var found *Fix
			for _, s := range allStrategies() {
				if f := s(tt.output); f != nil {
					found = f
					break
				}
			}
			if found == nil {
				t.Fatalf("expected fix for %q, got nil", tt.output)
			}
			if found.Pattern != tt.pattern {
				t.Errorf("pattern = %q, want %q", found.Pattern, tt.pattern)
			}
		})
	}
}

func TestStrategiesUnknown(t *testing.T) {
	unknowns := []string{"something completely unexpected", "", "PASS ok all tests passed"}
	for _, output := range unknowns {
		for _, s := range allStrategies() {
			if f := s(output); f != nil {
				t.Errorf("expected nil for %q, got %+v", output, f)
			}
		}
	}
}

func TestHealResultAggregation(t *testing.T) {
	tests := []struct {
		fixes int
		fixed bool
	}{
		{0, false}, {1, true}, {3, true},
	}
	for _, tt := range tests {
		r := &HealResult{}
		for i := 0; i < tt.fixes; i++ {
			r.Fixes = append(r.Fixes, Fix{Pattern: "test"})
		}
		r.Fixed = len(r.Fixes) > 0
		if r.Fixed != tt.fixed {
			t.Errorf("fixes=%d: Fixed = %v, want %v", tt.fixes, r.Fixed, tt.fixed)
		}
	}
}

func TestParseAIResponse(t *testing.T) {
	tests := []struct {
		name    string
		text    string
		pattern string
	}{
		{"cmd fix", "CMD: go mod tidy", "ai-cmd"},
		{"file fix", "FILE: main.go\nPATCH:\npackage main", "ai-patch"},
		{"no fix", "I don't know what's wrong", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fix := parseAIResponse(tt.text)
			if tt.pattern == "" && fix != nil {
				t.Errorf("expected nil, got %+v", fix)
			}
			if tt.pattern != "" && (fix == nil || fix.Pattern != tt.pattern) {
				t.Errorf("pattern = %v, want %q", fix, tt.pattern)
			}
		})
	}
}
