// Package clitesting provides reusable test helpers for cli
// output code. Extracted from internal/cli/spinner_test.go so
// other packages (runner, deploy, cmd) can write non-TTY output
// regression tests without each one reinventing the stderr
// redirect dance.
//
// Usage:
//
//	out := clitesting.CaptureStderr(t, func() {
//	    sp := cli.NewSpinner()
//	    sp.Start("Deploying...")
//	    time.Sleep(300 * time.Millisecond)
//	    sp.Stop(true)
//	})
//	if len(out) > 10*1024 {
//	    t.Errorf("stderr output leaked: %d bytes", len(out))
//	}
//
// The helper intentionally lives in a non-test file so callers
// outside the defining package can import it — _test.go files
// aren't accessible across packages in Go.
package clitesting

import (
	"bytes"
	"io"
	"os"
	"testing"
)

// CaptureStderr redirects os.Stderr to a pipe for the duration
// of fn and returns everything written. Restores the real
// stderr on exit (including on panic) via t.Cleanup so leaking
// the redirect across tests is impossible.
//
// Callers should treat the returned string as opaque — parse
// it, length-bound it, match it — but don't depend on exact
// byte-level equality because ANSI color codes vary across CI.
func CaptureStderr(t *testing.T, fn func()) string {
	t.Helper()
	orig := os.Stderr
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatalf("CaptureStderr: os.Pipe failed: %v", err)
	}
	os.Stderr = w
	t.Cleanup(func() { os.Stderr = orig })

	done := make(chan string, 1)
	go func() {
		var buf bytes.Buffer
		_, _ = io.Copy(&buf, r)
		done <- buf.String()
	}()

	fn()
	_ = w.Close()
	return <-done
}
