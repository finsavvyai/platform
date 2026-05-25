package mcp

import (
	"fmt"
	"os/exec"
	"strings"

	"github.com/finsavvyai/pushci/internal/secrets"
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

func runDoctorChecks(dir string) []map[string]any {
	tools := []struct{ name, cmd, arg string }{
		{"git", "git", "--version"},
		{"go", "go", "version"},
		{"node", "node", "--version"},
		{"docker", "docker", "--version"},
	}
	var results []map[string]any
	for _, t := range tools {
		out, err := exec.Command(t.cmd, t.arg).CombinedOutput()
		detail := strings.TrimSpace(string(out))
		results = append(results, map[string]any{
			"name": t.name, "ok": err == nil, "detail": detail,
		})
	}
	return results
}
