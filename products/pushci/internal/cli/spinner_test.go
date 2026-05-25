package cli

import (
	"bytes"
	"io"
	"os"
	"strings"
	"testing"
	"time"
)

// captureStderr is the local variant used by tests in this
// package. The reusable version lives in
// internal/cli/clitesting/capture.go for cross-package use;
// this package can't import its own subpackage circularly, so
// we keep a small local copy here. Behavior matches the
// shared one byte-for-byte.
func captureStderr(t *testing.T, fn func()) string {
	t.Helper()
	orig := os.Stderr
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	os.Stderr = w
	done := make(chan string)
	go func() {
		var buf bytes.Buffer
		_, _ = io.Copy(&buf, r)
		done <- buf.String()
	}()
	fn()
	_ = w.Close()
	os.Stderr = orig
	return <-done
}

// TestSpinner_NonTTYSuppressesAnimation is the regression for
// the v1.4.3 spinner leak report: when stderr is captured (file
// redirect, CI log, container without PTY), the spinner used to
// unconditionally emit \r-prefixed frames every 80ms. That
// produced 80KB+ of "Deploying..." lines for a 10s operation.
// Non-TTY must see only start + stop lines — no frames, no CR.
func TestSpinner_NonTTYSuppressesAnimation(t *testing.T) {
	orig := spinnerTTYFn
	spinnerTTYFn = func() bool { return false }
	t.Cleanup(func() { spinnerTTYFn = orig })

	out := captureStderr(t, func() {
		sp := NewSpinner()
		sp.Start("Deploying...")
		time.Sleep(300 * time.Millisecond)
		sp.Stop(true)
	})

	if strings.Contains(out, "\r") {
		t.Errorf("non-TTY output should contain no carriage returns, got %q", out)
	}
	lines := strings.Count(out, "\n")
	if lines != 2 {
		t.Errorf("expected 2 lines (start + stop), got %d: %q", lines, out)
	}
	if !strings.Contains(out, "Deploying") {
		t.Errorf("expected the message to appear, got %q", out)
	}
}

// TestSpinner_TTYPathStillAnimates guards the other regression:
// a test that accidentally skips animation everywhere would hide
// a broken TTY path.
func TestSpinner_TTYPathStillAnimates(t *testing.T) {
	orig := spinnerTTYFn
	spinnerTTYFn = func() bool { return true }
	t.Cleanup(func() { spinnerTTYFn = orig })

	out := captureStderr(t, func() {
		sp := NewSpinner()
		sp.Start("Working")
		time.Sleep(120 * time.Millisecond)
		sp.Stop(true)
	})

	if !strings.Contains(out, "\r") {
		t.Errorf("TTY output should contain carriage returns from the animation, got %q", out)
	}
	if !strings.Contains(out, "Working") {
		t.Errorf("expected the message, got %q", out)
	}
}

// TestSpinner_NonTTYStaysUnderBudget lives in
// spinner_budget_test.go so this file stays under the 100-line
// Go source cap.
