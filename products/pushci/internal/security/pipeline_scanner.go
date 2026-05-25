package security

import (
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// PipelineFinding represents a security issue in pipeline configuration.
type PipelineFinding struct {
	Severity    string // critical, high, medium, low, info
	Category    string // branch-security, secrets, permissions, supply-chain, configuration
	Title       string
	Description string
	Remediation string
	File        string
	Line        int
}

// PipelineScanResult holds the output of a pipeline security scan.
type PipelineScanResult struct {
	Findings  []PipelineFinding
	RiskScore int // 0-100
	Summary   string
	ScannedAt time.Time
	Duration  time.Duration
}

// ScanPipelineConfig scans a pipeline config file for security issues.
func ScanPipelineConfig(configPath string) (*PipelineScanResult, error) {
	start := time.Now()
	result := &PipelineScanResult{
		Findings:  []PipelineFinding{},
		RiskScore: 0,
		ScannedAt: time.Now(),
	}

	content, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("read config: %w", err)
	}

	contentStr := string(content)
	filename := filepath.Base(configPath)

	// Run all security checks
	result.Findings = append(result.Findings, scanSecrets(contentStr, filename)...)
	result.Findings = append(result.Findings, scanMissingSecuritySteps(contentStr, filename)...)
	result.Findings = append(result.Findings, scanUnpinnedDeps(contentStr, filename)...)
	result.Findings = append(result.Findings, scanBranchProtection(contentStr, filename)...)
	result.Findings = append(result.Findings, scanBroadPermissions(contentStr, filename)...)

	result.RiskScore = calculateRiskScore(result.Findings)
	result.Duration = time.Since(start)

	if len(result.Findings) == 0 {
		result.Summary = "No security issues found"
	} else {
		critical := countSeverity(result.Findings, "critical")
		high := countSeverity(result.Findings, "high")
		result.Summary = fmt.Sprintf("Found %d issues: %d critical, %d high",
			len(result.Findings), critical, high)
	}

	return result, nil
}
