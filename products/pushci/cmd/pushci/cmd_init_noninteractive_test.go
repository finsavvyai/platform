package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// setupFixtureRepo creates a minimal Node project in a fresh temp dir
// that pushci init will happily detect. Returns the dir path.
func setupFixtureRepo(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	_ = exec.Command("git", "init", dir).Run()
	pkg := `{"name":"fixture","scripts":{"test":"echo ok","build":"echo ok"}}`
	if err := os.WriteFile(filepath.Join(dir, "package.json"), []byte(pkg), 0644); err != nil {
		t.Fatalf("write package.json: %v", err)
	}
	return dir
}

// closedStdin returns an *os.File that is a real pipe with nothing
// written and the writer closed. Any code that reads from it gets
// EOF immediately — but if a prompt hangs waiting for a newline that
// never comes, the test would deadlock. Using a closed reader surfaces
// the bug as a Scanln returning EOF, not a timeout.
func closedStdin(t *testing.T) *os.File {
	t.Helper()
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatalf("os.Pipe: %v", err)
	}
	_ = w.Close()
	t.Cleanup(func() { _ = r.Close() })
	return r
}

func runInit(t *testing.T, bin, dir string, stdin *os.File, env []string, args ...string) (string, int) {
	t.Helper()
	cmd := exec.Command(bin, append([]string{"init"}, args...)...)
	cmd.Dir = dir
	if stdin != nil {
		cmd.Stdin = stdin
	}
	cmd.Env = append(os.Environ(), env...)
	out, err := cmd.CombinedOutput()
	code := 0
	if err != nil {
		if ee, ok := err.(*exec.ExitError); ok {
			code = ee.ExitCode()
		} else {
			t.Fatalf("exec: %v", err)
		}
	}
	return string(out), code
}

func TestInit_ForceImpliesNonInteractive(t *testing.T) {
	bin := binary(t)
	dir := setupFixtureRepo(t)
	out, code := runInit(t, bin, dir, closedStdin(t), nil, "--force")
	if code != 0 {
		t.Fatalf("--force: exit %d\n%s", code, out)
	}
	if _, err := os.Stat(filepath.Join(dir, "pushci.yml")); err != nil {
		t.Fatalf("pushci.yml not created: %v", err)
	}
}

func TestInit_NonInteractiveFlagOnCleanRepo(t *testing.T) {
	bin := binary(t)
	dir := setupFixtureRepo(t)
	out, code := runInit(t, bin, dir, closedStdin(t), nil, "--non-interactive")
	if code != 0 {
		t.Fatalf("--non-interactive: exit %d\n%s", code, out)
	}
	if _, err := os.Stat(filepath.Join(dir, "pushci.yml")); err != nil {
		t.Fatalf("pushci.yml not created: %v", err)
	}
}

func TestInit_NonInteractiveRefusesOverwrite(t *testing.T) {
	bin := binary(t)
	dir := setupFixtureRepo(t)
	existing := filepath.Join(dir, "pushci.yml")
	if err := os.WriteFile(existing, []byte("# hand-crafted\n"), 0644); err != nil {
		t.Fatalf("seed: %v", err)
	}
	out, _ := runInit(t, bin, dir, closedStdin(t), nil, "--non-interactive")
	if !strings.Contains(out, "already exists") {
		t.Fatalf("expected 'already exists' guard, got %q", out)
	}
	data, _ := os.ReadFile(existing)
	if !strings.Contains(string(data), "hand-crafted") {
		t.Fatal("--non-interactive must not overwrite existing pushci.yml")
	}
}

func TestInit_EnvVarEquivalentToFlag(t *testing.T) {
	bin := binary(t)
	dir := setupFixtureRepo(t)
	out, code := runInit(t, bin, dir, closedStdin(t), []string{"PUSHCI_NON_INTERACTIVE=1"})
	if code != 0 {
		t.Fatalf("PUSHCI_NON_INTERACTIVE=1: exit %d\n%s", code, out)
	}
	if _, err := os.Stat(filepath.Join(dir, "pushci.yml")); err != nil {
		t.Fatalf("pushci.yml not created: %v", err)
	}
}
