package main

import (
	"encoding/json"
	"fmt"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/security"
)

func scanPrintResult(result *security.PipelineScanResult) {
	cli.Info(fmt.Sprintf("Risk Score: %d/100", result.RiskScore))
	fmt.Printf("  %s\n", result.Summary)
	if len(result.Findings) == 0 {
		return
	}
	fmt.Println()
	for _, finding := range result.Findings {
		scanPrintFinding(finding)
	}
}

func scanPrintFinding(f security.PipelineFinding) {
	icon := "•"
	color := cli.Dim
	switch f.Severity {
	case "critical":
		icon = cli.CrossMark()
		color = cli.Red
	case "high", "medium":
		icon = cli.Dot()
		color = cli.Yellow
	}
	fmt.Printf("  %s %s\n", icon, color(fmt.Sprintf("[%s]", f.Severity)))
	fmt.Printf("      %s\n", f.Title)
	fmt.Printf("      %s\n", f.Description)
	fmt.Printf("      %s %s\n", cli.Green("Fix:"), f.Remediation)
}

func scanOutputJSON(results []*security.PipelineScanResult) error {
	data := map[string]interface{}{
		"results": results,
		"count":   len(results),
	}
	b, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal json: %w", err)
	}
	fmt.Println(string(b))
	return nil
}

func scanOutputSARIF(result *security.PipelineScanResult) error {
	sarifBytes, err := generateSARIF(result)
	if err != nil {
		return fmt.Errorf("generate sarif: %w", err)
	}
	fmt.Println(string(sarifBytes))
	return nil
}
