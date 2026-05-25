package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/deploy"
)

// preflightVercel verifies Node/npx is available and prints an
// auth hint if Vercel isn't logged in. Vercel CLI handles framework
// detection itself, so we don't pre-detect.
func preflightVercel(dir string) (deploy.Target, map[string]string, error) {
	_ = dir
	if !hasCLI("npx") {
		return "", nil, fmt.Errorf("need `npx` (Node.js) on PATH — install Node 20+, then re-run")
	}
	if !vercelLikelyAuthed() {
		fmt.Fprintln(os.Stderr,
			"  hint: not authenticated yet — run `npx vercel login` once, then re-run")
	}
	return deploy.TargetVercel, nil, nil
}

// preflightFly ensures flyctl is installed and a fly.toml exists.
// Generates a minimal fly.toml if missing — Fly's own first-run
// experience requires the file but the generator (`fly launch`)
// is interactive. We write a hands-off default keyed on the dir
// name and let the user edit before pushing prod traffic.
func preflightFly(dir string) (deploy.Target, map[string]string, error) {
	if !hasCLI("flyctl") && !hasCLI("fly") {
		return "", nil, fmt.Errorf("need `flyctl` on PATH — install: curl -L https://fly.io/install.sh | sh")
	}
	tomlPath := filepath.Join(dir, "fly.toml")
	if !fileExists(tomlPath) {
		cli.Info("No fly.toml — generating a minimal one")
		if err := writeMinimalFlyToml(tomlPath, filepath.Base(dir)); err != nil {
			return "", nil, fmt.Errorf("write fly.toml: %w", err)
		}
		fmt.Fprintln(os.Stderr,
			"  hint: review fly.toml before going to prod — the default region is `iad`")
	}
	if !flyLikelyAuthed() {
		fmt.Fprintln(os.Stderr,
			"  hint: not authenticated yet — run `flyctl auth login` once, then re-run")
	}
	return deploy.TargetFly, nil, nil
}

func writeMinimalFlyToml(path, appName string) error {
	sanitized := strings.ToLower(strings.ReplaceAll(appName, "_", "-"))
	body := fmt.Sprintf("app = %q\nprimary_region = \"iad\"\n\n[build]\n\n[http_service]\n  internal_port = 8080\n  force_https = true\n  auto_stop_machines = true\n  auto_start_machines = true\n  min_machines_running = 0\n", sanitized)
	return os.WriteFile(path, []byte(body), 0o644) // #nosec G306 -- fly.toml is non-secret config
}

func vercelLikelyAuthed() bool {
	home, err := os.UserHomeDir()
	if err != nil {
		return false
	}
	for _, rel := range []string{
		".local/share/com.vercel.cli/auth.json",
		"Library/Application Support/com.vercel.cli/auth.json",
	} {
		if fileExists(filepath.Join(home, rel)) {
			return true
		}
	}
	return os.Getenv("VERCEL_TOKEN") != ""
}

func flyLikelyAuthed() bool {
	home, err := os.UserHomeDir()
	if err != nil {
		return false
	}
	return fileExists(filepath.Join(home, ".fly", "config.yml")) ||
		os.Getenv("FLY_API_TOKEN") != ""
}
