package main

import (
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// TestMigrateBinaryRunsAgainstSQLite builds the migrate binary and runs it
// against a fresh on-disk SQLite database, asserting exit 0 and the success
// banner. Skipped in -short mode because it shells out to `go build`.
func TestMigrateBinaryRunsAgainstSQLite(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping binary build in -short")
	}

	tmp := t.TempDir()
	binPath := filepath.Join(tmp, "pw-migrate")

	build := exec.Command("go", "build", "-o", binPath, ".")
	if out, err := build.CombinedOutput(); err != nil {
		t.Fatalf("go build: %v\n%s", err, out)
	}

	dbPath := filepath.Join(tmp, "migrate.db")
	cmd := exec.Command(binPath)
	cmd.Env = append(cmd.Environ(),
		"PIPEWARDEN_DATABASE_DRIVER=sqlite",
		"PIPEWARDEN_DATABASE_URL="+dbPath,
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("migrate exit: %v\noutput:\n%s", err, out)
	}
	if !strings.Contains(string(out), "migrate ok") {
		t.Fatalf("missing success banner; output:\n%s", out)
	}
}

func TestMigrateMissingURLFailsFast(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping binary build in -short")
	}
	tmp := t.TempDir()
	binPath := filepath.Join(tmp, "pw-migrate")
	if out, err := exec.Command("go", "build", "-o", binPath, ".").CombinedOutput(); err != nil {
		t.Fatalf("go build: %v\n%s", err, out)
	}

	cmd := exec.Command(binPath)
	cmd.Env = []string{"PATH=" + "/usr/bin:/bin"}
	out, err := cmd.CombinedOutput()
	if err == nil {
		t.Fatalf("expected non-zero exit when DB URL missing; output:\n%s", out)
	}
	if !strings.Contains(string(out), "PIPEWARDEN_DATABASE_URL is required") {
		t.Fatalf("missing required-env message; output:\n%s", out)
	}
}
