// Package tracing wraps Go's runtime/trace for opt-in goroutine-level
// timelines. Off by default; enable with PIPEWARDEN_TRACE=1.
// View with: go tool trace /tmp/pipewarden.trace
package tracing

import (
	"context"
	"fmt"
	"os"
	"runtime/trace"
	"sync"
)

const (
	envEnabled = "PIPEWARDEN_TRACE"
	envPath    = "PIPEWARDEN_TRACE_PATH"
	defaultOut = "/tmp/pipewarden.trace"
)

var (
	mu     sync.Mutex
	active bool
	file   *os.File
)

// Start begins a runtime trace when PIPEWARDEN_TRACE=1. No-op otherwise.
// Safe to call multiple times; subsequent calls are ignored.
func Start() error {
	mu.Lock()
	defer mu.Unlock()
	if active {
		return nil
	}
	if os.Getenv(envEnabled) != "1" {
		return nil
	}
	path := os.Getenv(envPath)
	if path == "" {
		path = defaultOut
	}
	f, err := os.Create(path)
	if err != nil {
		return fmt.Errorf("trace: create %q: %w", path, err)
	}
	if err := trace.Start(f); err != nil {
		_ = f.Close()
		return fmt.Errorf("trace: start: %w", err)
	}
	file = f
	active = true
	return nil
}

// Stop flushes and closes the trace. Safe to call when not active.
func Stop() {
	mu.Lock()
	defer mu.Unlock()
	if !active {
		return
	}
	trace.Stop()
	if file != nil {
		_ = file.Close()
		file = nil
	}
	active = false
}

// Active reports whether tracing is currently running.
func Active() bool {
	mu.Lock()
	defer mu.Unlock()
	return active
}

// Task wraps trace.NewTask for consistent call-site ergonomics. If tracing
// is disabled it returns the context unchanged and a no-op end function.
func Task(ctx context.Context, name string) (context.Context, func()) {
	if !Active() {
		return ctx, func() {}
	}
	ctx, t := trace.NewTask(ctx, name)
	return ctx, t.End
}

// Region is a cheap wrapper for a synchronous span within a goroutine.
// Usage: defer tracing.Region(ctx, "storage.write")()
func Region(ctx context.Context, name string) func() {
	if !Active() {
		return func() {}
	}
	r := trace.StartRegion(ctx, name)
	return r.End
}

// Path returns the absolute path of the current/last trace file. Honors
// PIPEWARDEN_TRACE_PATH if set, otherwise the default. The file may not
// exist if tracing was never started.
func Path() string {
	if p := os.Getenv(envPath); p != "" {
		return p
	}
	return defaultOut
}
