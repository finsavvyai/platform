package actions

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// fakeListAct writes a fake act binary that emits the captured table
// when invoked with --list, otherwise exits non-zero.
func fakeListAct(t *testing.T, body string) {
	t.Helper()
	dir := t.TempDir()
	script := `#!/bin/sh
case "$1" in
  --list)
    cat <<'EOF'
` + body + `
EOF
    ;;
  *)
    echo "unsupported" >&2
    exit 1
    ;;
esac
`
	bin := filepath.Join(dir, "act")
	if err := os.WriteFile(bin, []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", dir+string(os.PathListSeparator)+os.Getenv("PATH"))
}

func TestListJobs_HappyPath(t *testing.T) {
	fakeListAct(t, `Stage  Job ID  Job name  Workflow name  Workflow file  Events
0      build   build     CI             ci.yml         push
0      lint    lint      CI             ci.yml         push,pull_request`)
	jobs, err := ListJobs(context.Background(), RunOptions{
		WorkflowsDir: ".github/workflows",
		Event:        "push",
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(jobs) != 2 {
		t.Fatalf("expected 2 jobs, got %d", len(jobs))
	}
	if jobs[0].JobID != "build" || jobs[1].JobID != "lint" {
		t.Errorf("unexpected jobs: %+v", jobs)
	}
}

func TestListJobs_MissingBinary(t *testing.T) {
	t.Setenv("PATH", t.TempDir())
	_, err := ListJobs(context.Background(), RunOptions{})
	if err == nil {
		t.Fatal("expected error when act missing")
	}
}

func TestListJobs_PropagatesActFailure(t *testing.T) {
	dir := t.TempDir()
	body := `#!/bin/sh
echo "boom" >&2
exit 2
`
	bin := filepath.Join(dir, "act")
	if err := os.WriteFile(bin, []byte(body), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", dir+string(os.PathListSeparator)+os.Getenv("PATH"))
	_, err := ListJobs(context.Background(), RunOptions{})
	if err == nil || !strings.Contains(err.Error(), "act --list failed") {
		t.Errorf("expected wrapped error, got %v", err)
	}
}
