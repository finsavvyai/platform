package tracing

import (
	"context"
	"os"
	"testing"
)

func TestPathEnvOverride(t *testing.T) {
	t.Setenv(envPath, "/tmp/custom-trace.out")
	if got := Path(); got != "/tmp/custom-trace.out" {
		t.Fatalf("env override Path=%q", got)
	}
}

func TestPathDefault(t *testing.T) {
	_ = os.Unsetenv(envPath)
	if got := Path(); got != defaultOut {
		t.Fatalf("default Path=%q want %q", got, defaultOut)
	}
}

func TestStartDisabledByDefault(t *testing.T) {
	_ = os.Unsetenv(envEnabled)
	if err := Start(); err != nil {
		t.Fatalf("disabled Start should be no-op, got %v", err)
	}
	if Active() {
		t.Fatalf("Active should remain false when env not set")
	}
}

func TestStartStopRoundtrip(t *testing.T) {
	t.Setenv(envEnabled, "1")
	t.Setenv(envPath, "/tmp/pipewarden-test.trace")
	t.Cleanup(func() { _ = os.Remove("/tmp/pipewarden-test.trace") })

	if err := Start(); err != nil {
		t.Fatalf("Start: %v", err)
	}
	if !Active() {
		t.Fatalf("Active=false after Start")
	}
	// Double Start should no-op.
	if err := Start(); err != nil {
		t.Fatalf("second Start: %v", err)
	}

	ctx, end := Task(context.Background(), "test-task")
	if ctx == nil {
		t.Fatalf("Task ctx nil")
	}
	regEnd := Region(ctx, "test-region")
	regEnd()
	end()

	Stop()
	if Active() {
		t.Fatalf("Active=true after Stop")
	}
	// Double Stop is safe.
	Stop()
}

func TestTaskAndRegionInactive(t *testing.T) {
	_ = os.Unsetenv(envEnabled)
	if Active() {
		t.Skip("trace left active from prior test")
	}
	ctx, end := Task(context.Background(), "x")
	if ctx == nil {
		t.Fatalf("nil ctx")
	}
	end()
	Region(ctx, "r")()
}
