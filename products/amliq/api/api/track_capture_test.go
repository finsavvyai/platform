package api

import (
	"sync"
	"testing"
	"time"

	"github.com/aegis-aml/aegis/internal/analytics"
)

// trackCapture is a Sink that records emitted events for assertion.
// Goroutine-safe because trackEvent fans into goroutines.
type trackCapture struct {
	mu     sync.Mutex
	events []analytics.Event
}

func (c *trackCapture) Emit(ev analytics.Event) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.events = append(c.events, ev)
}

func (c *trackCapture) waitFor(t *testing.T, n int) {
	t.Helper()
	end := time.Now().Add(200 * time.Millisecond)
	for time.Now().Before(end) {
		c.mu.Lock()
		got := len(c.events)
		c.mu.Unlock()
		if got >= n {
			return
		}
		time.Sleep(2 * time.Millisecond)
	}
	t.Fatalf("expected %d events; got %d", n, len(c.events))
}

func withCaptureSink(t *testing.T) *trackCapture {
	t.Helper()
	cap := &trackCapture{}
	analytics.Configure(cap)
	t.Cleanup(func() { analytics.Configure(analytics.NoopSink{}) })
	return cap
}
