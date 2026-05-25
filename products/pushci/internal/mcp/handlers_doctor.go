package mcp

import (
	"os/exec"
	"path/filepath"
	"strings"
)

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

func findPipelineConfig() string {
	patterns := []string{
		".github/workflows/*.yml",
		".github/workflows/*.yaml",
		".gitlab-ci.yml",
		"bitbucket-pipelines.yml",
	}
	for _, pattern := range patterns {
		matches, err := filepath.Glob(pattern)
		if err == nil && len(matches) > 0 {
			return matches[0]
		}
	}
	return ""
}
