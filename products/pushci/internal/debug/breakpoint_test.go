package debug

import (
	"testing"

	"github.com/finsavvyai/pushci/internal/runner"
)

func TestShouldBreak(t *testing.T) {
	tests := []struct {
		name       string
		check      string
		breakAfter string
		want       bool
	}{
		{"exact match", "build", "build", true},
		{"suffix match", "root/build", "build", true},
		{"no match", "test", "build", false},
		{"empty breakAfter", "build", "", false},
		{"empty check", "", "build", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := shouldBreak(tt.check, tt.breakAfter); got != tt.want {
				t.Errorf("shouldBreak(%q, %q) = %v, want %v",
					tt.check, tt.breakAfter, got, tt.want)
			}
		})
	}
}

func TestNewDebugRunner(t *testing.T) {
	dr := NewDebugRunner()
	if dr == nil {
		t.Fatal("NewDebugRunner returned nil")
	}
	state := dr.Inspect()
	if state == nil {
		t.Fatal("Inspect returned nil")
	}
	if state.Paused {
		t.Error("initial state should not be paused")
	}
	if len(state.Completed) != 0 {
		t.Errorf("initial completed = %d, want 0", len(state.Completed))
	}
}

func TestInspectReturnsCurrentState(t *testing.T) {
	dr := NewDebugRunner()
	dr.state.Current = "lint"
	dr.state.Completed = []runner.Result{
		{Check: "build", Passed: true},
	}
	dr.state.Env = map[string]string{"GO111MODULE": "on"}

	s := dr.Inspect()
	if s.Current != "lint" {
		t.Errorf("Current = %q, want 'lint'", s.Current)
	}
	if len(s.Completed) != 1 {
		t.Errorf("Completed = %d, want 1", len(s.Completed))
	}
	if s.Env["GO111MODULE"] != "on" {
		t.Error("Env should contain GO111MODULE=on")
	}
}

func TestInspectReturnsSamePointer(t *testing.T) {
	dr := NewDebugRunner()
	s1 := dr.Inspect()
	s2 := dr.Inspect()
	if s1 != s2 {
		t.Error("Inspect should return pointer to same state")
	}
}

func TestShouldBreakPartialNoMatch(t *testing.T) {
	// "buil" is not a suffix of "build"
	if shouldBreak("buil", "build") {
		t.Error("partial non-suffix should not match")
	}
}
