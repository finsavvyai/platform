package plugin

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// SecurityScanPlugin runs security audit for the detected stack.
type SecurityScanPlugin struct{}

func (p *SecurityScanPlugin) Name() string { return "security-scan" }

func (p *SecurityScanPlugin) Run(ctx context.Context, dir string) (*Result, error) {
	cmd, args := detectSecurityCmd(dir)
	if cmd == "" {
		return &Result{Passed: true, Output: "no security scanner detected"}, nil
	}
	return runCmd(ctx, dir, cmd, args...)
}

// LintPlugin runs a linter based on the detected stack.
type LintPlugin struct{}

func (p *LintPlugin) Name() string { return "lint" }

func (p *LintPlugin) Run(ctx context.Context, dir string) (*Result, error) {
	cmd, args := detectLintCmd(dir)
	if cmd == "" {
		return &Result{Passed: true, Output: "no linter detected"}, nil
	}
	return runCmd(ctx, dir, cmd, args...)
}

// DockerLintPlugin runs hadolint on Dockerfiles.
type DockerLintPlugin struct{}

func (p *DockerLintPlugin) Name() string { return "docker-lint" }

func (p *DockerLintPlugin) Run(ctx context.Context, dir string) (*Result, error) {
	df := filepath.Join(dir, "Dockerfile")
	if _, err := os.Stat(df); os.IsNotExist(err) {
		return &Result{Passed: true, Output: "no Dockerfile found"}, nil
	}
	return runCmd(ctx, dir, "hadolint", "Dockerfile")
}

// LicenseCheckPlugin checks for a LICENSE file.
type LicenseCheckPlugin struct{}

func (p *LicenseCheckPlugin) Name() string { return "license-check" }

func (p *LicenseCheckPlugin) Run(_ context.Context, dir string) (*Result, error) {
	start := time.Now()
	for _, name := range []string{"LICENSE", "LICENSE.md", "LICENCE"} {
		if _, err := os.Stat(filepath.Join(dir, name)); err == nil {
			msg := fmt.Sprintf("found %s", name)
			return &Result{Passed: true, Output: msg, Duration: time.Since(start)}, nil
		}
	}
	return &Result{Passed: false, Output: "no LICENSE file found", Duration: time.Since(start)}, nil
}
