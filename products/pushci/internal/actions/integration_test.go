//go:build integration

// Package actions integration tests run real workflows through real act
// against real Docker. They are guarded by the `integration` build tag
// so the standard `go test ./...` invocation stays fast and hermetic.
//
// Run with:
//
//	go test -tags=integration -timeout=15m ./internal/actions/...
//
// Requirements:
//   - act binary on PATH (brew install act)
//   - Docker daemon running
//   - Network access (first run pulls catthehacker images + actions)
//
// First run takes ~3-5 minutes per test (image pulls). Subsequent runs
// are 5-30 seconds each thanks to act's local cache.
package actions

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// requireRuntime aborts the test with a clear message when the host is
// missing act or Docker, instead of failing later inside the wrapper.
func requireRuntime(t *testing.T) {
	t.Helper()
	if _, err := ActBinary(); err != nil {
		t.Skip("act binary not on PATH; install with `brew install act`")
	}
	if err := exec.Command("docker", "info").Run(); err != nil {
		t.Skip("docker daemon not reachable; start Docker Desktop")
	}
}

// stageWorkflow copies a fixture workflow into a fresh temporary git
// repo and returns the repo path. We initialize git because some
// actions (notably actions/checkout) refuse to run outside a repo.
func stageWorkflow(t *testing.T, fixture string, extraFiles map[string]string) string {
	t.Helper()
	repo := t.TempDir()
	wfDir := filepath.Join(repo, ".github", "workflows")
	if err := os.MkdirAll(wfDir, 0o755); err != nil {
		t.Fatal(err)
	}

	src := filepath.Join("testdata", "workflows", fixture)
	body, err := os.ReadFile(src)
	if err != nil {
		t.Fatalf("read fixture %s: %v", fixture, err)
	}
	if err := os.WriteFile(filepath.Join(wfDir, fixture), body, 0o644); err != nil {
		t.Fatal(err)
	}

	for path, contents := range extraFiles {
		full := filepath.Join(repo, path)
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(full, []byte(contents), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	mustGit(t, repo, "init", "--quiet")
	mustGit(t, repo, "config", "user.email", "ci@pushci.dev")
	mustGit(t, repo, "config", "user.name", "PushCI Test")
	mustGit(t, repo, "add", "-A")
	mustGit(t, repo, "commit", "--quiet", "-m", "init")
	return repo
}

func mustGit(t *testing.T, dir string, args ...string) {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git %v failed: %v\n%s", args, err, out)
	}
}

// runIntegration is the shared harness: spawn the wrapper against the
// staged repo, capture stdout, fail loudly on non-zero exit. Returns
// the captured output so individual tests can assert on it.
func runIntegration(t *testing.T, repo string, opts RunOptions) (string, Result) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	var stdout, stderr bytes.Buffer
	r := &Runner{
		Stdout: &stdout,
		Stderr: &stderr,
	}
	opts.WorkingDir = repo
	if opts.Event == "" {
		opts.Event = "push"
	}
	res, err := r.Run(ctx, opts)
	combined := stdout.String() + stderr.String()
	if err != nil {
		t.Fatalf("Run returned error: %v\n--- output ---\n%s", err, combined)
	}
	if !res.Success {
		t.Fatalf("workflow failed (exit %d):\n--- output ---\n%s", res.ExitCode, combined)
	}
	return combined, res
}

func TestIntegration_CheckoutAndSetupNode(t *testing.T) {
	requireRuntime(t)
	repo := stageWorkflow(t, "01-checkout-and-node.yml", nil)
	out, _ := runIntegration(t, repo, RunOptions{})

	for _, want := range []string{
		"actions/checkout@v4",
		"actions/setup-node@v4",
		"v20.",
	} {
		if !strings.Contains(out, want) {
			t.Errorf("expected output to contain %q\n--- output ---\n%s", want, out)
		}
	}
}

func TestIntegration_MatrixBuild(t *testing.T) {
	requireRuntime(t)
	repo := stageWorkflow(t, "02-matrix.yml", nil)
	out, _ := runIntegration(t, repo, RunOptions{})

	// Both matrix slots must have run.
	for _, slot := range []string{"Matrix value: 20", "Matrix value: 22"} {
		if !strings.Contains(out, slot) {
			t.Errorf("matrix slot %q missing from output", slot)
		}
	}
}

func TestIntegration_StepOutputsAcrossJobs(t *testing.T) {
	requireRuntime(t)
	repo := stageWorkflow(t, "03-step-outputs.yml", nil)
	out, _ := runIntegration(t, repo, RunOptions{})

	if !strings.Contains(out, "version=1.2.3") {
		t.Errorf("expected downstream job to read upstream output\n--- output ---\n%s", out)
	}
}

func TestIntegration_SecretsInjection(t *testing.T) {
	requireRuntime(t)
	repo := stageWorkflow(t, "04-secrets-mask.yml", nil)
	out, _ := runIntegration(t, repo, RunOptions{
		Secrets: map[string]string{"MY_TOKEN": "supersecret-12345"},
	})

	if !strings.Contains(out, "Token length: 17") {
		t.Errorf("expected token length assertion to print\n--- output ---\n%s", out)
	}
	// The literal secret must NOT appear in logs (act masks it).
	if strings.Contains(out, "supersecret-12345") {
		t.Errorf("secret value leaked into logs! masking failed\n%s", out)
	}
}

func TestIntegration_CompositeAction(t *testing.T) {
	requireRuntime(t)
	composite := map[string]string{
		".github/actions/greet/action.yml": `name: Greet
description: A trivial composite that emits a greeting.
inputs:
  name:
    description: Who to greet
    required: true
outputs:
  message:
    description: Greeting payload
    value: ${{ steps.compose.outputs.message }}
runs:
  using: composite
  steps:
    - id: compose
      shell: bash
      run: echo "message=Hello, ${{ inputs.name }}!" >> $GITHUB_OUTPUT
`,
	}
	repo := stageWorkflow(t, "05-composite.yml", composite)
	out, _ := runIntegration(t, repo, RunOptions{})

	if !strings.Contains(out, "Greeting: Hello, PushCI!") {
		t.Errorf("composite action did not return greeting\n--- output ---\n%s", out)
	}
}

func TestIntegration_DryRunValidatesWithoutExecuting(t *testing.T) {
	requireRuntime(t)
	repo := stageWorkflow(t, "01-checkout-and-node.yml", nil)
	out, _ := runIntegration(t, repo, RunOptions{DryRun: true})

	// Dry run should not actually pull images or invoke node.
	if strings.Contains(out, "v20.") {
		t.Errorf("dry run should not execute steps but produced version output:\n%s", out)
	}
}

func TestIntegration_DetectAndListJobs(t *testing.T) {
	requireRuntime(t)
	repo := stageWorkflow(t, "01-checkout-and-node.yml", nil)

	wfs, err := DetectWorkflows(repo)
	if err != nil {
		t.Fatal(err)
	}
	if len(wfs) != 1 {
		t.Fatalf("expected 1 workflow, got %d", len(wfs))
	}

	jobs, err := ListJobs(context.Background(), RunOptions{
		WorkingDir: repo,
		Event:      "push",
	})
	if err != nil {
		t.Fatalf("ListJobs: %v", err)
	}
	if len(jobs) != 1 || jobs[0].JobID != "build" {
		t.Errorf("expected one job with id=build, got %+v", jobs)
	}
}

// TestIntegration_VersionMeetsMinimum sanity-checks that the installed
// act binary is recent enough for the wrapper's contract.
func TestIntegration_VersionMeetsMinimum(t *testing.T) {
	requireRuntime(t)
	ma, mi, pa, err := Version(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if ma == 0 && mi == 0 {
		t.Fatalf("got %d.%d.%d, expected ≥ %s", ma, mi, pa, MinimumActVersion)
	}
	t.Logf("act version: %d.%d.%d", ma, mi, pa)
	_ = fmt.Sprint
}
