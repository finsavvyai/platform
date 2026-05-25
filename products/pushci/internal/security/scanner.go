package security

import (
	"fmt"
	"strings"
	"time"
)

// ScanType represents the kind of security scan.
type ScanType string

const (
	ScanSAST   ScanType = "sast"
	ScanDeps   ScanType = "dependency"
	ScanSecret ScanType = "secret"
	ScanSBOM   ScanType = "sbom"
)

// Finding represents a security issue found during scanning.
type Finding struct {
	Type     ScanType `json:"type"`
	Severity string   `json:"severity"` // critical, high, medium, low
	File     string   `json:"file"`
	Line     int      `json:"line"`
	Message  string   `json:"message"`
	CVE      string   `json:"cve,omitempty"`
}

// ScanResult holds the output of a security scan.
type ScanResult struct {
	Type     ScanType      `json:"type"`
	Findings []Finding     `json:"findings"`
	Duration time.Duration `json:"duration"`
	Passed   bool          `json:"passed"`
}

// SecretPatterns lives in scanner_patterns.go.

// ScanForSecrets checks source code for hardcoded secrets.
func ScanForSecrets(filename, content string) []Finding {
	var findings []Finding
	lines := strings.Split(content, "\n")
	for i, line := range lines {
		for _, re := range SecretPatterns {
			if re.MatchString(line) {
				findings = append(findings, Finding{
					Type:     ScanSecret,
					Severity: "critical",
					File:     filename,
					Line:     i + 1,
					Message:  "Potential hardcoded secret detected",
				})
			}
		}
	}
	return findings
}

// GenerateSBOM creates a software bill of materials.
func GenerateSBOM(projectName string, deps []string) string {
	sbom := fmt.Sprintf("SPDXVersion: SPDX-2.3\nDocumentName: %s\n", projectName)
	for _, dep := range deps {
		sbom += fmt.Sprintf("Package: %s\n", dep)
	}
	return sbom
}
