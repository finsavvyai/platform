package mcp

import (
	"fmt"

	"github.com/finsavvyai/pushci/internal/secrets"
	"github.com/finsavvyai/pushci/internal/security"
)

func handleDoctor(args map[string]any) ToolCallResult {
	dir, _ := args["directory"].(string)
	if dir == "" {
		return NewErrorResult("directory is required")
	}
	checks := runDoctorChecks(dir)
	allPassed := true
	for _, c := range checks {
		if !c["ok"].(bool) {
			allPassed = false
		}
	}
	return jsonResult(map[string]any{
		"checks": checks, "all_passed": allPassed,
	})
}

func handleSecretSet(args map[string]any) ToolCallResult {
	dir, _ := args["directory"].(string)
	key, _ := args["key"].(string)
	value, _ := args["value"].(string)
	if dir == "" || key == "" || value == "" {
		return NewErrorResult("directory, key, and value are required")
	}
	store, err := secrets.New(dir)
	if err != nil {
		return NewErrorResult(fmt.Sprintf("failed to open store: %v", err))
	}
	if err := store.Set(key, value); err != nil {
		return NewErrorResult(fmt.Sprintf("failed to set secret: %v", err))
	}
	return jsonResult(map[string]any{"success": true})
}

func handleScan(args map[string]any) ToolCallResult {
	path, _ := args["path"].(string)
	if path == "" {
		path = findPipelineConfig()
	}
	if path == "" {
		return NewErrorResult("no pipeline config found; provide path argument")
	}
	result, err := security.ScanPipelineConfig(path)
	if err != nil {
		return NewErrorResult(fmt.Sprintf("scan failed: %v", err))
	}
	findings := make([]map[string]any, len(result.Findings))
	for i, f := range result.Findings {
		findings[i] = map[string]any{
			"severity":    f.Severity,
			"category":    f.Category,
			"title":       f.Title,
			"description": f.Description,
			"remediation": f.Remediation,
			"file":        f.File,
			"line":        f.Line,
		}
	}
	return jsonResult(map[string]any{
		"findings":   findings,
		"risk_score": result.RiskScore,
		"summary":    result.Summary,
		"duration":   result.Duration.String(),
	})
}

// findPipelineConfig and runDoctorChecks live in handlers_doctor.go.
