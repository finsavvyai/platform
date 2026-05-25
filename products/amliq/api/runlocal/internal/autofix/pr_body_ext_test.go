package autofix

import (
	"strings"
	"testing"

	"github.com/finsavvyai/pushci/internal/heal"
)

func TestClassifyConfidence(t *testing.T) {
	tests := []struct {
		pattern string
		want    string
	}{
		{"ai", "AI-generated (review recommended)"},
		{"ai-generated", "AI-generated (review recommended)"},
		{"go-missing-dep", "Pattern match (high confidence)"},
		{"node-missing-dep", "Pattern match (high confidence)"},
	}
	for _, tt := range tests {
		t.Run(tt.pattern, func(t *testing.T) {
			if got := classifyConfidence(tt.pattern); got != tt.want {
				t.Errorf("classifyConfidence(%q) = %q, want %q",
					tt.pattern, got, tt.want)
			}
		})
	}
}

func TestFormatPRBodyDeduplicatesChecksAndFiles(t *testing.T) {
	fixes := []heal.Fix{
		{Check: "build", Pattern: "p1", Action: "a1", FilesChanged: []string{"f.go"}},
		{Check: "build", Pattern: "p2", Action: "a2", FilesChanged: []string{"f.go"}},
	}
	body := FormatPRBody(fixes, "")
	// "What failed" section should deduplicate checks
	section := body[:strings.Index(body, "### What was fixed")]
	checkCount := strings.Count(section, "**build**")
	if checkCount != 1 {
		t.Errorf("'What failed' has build %d times, want 1", checkCount)
	}
	// "Files changed" section should deduplicate files
	fileSection := body[strings.Index(body, "### Files changed"):]
	fileCount := strings.Count(fileSection, "`f.go`")
	if fileCount != 1 {
		t.Errorf("'Files changed' has f.go %d times, want 1", fileCount)
	}
}
