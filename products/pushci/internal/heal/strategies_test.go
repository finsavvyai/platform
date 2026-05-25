package heal

import "testing"

func TestAllStrategiesCount(t *testing.T) {
	// 9 base + 4 D1 + 4 wrangler + 5 TS + 1 filesize + 3 graph = 26
	if got := len(allStrategies()); got != 26 {
		t.Fatalf("expected 26 strategies, got %d", got)
	}
}
func TestMissingDep(t *testing.T) {
	tests := []struct {
		output string
		want   bool
	}{
		{"go: module not found foo", true},
		{"no required module provides bar", true},
		{"all tests passed", false},
	}
	for _, tt := range tests {
		got := missingDep(tt.output)
		if (got != nil) != tt.want {
			t.Errorf("missingDep(%q) = %v, want %v", tt.output, got, tt.want)
		}
		if got != nil && got.Action != "go mod tidy" {
			t.Errorf("action = %q, want 'go mod tidy'", got.Action)
		}
	}
}

func TestMissingNodeDep(t *testing.T) {
	tests := []struct {
		output string
		want   bool
	}{
		{"Cannot find module 'express'", true},
		{"MODULE_NOT_FOUND", true},
		{"build succeeded", false},
	}
	for _, tt := range tests {
		got := missingNodeDep(tt.output)
		if (got != nil) != tt.want {
			t.Errorf("missingNodeDep(%q) = %v, want %v", tt.output, got, tt.want)
		}
	}
}

func TestMissingPyDep(t *testing.T) {
	tests := []struct {
		output string
		want   bool
	}{
		{"ModuleNotFoundError: No module named 'flask'", true},
		{"No module named 'requests'", true},
		{"OK", false},
	}
	for _, tt := range tests {
		got := missingPyDep(tt.output)
		if (got != nil) != tt.want {
			t.Errorf("missingPyDep(%q) = %v, want %v", tt.output, got, tt.want)
		}
	}
}
func TestFmtError(t *testing.T) {
	tests := []struct {
		output, pattern string
	}{
		{"gofmt -d file.go", "go-fmt"},
		{"goimports check failed", "go-fmt"},
		{"prettier Check failed", "prettier-fmt"},
		{"all good", ""},
	}
	for _, tt := range tests {
		got := fmtError(tt.output)
		if tt.pattern == "" && got != nil {
			t.Errorf("expected nil for %q, got %+v", tt.output, got)
		}
		if tt.pattern != "" && (got == nil || got.Pattern != tt.pattern) {
			t.Errorf("fmtError(%q) pattern = %v, want %q", tt.output, got, tt.pattern)
		}
	}
}

func TestLockfileOutdated(t *testing.T) {
	tests := []struct {
		output, pattern string
	}{
		{"go.sum is out of sync", "go-lockfile"},
		{"npm warn old package-lock", "npm-lockfile"},
		{"all good", ""},
	}
	for _, tt := range tests {
		got := lockfileOutdated(tt.output)
		if tt.pattern == "" && got != nil {
			t.Errorf("expected nil for %q, got %+v", tt.output, got)
		}
		if tt.pattern != "" && (got == nil || got.Pattern != tt.pattern) {
			t.Errorf("lockfileOutdated(%q) = %v, want %q", tt.output, got, tt.pattern)
		}
	}
}
