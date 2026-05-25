package cli

import (
	"testing"
	"time"
)

// TestSpinner_NonTTYStaysUnderBudget is the forward-looking
// regression: anything that future-us accidentally does to the
// non-TTY branch — writing per-tick status, emitting progress
// dots, logging retry attempts into stderr — must not blow past
// a sane byte budget for a long spinner.
//
// The v1.4.3 report measured 80KB for a ~10s deploy; pre-fix
// that was 1000 frames * ~80 bytes = ~80KB exactly. Budget
// here is 2KB for a 2-second run, leaving plenty of headroom
// for start/stop lines and any future status writes while
// still catching a full-blown animation leak.
func TestSpinner_NonTTYStaysUnderBudget(t *testing.T) {
	orig := spinnerTTYFn
	spinnerTTYFn = func() bool { return false }
	t.Cleanup(func() { spinnerTTYFn = orig })

	out := captureStderr(t, func() {
		sp := NewSpinner()
		sp.Start("Long running task that would have leaked 80KB pre-v1.4.4")
		time.Sleep(2 * time.Second)
		sp.Stop(true)
	})

	const budget = 2 * 1024
	if len(out) > budget {
		t.Errorf("non-TTY output = %d bytes, budget %d — spinner leaking again", len(out), budget)
	}
}
