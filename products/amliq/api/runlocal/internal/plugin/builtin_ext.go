package plugin

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

func detectSecurityCmd(dir string) (string, []string) {
	if exists(dir, "package.json") {
		return "npm", []string{"audit", "--audit-level=high"}
	}
	if exists(dir, "go.mod") {
		return "go", []string{"vet", "./..."}
	}
	if exists(dir, "Cargo.toml") {
		return "cargo", []string{"audit"}
	}
	return "", nil
}

func detectLintCmd(dir string) (string, []string) {
	if exists(dir, "package.json") {
		return "npx", []string{"eslint", "."}
	}
	if exists(dir, "go.mod") {
		return "golangci-lint", []string{"run"}
	}
	if exists(dir, "requirements.txt") || exists(dir, "pyproject.toml") {
		return "ruff", []string{"check", "."}
	}
	return "", nil
}

func exists(dir, name string) bool {
	_, err := os.Stat(filepath.Join(dir, name))
	return err == nil
}

func runCmd(ctx context.Context, dir, name string, args ...string) (*Result, error) {
	start := time.Now()
	c := exec.CommandContext(ctx, name, args...)
	c.Dir = dir
	out, err := c.CombinedOutput()
	d := time.Since(start)
	if err != nil {
		return &Result{Passed: false, Output: string(out), Duration: d}, nil
	}
	return &Result{Passed: true, Output: string(out), Duration: d}, nil
}
