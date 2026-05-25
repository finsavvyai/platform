package main

import (
	"encoding/json"
	"time"

	"github.com/finsavvyai/pushci/internal/security"
)

// generateSARIF converts PipelineScanResult to SARIF 2.1.0 format.
func generateSARIF(result *security.PipelineScanResult) ([]byte, error) {
	if result == nil {
		result = &security.PipelineScanResult{Findings: []security.PipelineFinding{}}
	}

	run := SARIFRun{
		Tool: SARIFTool{
			Driver: SARIFDriver{
				Name:           "PushCI",
				Version:        "1.0.0",
				InformationURI: "https://pushci.dev",
				Rules:          buildSARIFRules(result.Findings),
			},
		},
		Results: buildSARIFResults(result.Findings),
		Invocations: []SARIFInvocation{{
			CommandLine:         "pushci scan --report=sarif",
			ExecutionSuccessful: true,
			EndTimeUtc:          time.Now().UTC().Format(time.RFC3339),
		}},
	}

	log := SARIFLog{Version: "2.1.0", Runs: []SARIFRun{run}}
	return json.MarshalIndent(log, "", "  ")
}

// findingSeverityToLevel maps finding severity to SARIF level.
func findingSeverityToLevel(severity string) string {
	switch severity {
	case "critical", "high":
		return "error"
	case "medium":
		return "warning"
	case "low", "info":
		return "note"
	default:
		return "note"
	}
}

// findingSeverityToRank maps finding severity to SARIF rank (0.0-100.0).
func findingSeverityToRank(severity string) float64 {
	switch severity {
	case "critical":
		return 100.0
	case "high":
		return 75.0
	case "medium":
		return 50.0
	case "low":
		return 25.0
	case "info", "":
		return 0.0
	}
	return 0.0
}
