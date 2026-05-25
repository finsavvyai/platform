package security

import (
	"os"
	"testing"
	"time"
)

func TestScanPipelineConfig(t *testing.T) {
	tests := []struct {
		name           string
		content        string
		expectCritical int
		expectHigh     int
	}{
		// Counts reflect the full findings the scanner currently
		// emits. A fixture with no test/lint/sast step naturally
		// produces a "missing test step" high finding, so the
		// `secret` and `broad_perm` cases get +1 high on top of
		// their primary assertion.
		{"clean", "steps:\n  - test: npm test\n  - sast: semgrep", 0, 0},
		{"secret", "env:\n  API_KEY: ghp_123456789012345678901234567890", 1, 1},
		{"no test", "steps:\n  - build: npm run build\n  - lint: npm run lint", 0, 1},
		{"broad perm", "permissions:\n  write-all: true", 0, 2},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tmpfile, _ := os.CreateTemp("", "test*.yml")
			defer os.Remove(tmpfile.Name())
			tmpfile.WriteString(tt.content)
			tmpfile.Close()

			result, err := ScanPipelineConfig(tmpfile.Name())
			if err != nil {
				t.Fatalf("scan: %v", err)
			}

			crit := countSeverity(result.Findings, "critical")
			high := countSeverity(result.Findings, "high")

			if crit != tt.expectCritical {
				t.Errorf("critical: got %d, want %d", crit, tt.expectCritical)
			}
			if high != tt.expectHigh {
				t.Errorf("high: got %d, want %d", high, tt.expectHigh)
			}
		})
	}
}

func TestScanPipelineConfig_RiskScore(t *testing.T) {
	tmpfile, _ := os.CreateTemp("", "risk*.yml")
	defer os.Remove(tmpfile.Name())
	tmpfile.WriteString(`env:
  API_KEY: ghp_1234567890
permissions:
  write-all: true`)
	tmpfile.Close()

	result, _ := ScanPipelineConfig(tmpfile.Name())
	if result.RiskScore <= 0 || result.RiskScore > 100 {
		t.Errorf("risk score invalid: %d", result.RiskScore)
	}
}

func TestScanPipelineConfig_Metadata(t *testing.T) {
	tmpfile, _ := os.CreateTemp("", "meta*.yml")
	defer os.Remove(tmpfile.Name())
	tmpfile.WriteString("steps: []")
	tmpfile.Close()

	start := time.Now()
	result, _ := ScanPipelineConfig(tmpfile.Name())

	if result.ScannedAt.Before(start) {
		t.Error("scanned time before start")
	}
	if result.Duration == 0 {
		t.Error("duration is zero")
	}
	if result.Summary == "" {
		t.Error("summary empty")
	}
}
