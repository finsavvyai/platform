package actions

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestBuildArgs_IncludesAllFlags(t *testing.T) {
	opts := RunOptions{
		Event:                 "pull_request",
		WorkflowsDir:          "/repo/.github/workflows",
		Job:                   "build",
		DryRun:                true,
		Verbose:               true,
		Bind:                  true,
		JSONLogs:              true,
		Reuse:                 true,
		ContainerArchitecture: "linux/amd64",
		EventPayload:          "/tmp/event.json",
		Matrix:                map[string]string{"node": "20", "os": "ubuntu-latest"},
		Inputs:                map[string]string{"version": "1.0"},
		Secrets:               map[string]string{"GITHUB_TOKEN": "abc"},
		Env:                   map[string]string{"NODE_ENV": "test"},
	}
	args, cleanup, err := buildArgs(opts)
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup()

	joined := strings.Join(args, " ")
	required := []string{
		"pull_request",
		"--workflows /repo/.github/workflows",
		"-j build",
		"--dryrun",
		"--verbose",
		"--bind",
		"--json",
		"--reuse",
		"--container-architecture linux/amd64",
		"--eventpath /tmp/event.json",
		"--matrix node:20",
		"--matrix os:ubuntu-latest",
		"--input version=1.0",
		"-P ubuntu-latest=",
		"--secret-file",
		"--env-file",
	}
	for _, want := range required {
		if !strings.Contains(joined, want) {
			t.Errorf("argv missing %q\n  full argv: %s", want, joined)
		}
	}
}

func TestBuildArgs_DeterministicMatrixAndInputOrder(t *testing.T) {
	opts := RunOptions{
		Matrix: map[string]string{"z": "1", "a": "2", "m": "3"},
		Inputs: map[string]string{"z": "1", "a": "2"},
	}
	a, _, _ := buildArgs(opts)
	b, _, _ := buildArgs(opts)
	if strings.Join(a, " ") != strings.Join(b, " ") {
		t.Errorf("expected deterministic argv\nA: %v\nB: %v", a, b)
	}
}

func TestBuildArgs_SecretFileFailureCleansUp(t *testing.T) {
	if os.Getuid() == 0 {
		t.Skip("root bypasses 0500 permission")
	}
	roDir := filepath.Join(t.TempDir(), "ro")
	if err := os.MkdirAll(roDir, 0o500); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chmod(roDir, 0o700) })
	t.Setenv("TMPDIR", roDir)

	_, _, err := buildArgs(RunOptions{
		Secrets: map[string]string{"K": "v"},
	})
	if err == nil {
		t.Fatal("expected secret file failure to surface")
	}
}

func TestBuildArgs_EnvFileFailureCleansUp(t *testing.T) {
	if os.Getuid() == 0 {
		t.Skip("root bypasses 0500 permission")
	}
	roDir := filepath.Join(t.TempDir(), "ro")
	if err := os.MkdirAll(roDir, 0o500); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chmod(roDir, 0o700) })
	t.Setenv("TMPDIR", roDir)

	_, _, err := buildArgs(RunOptions{
		Env: map[string]string{"K": "v"},
	})
	if err == nil {
		t.Fatal("expected env file failure to surface")
	}
}
