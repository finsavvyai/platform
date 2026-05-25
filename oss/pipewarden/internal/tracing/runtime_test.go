package tracing

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestStartNoopWhenDisabled(t *testing.T) {
	t.Setenv(envEnabled, "")
	if err := Start(); err != nil {
		t.Fatalf("Start() with env unset should be noop, got %v", err)
	}
	if Active() {
		t.Error("expected inactive when env unset")
	}
}

func TestStartWritesTraceFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "pw.trace")
	t.Setenv(envEnabled, "1")
	t.Setenv(envPath, path)

	if err := Start(); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer Stop()

	if !Active() {
		t.Error("expected active after Start()")
	}

	ctx, end := Task(context.Background(), "unit-test-task")
	endRegion := Region(ctx, "sub-region")
	endRegion()
	end()

	Stop()
	if Active() {
		t.Error("expected inactive after Stop()")
	}

	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("trace file missing: %v", err)
	}
	if info.Size() == 0 {
		t.Error("expected non-empty trace file")
	}
}

func TestStartIdempotent(t *testing.T) {
	path := filepath.Join(t.TempDir(), "pw2.trace")
	t.Setenv(envEnabled, "1")
	t.Setenv(envPath, path)

	if err := Start(); err != nil {
		t.Fatalf("first Start: %v", err)
	}
	defer Stop()

	if err := Start(); err != nil {
		t.Fatalf("second Start must be a noop, got %v", err)
	}
}
