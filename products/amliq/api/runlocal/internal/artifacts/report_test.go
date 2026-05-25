package artifacts

import (
	"strings"
	"testing"
)

func TestReportFormatting(t *testing.T) {
	changes := []SizeChange{
		{Name: "docker-image", OldSize: 180_000_000, NewSize: 256_000_000,
			DiffBytes: 76_000_000, DiffPercent: 42.2},
		{Name: "js-bundle", OldSize: 2_000_000, NewSize: 1_700_000,
			DiffBytes: -300_000, DiffPercent: -15.0},
	}

	report := Report(changes)

	tests := []struct {
		name     string
		contains string
	}{
		{"has header", "## Artifact Size Report"},
		{"has docker", "docker-image"},
		{"has bundle", "js-bundle"},
		{"has bloat warning", "Bloat Warnings"},
		{"has growth pct", "42"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if !strings.Contains(report, tt.contains) {
				t.Errorf("report missing %q", tt.contains)
			}
		})
	}
}

func TestReportEmpty(t *testing.T) {
	report := Report(nil)
	if report != "No artifact changes detected." {
		t.Errorf("unexpected report for empty: %q", report)
	}
}
