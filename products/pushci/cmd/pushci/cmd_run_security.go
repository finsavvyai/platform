package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/security"
)

// runPostSecurity runs pipeline security checks after a successful CI run.
// It scans the pushci.yml configuration for common security misconfigurations
// and reports findings with severity levels and remediation steps.
func runPostSecurity(ctx context.Context, root string) error {
	configPath := root + "/pushci.yml"

	// Check if pushci.yml exists
	if _, err := os.Stat(configPath); err != nil {
		cli.Warn("pushci.yml not found, skipping security scan")
		return nil
	}

	cli.Header("PushCI Security Scan")
	sp := cli.NewSpinner()
	sp.Start("Scanning pipeline configuration...")

	// Run the security analysis
	result, err := security.ScanPipelineConfig(configPath)
	if err != nil {
		sp.Stop(false)
		cli.Error(fmt.Sprintf("Security scan failed: %v", err))
		return fmt.Errorf("security scan: %w", err)
	}
	sp.Stop(true)

	// Print results
	printSecurityResults(result)

	// Return error if critical findings exist
	if hasCriticalFindings(result.Findings) {
		return fmt.Errorf("security scan found critical issues")
	}

	return nil
}

// printSecurityResults outputs the security scan findings to stdout
// with color-coded severity levels and remediation guidance.
func printSecurityResults(result *security.PipelineScanResult) {
	cli.Info(fmt.Sprintf("Risk Score: %d/100 • Findings: %d", result.RiskScore, len(result.Findings)))
	cli.Info(fmt.Sprintf("Scan completed in %v", result.Duration.Round(time.Millisecond)))

	if len(result.Findings) == 0 {
		cli.Success(result.Summary)
		return
	}

	fmt.Println()
	fmt.Println(result.Summary)
	fmt.Println()

	// Group findings by severity
	findingsBySeverity := groupFindingsBySeverity(result.Findings)
	severityOrder := []string{"critical", "high", "medium", "low", "info"}

	for _, severity := range severityOrder {
		findings := findingsBySeverity[severity]
		if len(findings) == 0 {
			continue
		}

		severityLabel := fmt.Sprintf("[%s]", severity)
		switch severity {
		case "critical":
			cli.Error(severityLabel)
		case "high":
			cli.Warn(severityLabel)
		default:
			cli.Info(severityLabel)
		}

		for _, finding := range findings {
			fmt.Printf("  %s: %s\n", finding.Category, finding.Title)
			fmt.Printf("    %s:%d\n", finding.File, finding.Line)
			if finding.Remediation != "" {
				fmt.Printf("    Fix: %s\n", finding.Remediation)
			}
			fmt.Println()
		}
	}
}

// groupFindingsBySeverity and hasCriticalFindings live in cmd_run_security_helpers.go.
