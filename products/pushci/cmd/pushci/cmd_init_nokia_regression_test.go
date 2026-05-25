package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/finsavvyai/pushci/internal/detect"
)

// TestInitNokiaRegression_AllGenericTargetsProduceDeploy reproduces
// the telia v1.6.3 batch 2 dogfood bug #4: NokiaPCRFTeliaGateway
// has Dockerfile + Makefile + deploy.sh (all "generic" platforms
// per genericPlatform()). Before the fix, the non-interactive
// picker pre-selected none of them and collectPicked returned nil
// — so the generated pushci.yml had no deploy: block even though
// init logged "Deploy targets detected: 3".
//
// Root cause: cmd_init_deploy_pick.go:selected[i]=!genericPlatform(...)
// set every generic entry to false. Fix: when nothing is
// pre-selected, accept the top-ranked (index 0) target so at
// least one deploy survives into pipe.Deploys.
func TestInitNokiaRegression_AllGenericTargetsProduceDeploy(t *testing.T) {
	dir := seedNokiaFixture(t)

	// Simulate --force non-interactive.
	origArgs := os.Args
	defer func() { os.Args = origArgs }()
	os.Args = []string{"pushci", "init", "--force"}

	targets := detect.ScanDeployTargets(dir)
	if len(targets) == 0 {
		t.Fatalf("ScanDeployTargets should detect Dockerfile/Makefile/deploy.sh; got none")
	}

	picked := pickDeployTargets(targets)
	if len(picked) == 0 {
		t.Fatalf("non-interactive pick with all-generic targets returned nil; want at least 1. targets=%+v", targets)
	}
	// Must be one of the three generic platforms we detected.
	got := picked[0].Name
	if got != "docker" && got != "script" && got != "make" && got != "docker-compose" {
		t.Fatalf("picked deploy %q not one of expected generics; picked=%+v", got, picked)
	}
}

func seedNokiaFixture(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	files := map[string]string{
		"Dockerfile": "FROM alpine\nRUN echo hi\n",
		"Makefile":   "all:\n\techo hello\n",
		"deploy.sh":  "#!/usr/bin/env bash\necho deploying\n",
	}
	for name, body := range files {
		full := filepath.Join(dir, name)
		if err := os.WriteFile(full, []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return dir
}

// TestInitNokiaRegression_NonGenericStillWins guards the
// normal case: when Dockerfile coexists with a vercel.json (non-
// generic), the vercel target must be pre-selected and the
// Dockerfile-as-fallback code path must NOT kick in.
func TestInitNokiaRegression_NonGenericStillWins(t *testing.T) {
	dir := t.TempDir()
	seeds := map[string]string{
		"Dockerfile":  "FROM alpine\n",
		"vercel.json": `{"build":{"env":{}}}`,
	}
	for n, b := range seeds {
		if err := os.WriteFile(filepath.Join(dir, n), []byte(b), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	origArgs := os.Args
	defer func() { os.Args = origArgs }()
	os.Args = []string{"pushci", "init", "--force"}

	picked := pickDeployTargets(detect.ScanDeployTargets(dir))
	if len(picked) == 0 {
		t.Fatalf("expected vercel picked, got nil")
	}
	for _, p := range picked {
		if p.Name == "docker" {
			t.Fatalf("docker should not win over vercel; picked=%+v", picked)
		}
	}
	// Find vercel in picked.
	found := false
	for _, p := range picked {
		if strings.Contains(p.Name, "vercel") {
			found = true
		}
	}
	if !found {
		t.Fatalf("vercel should be in picked; got %+v", picked)
	}
}
