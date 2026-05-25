package runner

import (
	"strings"
	"testing"
	"time"
)

func TestTruncate(t *testing.T) {
	tests := []struct {
		name  string
		input string
		max   int
		want  string
	}{
		{"under limit", "hello", 10, "hello"},
		{"exact limit", "hello", 5, "hello"},
		{"over limit keeps tail", "abcdefghij", 5, "fghij"},
		{"empty", "", 5, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := truncate(tt.input, tt.max)
			if got != tt.want {
				t.Errorf("truncate(%q, %d) = %q, want %q",
					tt.input, tt.max, got, tt.want)
			}
		})
	}
}

func TestRunSummary(t *testing.T) {
	run := &Run{
		Results: []Result{
			{Check: "build", Passed: true, Duration: time.Second},
			{Check: "test", Passed: false, Duration: 2 * time.Second},
		},
		Passed:  false,
		Elapsed: 3 * time.Second,
	}
	summary := run.Summary()

	tests := []struct {
		name    string
		contain string
	}{
		{"header", "## PushCI CI Results"},
		{"pass icon", "pass **build**"},
		{"fail icon", "FAIL **test**"},
		{"total", "Total: 3s"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if !strings.Contains(summary, tt.contain) {
				t.Errorf("summary missing %q\ngot: %s", tt.contain, summary)
			}
		})
	}
}

func TestRunPassedFlag(t *testing.T) {
	tests := []struct {
		name   string
		passed []bool
		want   bool
	}{
		{"all pass", []bool{true, true}, true},
		{"one fail", []bool{true, false}, false},
		{"empty", []bool{}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			run := &Run{Passed: true}
			for _, p := range tt.passed {
				run.Results = append(run.Results, Result{Passed: p})
			}
			// Recompute like Execute does
			for _, r := range run.Results {
				if !r.Passed {
					run.Passed = false
					break
				}
			}
			if run.Passed != tt.want {
				t.Errorf("Passed = %v, want %v", run.Passed, tt.want)
			}
		})
	}
}
