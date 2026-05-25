package autofix

import (
	"strings"
	"testing"

	"github.com/finsavvyai/pushci/internal/heal"
)

func TestFormatPRBodyPatternFixes(t *testing.T) {
	fixes := []heal.Fix{{
		Check: "build", Pattern: "go-missing-dep",
		Action: "go mod tidy", FilesChanged: []string{"go.sum"},
	}}
	body := FormatPRBody(fixes, "")
	for _, want := range []string{
		"## PushCI Auto-Fix", "### What failed", "**build**",
		"go mod tidy", "`go-missing-dep`", "`go.sum`",
		"high confidence", "PushCI.dev",
	} {
		if !strings.Contains(body, want) {
			t.Errorf("body missing %q", want)
		}
	}
}

func TestFormatPRBodyAIFixes(t *testing.T) {
	fixes := []heal.Fix{{
		Check: "lint", Pattern: "ai-generated",
		Action: "fix lint errors", FilesChanged: []string{"main.go"},
	}}
	body := FormatPRBody(fixes, "AI detected unused import")
	for _, want := range []string{
		"AI-generated (review recommended)",
		"### Diagnosis", "AI detected unused import",
	} {
		if !strings.Contains(body, want) {
			t.Errorf("body missing %q", want)
		}
	}
}

func TestFormatPRBodyEmpty(t *testing.T) {
	body := FormatPRBody(nil, "")
	if !strings.Contains(body, "## PushCI Auto-Fix") {
		t.Error("empty fixes should still have header")
	}
	if strings.Contains(body, "### Diagnosis") {
		t.Error("empty diagnosis should omit section")
	}
}

func TestFormatPRBodyMultipleFixes(t *testing.T) {
	fixes := []heal.Fix{
		{Check: "build", Pattern: "go-dep", Action: "go mod tidy"},
		{Check: "lint", Pattern: "go-fmt", Action: "go fmt ./..."},
	}
	body := FormatPRBody(fixes, "")
	if !strings.Contains(body, "go mod tidy") {
		t.Error("body missing first action")
	}
	if !strings.Contains(body, "go fmt ./...") {
		t.Error("body missing second action")
	}
}

func TestWriteDiagnosis(t *testing.T) {
	tests := []struct {
		name  string
		input string
		empty bool
	}{
		{"empty", "", true},
		{"non-empty", "something broke", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var b strings.Builder
			writeDiagnosis(&b, tt.input)
			if tt.empty && b.Len() != 0 {
				t.Error("empty diagnosis should write nothing")
			}
			if !tt.empty && !strings.Contains(b.String(), tt.input) {
				t.Error("diagnosis text missing")
			}
		})
	}
}
