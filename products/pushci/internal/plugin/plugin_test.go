package plugin

import (
	"context"
	"testing"

	"github.com/finsavvyai/pushci/internal/config"
)

func TestRegistryRegisterAndGet(t *testing.T) {
	tests := []struct {
		name     string
		register string
		lookup   string
		found    bool
	}{
		{"found", "lint", "lint", true},
		{"not found", "lint", "test", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := NewRegistry()
			r.Register(tt.register, &LintPlugin{})
			got := r.Get(tt.lookup)
			if (got != nil) != tt.found {
				t.Errorf("Get(%q) found=%v, want %v", tt.lookup, got != nil, tt.found)
			}
		})
	}
}

func TestScriptPluginExecution(t *testing.T) {
	tests := []struct {
		name   string
		cmd    string
		passed bool
	}{
		{"echo succeeds", "echo hello", true},
		{"false fails", "false", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := &ScriptPlugin{PluginName: "test", Command: tt.cmd}
			res, err := p.Run(context.Background(), t.TempDir())
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if res.Passed != tt.passed {
				t.Errorf("Passed=%v, want %v", res.Passed, tt.passed)
			}
		})
	}
}

func TestLoadFromConfig(t *testing.T) {
	tests := []struct {
		name   string
		checks []config.Check
		count  int
	}{
		{"script check", []config.Check{{Name: "a", Run: "echo hi"}}, 1},
		{"docker check", []config.Check{{Name: "b", Docker: "alpine"}}, 1},
		{"builtin found", []config.Check{{Name: "lint"}}, 1},
		{"builtin missing", []config.Check{{Name: "unknown"}}, 0},
		{"mixed", []config.Check{
			{Name: "a", Run: "echo hi"},
			{Name: "lint"},
		}, 2},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reg := NewRegistry()
			reg.Register("lint", &LintPlugin{})
			got := LoadFromConfig(reg, tt.checks)
			if len(got) != tt.count {
				t.Errorf("got %d plugins, want %d", len(got), tt.count)
			}
		})
	}
}
