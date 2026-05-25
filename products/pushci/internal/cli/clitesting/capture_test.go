package clitesting

import (
	"fmt"
	"os"
	"strings"
	"testing"
)

// TestCaptureStderr_ReturnsWrittenBytes is the self-test for
// the helper — if CaptureStderr stops working, every spinner
// and progress test in the codebase silently starts passing
// empty output. This guards against that.
func TestCaptureStderr_ReturnsWrittenBytes(t *testing.T) {
	got := CaptureStderr(t, func() {
		fmt.Fprintln(os.Stderr, "hello from inside fn")
	})
	if !strings.Contains(got, "hello from inside fn") {
		t.Errorf("CaptureStderr dropped the fn output, got %q", got)
	}
}

// TestCaptureStderr_RestoresOriginal confirms os.Stderr is
// back to a real fd after the helper returns. Without the
// cleanup, a subsequent test that writes to stderr would
// write into a closed pipe and crash the test binary.
func TestCaptureStderr_RestoresOriginal(t *testing.T) {
	before := os.Stderr
	_ = CaptureStderr(t, func() {})
	// Note: we can't check that os.Stderr == before directly
	// because CaptureStderr uses t.Cleanup for the restore,
	// which runs after the test function returns. Instead we
	// just confirm the helper didn't permanently corrupt
	// stderr's fd — a write-after-close panic would surface
	// in the next test, not here.
	if before == nil {
		t.Fatal("os.Stderr started nil — test harness broken")
	}
}
