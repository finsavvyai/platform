package main

import (
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// fakeRepo creates a tiny git repo with three distinct authors so
// bus-factor + hotspots have something real to measure.
func fakeRepo(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	exec.Command("git", "-C", dir, "init", "-q").Run()
	exec.Command("git", "-C", dir, "config", "user.email", "a@a").Run()
	for i, author := range []string{"alice", "alice", "alice", "alice", "alice", "alice", "bob"} {
		file := "lonely.go"
		if i == 6 {
			file = "shared.go"
		}
		p := filepath.Join(dir, file)
		exec.Command("sh", "-c", "echo '"+author+"' >> "+p).Run()
		exec.Command("git", "-C", dir, "add", file).Run()
		exec.Command("git", "-C", dir, "-c", "user.name="+author, "-c", "user.email="+author+"@x",
			"commit", "-q", "-m", author+" touch").Run()
	}
	return dir
}

func TestIntelHotspotsJSON(t *testing.T) {
	bin := binary(t)
	dir := fakeRepo(t)
	cmd := exec.Command(bin, "intel", "hotspots", "--json")
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("intel hotspots: %v\n%s", err, out)
	}
	s := string(out)
	if !strings.Contains(s, "lonely.go") {
		t.Errorf("expected lonely.go in hotspots JSON, got: %s", s)
	}
	if !strings.Contains(s, `"bus_factor":1`) {
		t.Errorf("expected bus_factor=1 in JSON, got: %s", s)
	}
}

func TestIntelBusFactorTable(t *testing.T) {
	bin := binary(t)
	dir := fakeRepo(t)
	cmd := exec.Command(bin, "intel", "bus-factor")
	cmd.Dir = dir
	out, _ := cmd.CombinedOutput()
	s := string(out)
	if !strings.Contains(s, "lonely.go") || !strings.Contains(s, "Bus-Factor") {
		t.Errorf("expected human-readable table, got:\n%s", s)
	}
}

func TestIntelUsageOnUnknown(t *testing.T) {
	bin := binary(t)
	out, code := run(t, bin, "intel", "nonsense")
	if code != 0 {
		t.Errorf("usage should exit 0, got %d", code)
	}
	if !strings.Contains(out, "Usage:") {
		t.Errorf("expected usage, got %s", out)
	}
}
