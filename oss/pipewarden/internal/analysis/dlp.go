package analysis

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/finsavvyai/pipewarden/internal/tracing"
)

// DLPScanner detects sensitive data patterns in pipeline configurations.
type DLPScanner struct {
	patterns []sensitivePattern
}

// DLPFinding represents a detected sensitive data pattern.
type DLPFinding struct {
	Pattern        string         `json:"pattern"`
	Match          string         `json:"match"` // redacted match (first 4 chars + ****)
	File           string         `json:"file"`
	Line           int            `json:"line"`
	Severity       Severity       `json:"severity"`
	Category       Category       `json:"category"`
	Confidence     float64        `json:"confidence"`      // 0.0 to 1.0
	ValidityStatus ValidityStatus `json:"validity_status"` // unknown until validator runs
	Identity       string         `json:"identity,omitempty"`
}

// ScanContent scans text content for sensitive data patterns.
func (d *DLPScanner) ScanContent(content, filename string) []DLPFinding {
	var findings []DLPFinding
	lines := strings.Split(content, "\n")

	for lineNum, line := range lines {
		for _, pattern := range d.patterns {
			matches := pattern.regex.FindAllStringIndex(line, -1)
			for _, match := range matches {
				start, end := match[0], match[1]
				matchedText := line[start:end]
				redacted := redactSecret(matchedText, 4)

				findings = append(findings, DLPFinding{
					Pattern:        pattern.name,
					Match:          redacted,
					File:           filename,
					Line:           lineNum + 1,
					Severity:       pattern.severity,
					Category:       pattern.category,
					Confidence:     pattern.confidence,
					ValidityStatus: ValidityUnknown,
				})
			}
		}
	}

	return findings
}

// ScanFile reads and scans a file for sensitive data patterns.
func (d *DLPScanner) ScanFile(filepath string) ([]DLPFinding, error) {
	content, err := os.ReadFile(filepath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	return d.ScanContent(string(content), filepath), nil
}

// ValidateFindings runs live validity checks on all findings that have an extractable secret.
// Findings are mutated in-place with ValidityStatus and Identity.
func (d *DLPScanner) ValidateFindings(ctx context.Context, content string, findings []DLPFinding) {
	defer tracing.Region(ctx, "pipewarden.dlp.validate")()
	v := NewSecretValidator()
	lines := strings.Split(content, "\n")

	for i, f := range findings {
		if f.Line <= 0 || f.Line > len(lines) {
			continue
		}
		line := lines[f.Line-1]
		secret := extractSecret(f.Pattern, line)
		if secret == "" {
			findings[i].ValidityStatus = ValiditySkipped
			continue
		}
		result := v.Validate(ctx, f.Pattern, secret)
		findings[i].ValidityStatus = result.Status
		findings[i].Identity = result.Identity
		if result.Status == ValidityActive {
			findings[i].Confidence = 1.0
		}
	}
}

// redactSecret returns a redacted version of the secret with first N chars visible.
func redactSecret(secret string, visibleChars int) string {
	if len(secret) <= visibleChars {
		return "****"
	}
	return secret[:visibleChars] + "****"
}
