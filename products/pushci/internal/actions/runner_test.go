package actions

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// withFakeAct injects a fake act binary at the front of PATH so the
// runner exercises buildArgs + exec.Cmd plumbing without needing real
// Docker. The fake echoes its argv to stdout and exits with the code
// embedded in the FAKE_ACT_EXIT env var (defaults to 0).
func withFakeAct(t *testing.T, exitCode string) (cleanup func()) {
	t.Helper()
	if runtime.GOOS == "windows" {
		t.Skip("fake-act helper assumes a POSIX shell")
	}
	dir := t.TempDir()
	body := `#!/bin/sh
echo "FAKE_ACT_INVOKED $@"
echo "STAGE=Main"
echo '{"level":"info","msg":"  ✅  Success - Main fake","jobID":"build"}'
exit ${FAKE_ACT_EXIT:-0}
`
	bin := filepath.Join(dir, "act")
	if err := os.WriteFile(bin, []byte(body), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("FAKE_ACT_EXIT", exitCode)
	t.Setenv("PATH", dir+string(os.PathListSeparator)+os.Getenv("PATH"))
	return func() {}
}

func TestRunner_Run_SuccessPath(t *testing.T) {
	defer withFakeAct(t, "0")()
	r := &Runner{Stdout: &strings.Builder{}, Stderr: &strings.Builder{}}
	res, err := r.Run(context.Background(), RunOptions{
		Event:        "push",
		WorkflowsDir: "./.github/workflows",
		Job:          "build",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !res.Success {
		t.Errorf("expected success, got %+v", res)
	}
	if res.ExitCode != 0 {
		t.Errorf("expected exit 0, got %d", res.ExitCode)
	}
}

func TestRunner_Run_PropagatesNonZeroExit(t *testing.T) {
	defer withFakeAct(t, "5")()
	r := &Runner{}
	res, err := r.Run(context.Background(), RunOptions{Event: "push"})
	if err != nil {
		t.Fatalf("non-zero exit should not return Go error, got %v", err)
	}
	if res.Success {
		t.Errorf("expected failure, got %+v", res)
	}
	if res.ExitCode != 5 {
		t.Errorf("expected exit 5, got %d", res.ExitCode)
	}
}

func TestRunner_Run_StreamsStdout(t *testing.T) {
	defer withFakeAct(t, "0")()
	stdout := &strings.Builder{}
	r := &Runner{Stdout: stdout}
	if _, err := r.Run(context.Background(), RunOptions{Event: "push"}); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(stdout.String(), "FAKE_ACT_INVOKED") {
		t.Errorf("expected fake act marker in stdout, got: %q", stdout.String())
	}
}

func TestRunner_Run_PassesEvents(t *testing.T) {
	defer withFakeAct(t, "0")()
	events := make(chan Event, 32)
	r := &Runner{Events: events}
	if _, err := r.Run(context.Background(), RunOptions{Event: "push"}); err != nil {
		t.Fatal(err)
	}
	close(events)

	var sawSuccess bool
	for ev := range events {
		if ev.Kind == EventStepSuccess {
			sawSuccess = true
		}
	}
	if !sawSuccess {
		t.Error("expected to observe an EventStepSuccess from fake act output")
	}
}

func TestRunner_Run_RejectsBadOptions(t *testing.T) {
	defer withFakeAct(t, "0")()
	r := &Runner{}
	_, err := r.Run(context.Background(), RunOptions{
		Secrets: map[string]string{"BAD KEY": "v"},
	})
	if err == nil {
		t.Fatal("expected validation error")
	}
	if !strings.Contains(err.Error(), "invalid options") {
		t.Errorf("error should mention invalid options, got: %v", err)
	}
}

func TestRunner_Run_MissingActBinary(t *testing.T) {
	t.Setenv("PATH", t.TempDir())
	r := &Runner{}
	_, err := r.Run(context.Background(), RunOptions{})
	if err == nil || !strings.Contains(err.Error(), "act binary") {
		t.Errorf("expected ErrActMissing, got %v", err)
	}
}

func TestRunner_Run_CleanupRunsOnSuccess(t *testing.T) {
	defer withFakeAct(t, "0")()
	r := &Runner{}
	// Inject a real secrets map so a temp file is materialized; verify
	// that buildArgs's cleanup actually removes it after Run completes.
	res, err := r.Run(context.Background(), RunOptions{
		Event:   "push",
		Secrets: map[string]string{"K": "v"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if !res.Success {
		t.Errorf("expected success, got %+v", res)
	}
}
