package analysis

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// SemgrepResult holds parsed output from a semgrep run.
type SemgrepResult struct {
	Findings []Finding
	Skipped  bool   // true if semgrep binary not found
	Error    string // non-fatal error message
}

// SemgrepScanner runs semgrep against pipeline config files.
type SemgrepScanner struct {
	binaryPath string // resolved path to semgrep binary
}

// NewSemgrepScanner creates a scanner, resolving the semgrep binary path.
// If semgrep is not installed, the scanner still works but returns Skipped=true.
func NewSemgrepScanner() *SemgrepScanner {
	path, _ := exec.LookPath("semgrep")
	return &SemgrepScanner{binaryPath: path}
}

// Available reports whether the semgrep binary is installed.
func (s *SemgrepScanner) Available() bool {
	return s.binaryPath != ""
}

// ScanContent writes content to a temp file and runs semgrep on it.
// Uses the p/ci ruleset for pipeline-relevant checks.
func (s *SemgrepScanner) ScanContent(ctx context.Context, content, filename, connName, runID string) (*SemgrepResult, error) {
	if !s.Available() {
		return &SemgrepResult{Skipped: true, Error: "semgrep not installed"}, nil
	}

	ext := filepath.Ext(filename)
	if ext == "" {
		ext = ".yml"
	}
	tmp, err := os.CreateTemp("", "pipewarden-semgrep-*"+ext)
	if err != nil {
		return nil, fmt.Errorf("create temp file: %w", err)
	}
	defer func() { _ = os.Remove(tmp.Name()) }()

	if _, err := tmp.WriteString(content); err != nil {
		_ = tmp.Close()
		return nil, fmt.Errorf("write temp file: %w", err)
	}
	_ = tmp.Close()

	return s.runSemgrep(ctx, tmp.Name(), connName, runID)
}

// ScanFile runs semgrep on a file directly.
func (s *SemgrepScanner) ScanFile(ctx context.Context, path, connName, runID string) (*SemgrepResult, error) {
	if !s.Available() {
		return &SemgrepResult{Skipped: true, Error: "semgrep not installed"}, nil
	}
	return s.runSemgrep(ctx, path, connName, runID)
}

func (s *SemgrepScanner) runSemgrep(ctx context.Context, path, connName, runID string) (*SemgrepResult, error) {
	args := []string{
		"--config=p/ci",
		"--json",
		"--quiet",
		"--no-git-ignore",
		path,
	}

	var stdout, stderr bytes.Buffer
	cmd := exec.CommandContext(ctx, s.binaryPath, args...)
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		// semgrep exits 1 when it finds issues — that's not an error for us
		if exitErr, ok := err.(*exec.ExitError); ok && exitErr.ExitCode() != 1 {
			return &SemgrepResult{
				Skipped: false,
				Error:   fmt.Sprintf("semgrep failed (exit %d): %s", exitErr.ExitCode(), stderr.String()),
			}, nil
		}
	}

	findings, err := parseSemgrepJSON(stdout.Bytes(), connName, runID)
	if err != nil {
		return &SemgrepResult{Error: err.Error()}, nil
	}

	return &SemgrepResult{Findings: findings}, nil
}

func parseSemgrepJSON(data []byte, connName, runID string) ([]Finding, error) {
	if len(data) == 0 {
		return nil, nil
	}

	var output struct {
		Results []struct {
			CheckID string `json:"check_id"`
			Path    string `json:"path"`
			Start   struct {
				Line int `json:"line"`
			} `json:"start"`
			Extra struct {
				Message  string `json:"message"`
				Severity string `json:"severity"`
				Metadata struct {
					Confidence string `json:"confidence"`
					Category   string `json:"category"`
				} `json:"metadata"`
			} `json:"extra"`
		} `json:"results"`
	}

	if err := json.Unmarshal(data, &output); err != nil {
		return nil, fmt.Errorf("parse semgrep output: %w", err)
	}

	findings := make([]Finding, 0, len(output.Results))
	for _, r := range output.Results {
		findings = append(findings, Finding{
			ConnectionName: connName,
			RunID:          runID,
			Severity:       mapSemgrepSeverity(r.Extra.Severity),
			Category:       mapSemgrepCategory(r.Extra.Metadata.Category),
			Title:          r.CheckID,
			Description:    r.Extra.Message,
			Remediation:    "Refer to semgrep rule: " + r.CheckID,
			File:           r.Path,
			Line:           r.Start.Line,
			Confidence:     mapSemgrepConfidence(r.Extra.Metadata.Confidence),
			Status:         "open",
		})
	}

	return findings, nil
}

func mapSemgrepSeverity(s string) Severity {
	switch strings.ToUpper(s) {
	case "CRITICAL":
		return SeverityCritical
	case "HIGH", "ERROR":
		return SeverityHigh
	case "MEDIUM", "WARNING":
		return SeverityMedium
	case "LOW", "INFO":
		return SeverityLow
	default:
		return SeverityMedium
	}
}

func mapSemgrepCategory(c string) Category {
	switch strings.ToLower(c) {
	case "security":
		return CategoryConfig
	case "injection":
		return CategoryInjection
	case "secrets":
		return CategorySecrets
	default:
		return CategoryOther
	}
}

func mapSemgrepConfidence(c string) float64 {
	switch strings.ToLower(c) {
	case "high":
		return 0.9
	case "medium":
		return 0.7
	default:
		return 0.5
	}
}
